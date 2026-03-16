/**
 * routes/history.js
 * GET /api/history/:repoId/timeline        - Full commit timeline data
 * GET /api/history/:repoId/function        - Evolution of a specific function
 * GET /api/history/:repoId/file            - History of a specific file
 */

const express = require("express");
const router = express.Router();
const gitService = require("../services/gitService");
const { buildTimeline } = require("../services/timelineGenerator");
const { diffFunctions } = require("../services/diffAnalyzer");

/**
 * GET /api/history/:repoId/timeline
 * Build the full visual timeline for a repo.
 * Query: maxCount, branch
 */
router.get("/:repoId/timeline", async (req, res) => {
  const { repoId } = req.params;
  const { maxCount = 200, branch } = req.query;

  try {
    const commits = await gitService.getCommitLog(repoId, {
      maxCount: parseInt(maxCount),
      branch,
    });

    const timeline = buildTimeline(commits);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/history/:repoId/function
 * Track how a specific function changed across all commits.
 * Query: file (required), name (required), maxCommits
 */
router.get("/:repoId/function", async (req, res) => {
  const { repoId } = req.params;
  const { file, name, maxCommits = 50 } = req.query;

  if (!file || !name) {
    return res.status(400).json({ error: "file and name query params required" });
  }

  try {
    const commits = await gitService.getCommitLog(repoId, {
      maxCount: parseInt(maxCommits),
      file,
    });

    const evolution = [];
    const lang = file.endsWith(".py") ? "py" : "js";

    for (const commit of commits) {
      const content = await gitService.getFileAtCommit(repoId, commit.hash, file);
      if (content === null) {
        evolution.push({ commit, status: "file_absent", fn: null });
        continue;
      }

      const { extractFunctionsFromString } = require("../utils/fileParser");
      const fns = extractFunctionsFromString(content, lang);
      const fn = fns.find((f) => f.name === name);

      evolution.push({
        commit: {
          hash: commit.hash,
          shortHash: commit.shortHash,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          timestamp: commit.timestamp,
        },
        status: fn ? "present" : "absent",
        fn: fn || null,
      });
    }

    // Build diffs between consecutive versions
    const withDiffs = evolution.map((entry, i) => {
      if (i === 0 || !entry.fn) return { ...entry, diff: null };
      const prev = evolution[i - 1];
      if (!prev.fn) return { ...entry, diff: null };

      return {
        ...entry,
        diff: diffFunctions(prev.fn.code, entry.fn.code, lang),
      };
    });

    res.json({
      function: name,
      file,
      evolution: withDiffs,
      totalVersions: withDiffs.filter((e) => e.status === "present").length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/history/:repoId/file
 * Get all commits that touched a specific file.
 * Query: path (required)
 */
router.get("/:repoId/file", async (req, res) => {
  const { repoId } = req.params;
  const { path: filePath, maxCount = 100 } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "path query param required" });
  }

  try {
    const commits = await gitService.getCommitLog(repoId, {
      maxCount: parseInt(maxCount),
      file: filePath,
    });

    res.json({ file: filePath, commits, total: commits.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
