/**
 * commit_tracker.js
 * Walks the commit tree of a repo chronologically.
 * Handles branches, merges, and pagination.
 */

require("dotenv").config();
const simpleGit = require("simple-git");
const path = require("path");

const REPOS_DIR = process.env.REPOS_DIR || "./data/repos";

/**
 * Get all commits for a repo in chronological order.
 * @param {string} repoPath - Path to local git repo
 * @param {object} options
 * @returns {object[]} Array of commit objects
 */
async function getAllCommits(repoPath, options = {}) {
  const git = simpleGit(repoPath);
  const {
    maxCount = 500,
    branch = "HEAD",
    since,
    until,
    author,
  } = options;

  const logOptions = {
    maxCount,
    "--topo-order": null,
  };

  if (since) logOptions["--since"] = since;
  if (until) logOptions["--until"] = until;
  if (author) logOptions["--author"] = author;

  const log = await git.log(logOptions);

  return log.all
    .map(normalizeEntry)
    .sort((a, b) => a.timestamp - b.timestamp); // chronological
}

/**
 * Walk commits one by one — useful for streaming or processing large repos.
 * @param {string} repoPath
 * @param {function} callback - Called with each commit object
 * @param {object} options
 */
async function walkCommits(repoPath, callback, options = {}) {
  const commits = await getAllCommits(repoPath, options);
  for (const commit of commits) {
    await callback(commit);
  }
}

/**
 * Get the parent hash(es) of a commit — handles merge commits.
 * @param {string} repoPath
 * @param {string} hash
 * @returns {string[]} Array of parent hashes
 */
async function getParents(repoPath, hash) {
  const git = simpleGit(repoPath);
  const raw = await git.raw(["log", "--pretty=%P", "-n", "1", hash]);
  return raw.trim().split(/\s+/).filter(Boolean);
}

/**
 * Check if a commit is a merge commit (has more than one parent).
 * @param {string} repoPath
 * @param {string} hash
 * @returns {boolean}
 */
async function isMergeCommit(repoPath, hash) {
  const parents = await getParents(repoPath, hash);
  return parents.length > 1;
}

/**
 * Get all commit hashes that touched a specific file.
 * @param {string} repoPath
 * @param {string} filePath - Relative path within repo
 * @param {number} maxCount
 * @returns {string[]}
 */
async function getFileCommitHashes(repoPath, filePath, maxCount = 100) {
  const git = simpleGit(repoPath);
  const raw = await git.raw([
    "log",
    "--pretty=%H",
    `--max-count=${maxCount}`,
    "--follow",
    "--",
    filePath,
  ]);
  return raw.trim().split("\n").filter(Boolean);
}

/**
 * Get a range of commits between two hashes (inclusive).
 * @param {string} repoPath
 * @param {string} fromHash
 * @param {string} toHash
 * @returns {object[]}
 */
async function getCommitRange(repoPath, fromHash, toHash) {
  const git = simpleGit(repoPath);
  const log = await git.log({ from: fromHash, to: toHash });
  return log.all.map(normalizeEntry).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get the first (root) commit of a repo.
 * @param {string} repoPath
 * @returns {object}
 */
async function getRootCommit(repoPath) {
  const git = simpleGit(repoPath);
  const raw = await git.raw(["rev-list", "--max-parents=0", "HEAD"]);
  const hash = raw.trim();
  const log = await git.log({ maxCount: 1, from: `${hash}^`, to: hash }).catch(() => null);
  // Fallback for root commit
  const show = await git.show(["--format=%H|%an|%ae|%ai|%s", "--no-patch", hash]);
  const [h, author, email, date, message] = show.trim().split("|");
  return { hash: h, author, email, date, timestamp: new Date(date).getTime(), message };
}

/**
 * Get stats for commits over time (for sparkline / activity graphs).
 * @param {string} repoPath
 * @param {string} period - "day" | "week" | "month"
 * @returns {object[]} [{ period, count }]
 */
async function getCommitActivity(repoPath, period = "week") {
  const commits = await getAllCommits(repoPath, { maxCount: 1000 });
  const buckets = {};

  for (const c of commits) {
    const d = new Date(c.timestamp);
    let key;
    if (period === "day") {
      key = d.toISOString().split("T")[0];
    } else if (period === "week") {
      const week = getISOWeek(d);
      key = `${d.getFullYear()}-W${week}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, count]) => ({ period, count }));
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeEntry(entry) {
  return {
    hash: entry.hash,
    shortHash: entry.hash?.slice(0, 7),
    author: entry.author_name,
    email: entry.author_email,
    date: entry.date,
    timestamp: new Date(entry.date).getTime(),
    message: entry.message,
    body: entry.body || "",
    refs: entry.refs || "",
  };
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

module.exports = {
  getAllCommits,
  walkCommits,
  getParents,
  isMergeCommit,
  getFileCommitHashes,
  getCommitRange,
  getRootCommit,
  getCommitActivity,
};
