/**
 * diffAnalyzer.js
 * Computes function-level diffs between two versions of a file.
 */

const { extractFunctionsFromString } = require("../utils/fileParser");

/**
 * Compare two versions of a file and return which functions changed.
 * @param {string} oldContent - File content at old commit
 * @param {string} newContent - File content at new commit
 * @param {string} language - "js" | "py"
 * @returns {object} { added, removed, modified, unchanged }
 */
function diffFunctions(oldContent, newContent, language = "js") {
  const oldFuncs = extractFunctionsFromString(oldContent || "", language);
  const newFuncs = extractFunctionsFromString(newContent || "", language);

  const oldMap = new Map(oldFuncs.map((f) => [f.name, f]));
  const newMap = new Map(newFuncs.map((f) => [f.name, f]));

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Check new functions
  for (const [name, newFn] of newMap) {
    if (!oldMap.has(name)) {
      added.push({ name, fn: newFn, type: "added" });
    } else {
      const oldFn = oldMap.get(name);
      if (oldFn.code.trim() !== newFn.code.trim()) {
        modified.push({
          name,
          old: oldFn,
          new: newFn,
          type: "modified",
          linesDelta: newFn.lineCount - oldFn.lineCount,
          diff: buildFunctionDiff(oldFn.code, newFn.code),
        });
      } else {
        unchanged.push({ name, fn: newFn, type: "unchanged" });
      }
    }
  }

  // Check removed functions
  for (const [name, oldFn] of oldMap) {
    if (!newMap.has(name)) {
      removed.push({ name, fn: oldFn, type: "removed" });
    }
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged.length,
      totalOld: oldFuncs.length,
      totalNew: newFuncs.length,
    },
  };
}

/**
 * Build a simple line-by-line diff for a single function.
 * @param {string} oldCode
 * @param {string} newCode
 * @returns {object[]} Array of { type: "+" | "-" | " ", line }
 */
function buildFunctionDiff(oldCode, newCode) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const result = [];

  // Basic LCS-based diff (simplified)
  const lcs = computeLCS(oldLines, newLines);
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && oldLines[oi] === lcs[li] && ni < newLines.length && newLines[ni] === lcs[li]) {
      result.push({ type: " ", line: oldLines[oi] });
      oi++; ni++; li++;
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      result.push({ type: "+", line: newLines[ni] });
      ni++;
    } else if (oi < oldLines.length) {
      result.push({ type: "-", line: oldLines[oi] });
      oi++;
    }
  }

  return result;
}

/**
 * Compute Longest Common Subsequence of two string arrays.
 */
function computeLCS(a, b) {
  const m = Math.min(a.length, 100); // cap to avoid O(n²) on huge functions
  const n = Math.min(b.length, 100);
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

/**
 * Analyze a raw unified diff string and extract changed file paths.
 * @param {string} diffText - Raw git diff output
 * @returns {object[]} Array of { file, additions, deletions, hunks }
 */
function parseDiffText(diffText) {
  if (!diffText) return [];
  const files = [];
  let currentFile = null;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (currentFile) files.push(currentFile);
      const match = line.match(/b\/(.+)$/);
      currentFile = { file: match ? match[1] : "unknown", additions: 0, deletions: 0, hunks: [] };
    } else if (line.startsWith("@@")) {
      currentFile?.hunks.push(line);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (currentFile) currentFile.additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (currentFile) currentFile.deletions++;
    }
  }

  if (currentFile) files.push(currentFile);
  return files;
}

module.exports = { diffFunctions, buildFunctionDiff, parseDiffText };
