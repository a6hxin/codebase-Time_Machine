/**
 * gitService.js
 * Core wrapper around simple-git for all Git operations.
 */

const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs-extra");

const REPOS_DIR = process.env.REPOS_DIR || "./data/repos";

/**
 * Get a simple-git instance for a given repo path.
 */
function getGit(repoPath) {
  return simpleGit(repoPath);
}

/**
 * Get the local path for a cloned repo by its ID.
 */
function getRepoPath(repoId) {
  return path.join(REPOS_DIR, repoId);
}

/**
 * Check if a repo is already cloned locally.
 */
async function repoExists(repoId) {
  const repoPath = getRepoPath(repoId);
  return fs.pathExists(path.join(repoPath, ".git"));
}

/**
 * Get the full commit log for a repo.
 * @param {string} repoId
 * @param {object} options - { maxCount, branch, file }
 * @returns {object[]} Array of log entries
 */
async function getCommitLog(repoId, options = {}) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);

  const logOptions = {
    maxCount: options.maxCount || 200,
    "--stat": null,
  };

  if (options.branch) logOptions["--branch"] = options.branch;
  if (options.file) logOptions["--follow"] = options.file;

  const log = await git.log(logOptions);
  return log.all.map(normalizeLogEntry);
}

/**
 * Get a single commit's full details including diff.
 * @param {string} repoId
 * @param {string} hash - Full or short commit hash
 * @returns {object}
 */
async function getCommitDetail(repoId, hash) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);

  const [show, diff] = await Promise.all([
    git.show([hash, "--stat", "--format=fuller"]),
    git.diff([`${hash}^`, hash, "--unified=5"]).catch(() => ""), // root commit has no parent
  ]);

  return { raw: show, diff };
}

/**
 * Get the content of a file at a specific commit.
 * @param {string} repoId
 * @param {string} hash
 * @param {string} filePath - Relative path within repo
 * @returns {string} File content
 */
async function getFileAtCommit(repoId, hash, filePath) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);

  try {
    const content = await git.show([`${hash}:${filePath}`]);
    return content;
  } catch {
    return null; // file didn't exist at that commit
  }
}

/**
 * Get all branches in a repo.
 * @param {string} repoId
 * @returns {string[]}
 */
async function getBranches(repoId) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);
  const result = await git.branch(["-a"]);
  return result.all;
}

/**
 * Get all file paths in the repo at HEAD.
 * @param {string} repoId
 * @returns {string[]}
 */
async function getAllFiles(repoId) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);
  const result = await git.raw(["ls-tree", "-r", "--name-only", "HEAD"]);
  return result.trim().split("\n").filter(Boolean);
}

/**
 * Get the diff between two commits.
 * @param {string} repoId
 * @param {string} fromHash
 * @param {string} toHash
 * @param {string} [filePath] - Optional: limit diff to one file
 * @returns {string}
 */
async function getDiff(repoId, fromHash, toHash, filePath = null) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);
  const args = [fromHash, toHash, "--unified=5"];
  if (filePath) args.push("--", filePath);
  return git.diff(args);
}

/**
 * Get git blame for a file at HEAD.
 * @param {string} repoId
 * @param {string} filePath
 * @returns {string}
 */
async function getBlame(repoId, filePath) {
  const repoPath = getRepoPath(repoId);
  const git = getGit(repoPath);
  return git.raw(["blame", "-l", filePath]);
}

/**
 * Normalize a simple-git log entry to our format.
 */
function normalizeLogEntry(entry) {
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

module.exports = {
  getGit,
  getRepoPath,
  repoExists,
  getCommitLog,
  getCommitDetail,
  getFileAtCommit,
  getBranches,
  getAllFiles,
  getDiff,
  getBlame,
};
