/**
 * routes/commits.js
 * GET /api/commits/:repoId           - List commits
 * GET /api/commits/:repoId/:hash     - Single commit detail
 * GET /api/commits/:repoId/:hash/diff - Diff for a commit
 */

const express = require("express");
const router = express.Router();
const gitService = require("../services/gitService");
const { parseDiffText } = require("../services/diffAnalyzer");
const { parseGitLog } = require("../utils/commitParser");

/**
 * GET /api/commits/:repoId
 * Query params: maxCount, branch, file, page, limit
 */
router.get("/:repoId", async (req, res) => {
  const { repoId } = req.params;
  const { maxCount = 100, branch, file, page = 1, limit = 50 } = req.query;

  try {
    const commits = await gitService.getCommitLog(repoId, {
      maxCount: parseInt(maxCount),
      branch,
      file,
    });

    // Pagination
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = commits.slice(start, start + parseInt(limit));

    res.json({
      commits: paginated,
      total: commits.length,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: start + parseInt(limit) < commits.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/commits/:repoId/:hash
 * Full detail for one commit including stats.
 */
router.get("/:repoId/:hash", async (req, res) => {
  const { repoId, hash } = req.params;

  try {
    const detail = await gitService.getCommitDetail(repoId, hash);
    const parsed = parseGitLog(detail.raw);
    const diffFiles = parseDiffText(detail.diff);

    res.json({
      commit: parsed[0] || null,
      diff: detail.diff,
      files: diffFiles,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/commits/:repoId/:hash/diff
 * Raw unified diff for a commit.
 * Query: file (optional, filter to single file)
 */
router.get("/:repoId/:hash/diff", async (req, res) => {
  const { repoId, hash } = req.params;
  const { file } = req.query;

  try {
    const diff = await gitService.getDiff(repoId, `${hash}^`, hash, file || null);
    const files = parseDiffText(diff);

    res.json({ diff, files });
  } catch (err) {
    // Handle root commit (no parent)
    if (err.message.includes("unknown revision")) {
      return res.json({ diff: "", files: [], note: "Root commit — no parent to diff against" });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/commits/:repoId/:hash/file
 * Get content of a specific file at this commit.
 * Query: path (required)
 */
router.get("/:repoId/:hash/file", async (req, res) => {
  const { repoId, hash } = req.params;
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "path query param required" });
  }

  try {
    const content = await gitService.getFileAtCommit(repoId, hash, filePath);
    if (content === null) {
      return res.status(404).json({ error: "File not found at this commit" });
    }
    res.json({ content, path: filePath, hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
