const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const simpleGit = require("simple-git");
const gitService = require("../services/gitService");

const REPOS_DIR = process.env.REPOS_DIR || "./data/repos";

router.post("/connect", async (req, res) => {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  const repoId = uuidv4().slice(0, 8);
  const repoPath = path.join(REPOS_DIR, repoId);

  try {
    await fs.ensureDir(repoPath);

    const isLocal = !url.startsWith("http") && !url.startsWith("git@");

    if (isLocal) {
      const absPath = path.resolve(url);

      if (!(await fs.pathExists(path.join(absPath, ".git")))) {
        return res.status(400).json({ error: "Not a valid git repository" });
      }

      // Save meta pointing to original path (no symlink needed)
      const repoMeta = {
        id: repoId,
        name: name || path.basename(absPath),
        url: absPath,
        path: absPath,
        connectedAt: new Date().toISOString(),
      };

      await fs.writeJson(path.join(repoPath, ".ctm-meta.json"), repoMeta, { spaces: 2 });

      // Get git info from original path
      const repoGit = simpleGit(absPath);
      const branches = await repoGit.branch().catch(() => ({ current: "main", all: [] }));
      const log = await repoGit.log({ maxCount: 1 }).catch(() => ({ latest: null }));

      repoMeta.currentBranch = branches.current;
      repoMeta.branches = branches.all;
      repoMeta.lastCommit = log.latest;

      await fs.writeJson(path.join(repoPath, ".ctm-meta.json"), repoMeta, { spaces: 2 });

      return res.json({ success: true, repo: repoMeta });

    } else {
      // Clone remote repo
      console.log(`Cloning ${url}...`);
      const git = simpleGit();
      await git.clone(url, repoPath);

      const repoGit = simpleGit(repoPath);
      const remotes = await repoGit.getRemotes(true).catch(() => []);
      const log = await repoGit.log({ maxCount: 1 }).catch(() => ({ latest: null }));
      const branches = await repoGit.branch().catch(() => ({ current: "main", all: [] }));

      const repoMeta = {
        id: repoId,
        name: name || path.basename(url, ".git"),
        url,
        path: repoPath,
        currentBranch: branches.current,
        branches: branches.all,
        lastCommit: log.latest,
        remotes: remotes.map((r) => ({ name: r.name, url: r.refs?.fetch || "" })),
        connectedAt: new Date().toISOString(),
      };

      await fs.writeJson(path.join(repoPath, ".ctm-meta.json"), repoMeta, { spaces: 2 });

      return res.json({ success: true, repo: repoMeta });
    }

  } catch (err) {
    await fs.remove(repoPath).catch(() => {});
    console.error("Connect error:", err.message);
    res.status(500).json({ error: `Failed to connect: ${err.message}` });
  }
});

router.get("/:repoId", async (req, res) => {
  const { repoId } = req.params;
  const repoPath = path.join(REPOS_DIR, repoId);

  try {
    const metaPath = path.join(repoPath, ".ctm-meta.json");
    if (!(await fs.pathExists(metaPath))) {
      return res.status(404).json({ error: "Repo not found" });
    }
    const meta = await fs.readJson(metaPath);
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:repoId/files", async (req, res) => {
  const { repoId } = req.params;
  try {
    const files = await gitService.getAllFiles(repoId);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:repoId/branches", async (req, res) => {
  const { repoId } = req.params;
  try {
    const branches = await gitService.getBranches(repoId);
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:repoId", async (req, res) => {
  const { repoId } = req.params;
  const repoPath = path.join(REPOS_DIR, repoId);
  try {
    await fs.remove(repoPath);
    res.json({ success: true, message: `Repo ${repoId} removed` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
