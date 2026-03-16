/**
 * function_evolution.js
 * Core engine: tracks a single function across ALL commits in a repo.
 * This is the heart of Codebase Time Machine.
 */

require("dotenv").config();
const simpleGit = require("simple-git");
const path = require("path");
const { extractFunctionsFromString } = require("../backend/utils/fileParser");
const { getFileCommitHashes } = require("./commit_tracker");

const REPOS_DIR = process.env.REPOS_DIR || "./data/repos";

/**
 * Track a function's evolution across all commits that touched its file.
 * @param {string} repoPath - Path to local git repo
 * @param {string} filePath - Relative file path within the repo
 * @param {string} functionName - Name of the function to track
 * @param {object} options - { maxCommits, language }
 * @returns {object} Full evolution history
 */
async function trackFunctionEvolution(repoPath, filePath, functionName, options = {}) {
  const git = simpleGit(repoPath);
  const lang = options.language || detectLanguage(filePath);
  const maxCommits = options.maxCommits || 100;

  console.log(`🔍 Tracking "${functionName}" in ${filePath}...`);

  // Get all commits that touched this file
  const hashes = await getFileCommitHashes(repoPath, filePath, maxCommits);
  console.log(`Found ${hashes.length} commits touching ${filePath}`);

  const snapshots = [];

  for (const hash of hashes) {
    const snapshot = await getSnapshotAtCommit(git, hash, filePath, functionName, lang);
    snapshots.push(snapshot);
  }

  // Sort chronologically
  snapshots.sort((a, b) => a.timestamp - b.timestamp);

  // Build diffs between consecutive versions where function was present
  const withDiffs = buildEvolutionDiffs(snapshots);

  // Find when function was introduced and last changed
  const firstSeen = snapshots.find((s) => s.status === "present");
  const lastChanged = [...withDiffs].reverse().find((s) => s.changed === true);

  return {
    functionName,
    filePath,
    language: lang,
    totalCommits: hashes.length,
    snapshots: withDiffs,
    firstSeen: firstSeen
      ? { hash: firstSeen.hash, date: firstSeen.date, author: firstSeen.author }
      : null,
    lastChanged: lastChanged
      ? { hash: lastChanged.hash, date: lastChanged.date, author: lastChanged.author }
      : null,
    versionCount: withDiffs.filter((s) => s.changed).length + 1,
    currentCode: withDiffs.find((s) => s.hash === hashes[0])?.fn?.code || null,
  };
}

/**
 * Get the state of a function at a specific commit.
 */
async function getSnapshotAtCommit(git, hash, filePath, functionName, lang) {
  let content = null;
  let status = "absent";
  let fn = null;
  let commitMeta = {};

  try {
    // Get file content at this commit
    content = await git.show([`${hash}:${filePath}`]);

    // Extract functions
    const fns = extractFunctionsFromString(content, lang);
    fn = fns.find((f) => f.name === functionName) || null;
    status = fn ? "present" : "absent_in_file";
  } catch {
    status = "file_absent";
  }

  // Get commit metadata
  try {
    const logLine = await git.raw([
      "log", "--pretty=%H|%an|%ae|%ai|%s", "-n", "1", hash,
    ]);
    const parts = logLine.trim().split("|");
    commitMeta = {
      hash: parts[0] || hash,
      shortHash: (parts[0] || hash).slice(0, 7),
      author: parts[1] || "",
      email: parts[2] || "",
      date: parts[3] || "",
      timestamp: parts[3] ? new Date(parts[3]).getTime() : 0,
      message: parts[4] || "",
    };
  } catch {
    commitMeta = { hash, shortHash: hash.slice(0, 7), timestamp: 0 };
  }

  return { ...commitMeta, status, fn, rawContent: content };
}

/**
 * Add diff info between consecutive snapshots.
 */
function buildEvolutionDiffs(snapshots) {
  const result = [];

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];

    if (i === 0) {
      result.push({ ...snap, changed: snap.status === "present", diff: null, version: 1 });
      continue;
    }

    const prev = result[i - 1];
    let changed = false;
    let diff = null;
    let version = prev.version;

    if (snap.status === "present" && prev.status === "present") {
      const prevCode = prev.fn?.code || "";
      const newCode = snap.fn?.code || "";
      changed = prevCode.trim() !== newCode.trim();
      if (changed) {
        version++;
        diff = buildLineDiff(prevCode, newCode);
      }
    } else if (snap.status === "present" && prev.status !== "present") {
      // Function reappeared
      changed = true;
      version++;
    } else if (snap.status !== "present" && prev.status === "present") {
      // Function was removed
      changed = true;
    }

    result.push({ ...snap, changed, diff, version });
  }

  return result;
}

/**
 * Build a line-by-line diff between two code strings.
 * Returns array of { type: "+" | "-" | " ", line, lineNo }
 */
function buildLineDiff(oldCode, newCode) {
  const oldLines = (oldCode || "").split("\n");
  const newLines = (newCode || "").split("\n");
  const result = [];

  // Simple Myers-like diff
  const maxLen = Math.max(oldLines.length, newLines.length);

  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    const ol = oldLines[oi];
    const nl = newLines[ni];

    if (oi >= oldLines.length) {
      result.push({ type: "+", line: nl, lineNo: ni + 1 });
      ni++;
    } else if (ni >= newLines.length) {
      result.push({ type: "-", line: ol, lineNo: oi + 1 });
      oi++;
    } else if (ol === nl) {
      result.push({ type: " ", line: ol, lineNo: oi + 1 });
      oi++;
      ni++;
    } else {
      // Look ahead to find common line
      const lookAhead = 5;
      let foundOld = -1;
      let foundNew = -1;

      for (let k = 1; k <= lookAhead; k++) {
        if (newLines[ni + k] === ol) { foundNew = k; break; }
      }
      for (let k = 1; k <= lookAhead; k++) {
        if (oldLines[oi + k] === nl) { foundOld = k; break; }
      }

      if (foundNew !== -1 && (foundOld === -1 || foundNew <= foundOld)) {
        for (let k = 0; k < foundNew; k++) {
          result.push({ type: "+", line: newLines[ni + k], lineNo: ni + k + 1 });
        }
        ni += foundNew;
      } else if (foundOld !== -1) {
        for (let k = 0; k < foundOld; k++) {
          result.push({ type: "-", line: oldLines[oi + k], lineNo: oi + k + 1 });
        }
        oi += foundOld;
      } else {
        result.push({ type: "-", line: ol, lineNo: oi + 1 });
        result.push({ type: "+", line: nl, lineNo: ni + 1 });
        oi++;
        ni++;
      }
    }
  }

  return result;
}

/**
 * Find all functions in a file at HEAD and return which ones have evolved.
 * @param {string} repoPath
 * @param {string} filePath
 * @returns {object[]} Functions with change counts
 */
async function getFunctionChangeStats(repoPath, filePath) {
  const git = simpleGit(repoPath);
  const lang = detectLanguage(filePath);
  const hashes = await getFileCommitHashes(repoPath, filePath, 50);

  // Get current functions
  let currentContent;
  try {
    currentContent = await git.show([`HEAD:${filePath}`]);
  } catch {
    return [];
  }

  const currentFns = extractFunctionsFromString(currentContent, lang);

  const stats = await Promise.all(
    currentFns.map(async (fn) => {
      let changeCount = 0;
      let lastCode = null;

      for (const hash of hashes) {
        try {
          const content = await git.show([`${hash}:${filePath}`]);
          const fns = extractFunctionsFromString(content, lang);
          const found = fns.find((f) => f.name === fn.name);
          if (found && found.code.trim() !== lastCode) {
            if (lastCode !== null) changeCount++;
            lastCode = found.code.trim();
          }
        } catch {
          // skip
        }
      }

      return { name: fn.name, type: fn.type, lineCount: fn.lineCount, changeCount };
    })
  );

  return stats.sort((a, b) => b.changeCount - a.changeCount);
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".py") return "py";
  return "js";
}

module.exports = {
  trackFunctionEvolution,
  getSnapshotAtCommit,
  getFunctionChangeStats,
  buildLineDiff,
};
