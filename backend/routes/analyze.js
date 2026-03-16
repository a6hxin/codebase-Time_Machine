const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");
const path = require("path");
const gitService = require("../services/gitService");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const RESULTS_DIR = process.env.RESULTS_DIR || "./data/analysis_results";

// In-memory job store
const jobs = new Map();

/**
 * POST /api/analyze/commit
 * Body: { repoId, hash }
 */
router.post("/commit", async (req, res) => {
  const { repoId, hash } = req.body;
  if (!repoId || !hash) {
    return res.status(400).json({ error: "repoId and hash required" });
  }

  const jobId = uuidv4().slice(0, 8);
  jobs.set(jobId, { id: jobId, status: "pending", type: "commit", createdAt: Date.now() });

  processCommitAnalysis(jobId, repoId, hash).catch((err) => {
    jobs.set(jobId, { ...jobs.get(jobId), status: "error", error: err.message });
  });

  res.json({ jobId, status: "pending" });
});

/**
 * POST /api/analyze/function
 */
router.post("/function", async (req, res) => {
  const { repoId, file, functionName, hashes } = req.body;
  if (!repoId || !file || !functionName) {
    return res.status(400).json({ error: "repoId, file, functionName required" });
  }

  const jobId = uuidv4().slice(0, 8);
  jobs.set(jobId, { id: jobId, status: "pending", type: "function", createdAt: Date.now() });

  processFunctionAnalysis(jobId, repoId, file, functionName, hashes || []).catch((err) => {
    jobs.set(jobId, { ...jobs.get(jobId), status: "error", error: err.message });
  });

  res.json({ jobId, status: "pending" });
});

/**
 * POST /api/analyze/bug
 */
router.post("/bug", async (req, res) => {
  const { repoId, file, lineNumber, description } = req.body;
  if (!repoId || !file) {
    return res.status(400).json({ error: "repoId and file required" });
  }

  const jobId = uuidv4().slice(0, 8);
  jobs.set(jobId, { id: jobId, status: "pending", type: "bug", createdAt: Date.now() });

  processBugAnalysis(jobId, repoId, file, lineNumber, description).catch((err) => {
    jobs.set(jobId, { ...jobs.get(jobId), status: "error", error: err.message });
  });

  res.json({ jobId, status: "pending" });
});

/**
 * GET /api/analyze/status/:id
 */
router.get("/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ─── Background processors ──────────────────────────────────────────

async function processCommitAnalysis(jobId, repoId, hash) {
  jobs.set(jobId, { ...jobs.get(jobId), status: "running" });

  const detail = await gitService.getCommitDetail(repoId, hash);

  const response = await fetch(`${AI_SERVICE_URL}/explain/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash, diff: detail.diff, raw: detail.raw }),
  });

  if (!response.ok) throw new Error(`AI service error: ${response.status}`);
  const result = await response.json();

  await fs.ensureDir(RESULTS_DIR);
  const resultPath = path.join(RESULTS_DIR, `${jobId}.json`);
  await fs.writeJson(resultPath, result, { spaces: 2 });

  jobs.set(jobId, { ...jobs.get(jobId), status: "done", result, resultPath });
}

async function processFunctionAnalysis(jobId, repoId, file, functionName, hashes) {
  jobs.set(jobId, { ...jobs.get(jobId), status: "running" });

  const versions = [];
  for (const hash of hashes.slice(0, 10)) {
    const content = await gitService.getFileAtCommit(repoId, hash, file);
    if (content) versions.push({ hash, content });
  }

  const response = await fetch(`${AI_SERVICE_URL}/explain/function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ functionName, file, versions }),
  });

  if (!response.ok) throw new Error(`AI service error: ${response.status}`);
  const result = await response.json();

  jobs.set(jobId, { ...jobs.get(jobId), status: "done", result });
}

async function processBugAnalysis(jobId, repoId, file, lineNumber, description) {
  jobs.set(jobId, { ...jobs.get(jobId), status: "running" });

  const blame = await gitService.getBlame(repoId, file);

  const response = await fetch(`${AI_SERVICE_URL}/detect/bug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, lineNumber, description, blame }),
  });

  if (!response.ok) throw new Error(`AI service error: ${response.status}`);
  const result = await response.json();

  jobs.set(jobId, { ...jobs.get(jobId), status: "done", result });
}

module.exports = router;
