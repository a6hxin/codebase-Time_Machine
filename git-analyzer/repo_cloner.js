/**
 * repo_cloner.js
 * Handles cloning repos locally — supports HTTPS, SSH, and local paths.
 * Can be run standalone: node git-analyzer/repo_cloner.js <url> [targetDir]
 */

require("dotenv").config();
const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");

const REPOS_DIR = process.env.REPOS_DIR || "./data/repos";

/**
 * Clone a repository to a local directory.
 * @param {string} url - Git URL (HTTPS, SSH, or local path)
 * @param {object} options - { targetDir, shallow, branch, token }
 * @returns {object} { repoId, repoPath, name }
 */
async function cloneRepo(url, options = {}) {
  const repoId = options.repoId || uuidv4().slice(0, 8);
  const repoPath = options.targetDir || path.join(REPOS_DIR, repoId);
  const repoName = options.name || extractRepoName(url);

  await fs.ensureDir(path.dirname(repoPath));

  if (await fs.pathExists(repoPath)) {
    console.log(`⚠️  Repo already exists at ${repoPath}, skipping clone.`);
    return { repoId, repoPath, name: repoName, skipped: true };
  }

  const git = simpleGit();
  const cloneArgs = buildCloneArgs(url, options);

  console.log(`🔄 Cloning ${repoName} → ${repoPath}`);

  const authUrl = injectToken(url, options.token);

  await git.clone(authUrl, repoPath, cloneArgs);
  console.log(`✅ Cloned ${repoName}`);

  return { repoId, repoPath, name: repoName };
}

/**
 * Pull latest changes for an already-cloned repo.
 * @param {string} repoPath
 */
async function pullLatest(repoPath) {
  const git = simpleGit(repoPath);
  console.log(`🔄 Pulling latest for ${repoPath}`);
  const result = await git.pull();
  console.log(`✅ Up to date`);
  return result;
}

/**
 * Connect to a local repo without cloning.
 * @param {string} localPath - Absolute or relative path to a git repo
 * @returns {object} { repoId, repoPath, name }
 */
async function connectLocal(localPath) {
  const absPath = path.resolve(localPath);

  if (!(await fs.pathExists(path.join(absPath, ".git")))) {
    throw new Error(`Not a git repository: ${absPath}`);
  }

  const repoId = uuidv4().slice(0, 8);
  const repoPath = path.join(REPOS_DIR, repoId);

  // Symlink to avoid copying large repos
  await fs.ensureSymlink(absPath, repoPath);

  const name = path.basename(absPath);
  console.log(`✅ Connected to local repo: ${name}`);
  return { repoId, repoPath, name, local: true };
}

/**
 * Check if a path is a valid git repository.
 * @param {string} repoPath
 * @returns {boolean}
 */
async function isGitRepo(repoPath) {
  return fs.pathExists(path.join(repoPath, ".git"));
}

/**
 * Remove a cloned repo from disk.
 * @param {string} repoId
 */
async function removeRepo(repoId) {
  const repoPath = path.join(REPOS_DIR, repoId);
  await fs.remove(repoPath);
  console.log(`🗑️  Removed repo ${repoId}`);
}

/**
 * List all repos in the repos directory.
 * @returns {string[]} Array of repoIds
 */
async function listRepos() {
  await fs.ensureDir(REPOS_DIR);
  const entries = await fs.readdir(REPOS_DIR);
  return entries;
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractRepoName(url) {
  return path
    .basename(url, ".git")
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildCloneArgs(url, options) {
  const args = [];
  if (options.shallow) args.push("--depth", "1");
  if (options.branch) args.push("--branch", options.branch);
  // Partial clone for large repos
  if (options.partial) args.push("--filter=blob:none", "--no-checkout");
  return args;
}

function injectToken(url, token) {
  if (!token) return url;
  if (url.startsWith("https://github.com")) {
    return url.replace("https://", `https://${token}@`);
  }
  return url;
}

// ─── CLI usage ──────────────────────────────────────────────────────
if (require.main === module) {
  const [, , url, targetDir] = process.argv;
  if (!url) {
    console.error("Usage: node repo_cloner.js <git-url> [targetDir]");
    process.exit(1);
  }
  cloneRepo(url, { targetDir })
    .then((r) => console.log("Done:", r))
    .catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { cloneRepo, connectLocal, pullLatest, isGitRepo, removeRepo, listRepos };
