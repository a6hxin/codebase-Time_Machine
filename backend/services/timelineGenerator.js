/**
 * timelineGenerator.js
 * Builds a structured timeline data object from commit history.
 * Used to power the frontend visual timeline.
 */

const { groupByDate } = require("../utils/commitParser");

/**
 * Build a full timeline structure from a list of commits.
 * @param {object[]} commits - Normalized commit objects
 * @param {object} options
 * @returns {object} Timeline data ready for the frontend
 */
function buildTimeline(commits, options = {}) {
  if (!commits || !commits.length) {
    return { nodes: [], edges: [], groups: [], stats: {} };
  }

  const sorted = [...commits].sort((a, b) => a.timestamp - b.timestamp);
  const nodes = buildNodes(sorted);
  const edges = buildEdges(nodes);
  const groups = buildDateGroups(sorted);
  const stats = buildStats(sorted);

  return {
    nodes,
    edges,
    groups,
    stats,
    first: sorted[0],
    last: sorted[sorted.length - 1],
    totalCommits: sorted.length,
  };
}

/**
 * Build timeline nodes from commits.
 */
function buildNodes(commits) {
  return commits.map((commit, index) => ({
    id: commit.hash,
    shortId: commit.shortHash,
    index,
    label: commit.message?.slice(0, 60) || "(no message)",
    author: commit.author,
    email: commit.email,
    date: commit.date,
    timestamp: commit.timestamp,
    isMerge: isMergeCommit(commit),
    isFirst: index === 0,
    isLast: index === commits.length - 1,
    type: classifyCommit(commit.message),
    x: index, // logical position; frontend maps to screen coords
    filesChanged: commit.filesChanged || [],
    insertions: commit.insertions || 0,
    deletions: commit.deletions || 0,
    size: calcNodeSize(commit),
  }));
}

/**
 * Build edges connecting consecutive commits.
 */
function buildEdges(nodes) {
  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push({
      id: `${nodes[i - 1].id}-${nodes[i].id}`,
      from: nodes[i - 1].id,
      to: nodes[i].id,
      timeDelta: nodes[i].timestamp - nodes[i - 1].timestamp,
    });
  }
  return edges;
}

/**
 * Group nodes by calendar date.
 */
function buildDateGroups(commits) {
  const byDate = groupByDate(commits);
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayCommits]) => ({
      date,
      label: formatDate(date),
      count: dayCommits.length,
      hashes: dayCommits.map((c) => c.hash),
    }));
}

/**
 * Build aggregate stats from the commit list.
 */
function buildStats(commits) {
  const authors = {};
  let totalInsertions = 0;
  let totalDeletions = 0;
  const typeCounts = {};

  for (const c of commits) {
    authors[c.author] = (authors[c.author] || 0) + 1;
    totalInsertions += c.insertions || 0;
    totalDeletions += c.deletions || 0;
    const type = classifyCommit(c.message);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const sortedAuthors = Object.entries(authors)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));

  const firstDate = new Date(commits[0].timestamp);
  const lastDate = new Date(commits[commits.length - 1].timestamp);
  const daySpan = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) || 1;

  return {
    totalCommits: commits.length,
    totalInsertions,
    totalDeletions,
    authors: sortedAuthors,
    topAuthor: sortedAuthors[0]?.name || "Unknown",
    typeCounts,
    daySpan,
    commitsPerDay: (commits.length / daySpan).toFixed(1),
    firstDate: firstDate.toISOString(),
    lastDate: lastDate.toISOString(),
  };
}

/**
 * Classify a commit message into a type tag.
 */
function classifyCommit(message = "") {
  const msg = message.toLowerCase();
  if (msg.startsWith("feat") || msg.includes("add ") || msg.includes("new ")) return "feature";
  if (msg.startsWith("fix") || msg.includes("bug") || msg.includes("patch")) return "fix";
  if (msg.startsWith("refactor") || msg.includes("refactor")) return "refactor";
  if (msg.startsWith("docs") || msg.includes("readme")) return "docs";
  if (msg.startsWith("test") || msg.includes("spec")) return "test";
  if (msg.startsWith("chore") || msg.includes("bump") || msg.includes("update deps")) return "chore";
  if (msg.startsWith("style") || msg.includes("format") || msg.includes("lint")) return "style";
  if (msg.startsWith("merge") || msg.includes("merge")) return "merge";
  return "other";
}

/**
 * Detect if a commit looks like a merge commit.
 */
function isMergeCommit(commit) {
  return (
    commit.message?.toLowerCase().startsWith("merge") ||
    commit.message?.toLowerCase().includes("merge branch")
  );
}

/**
 * Calculate node visual size based on change volume.
 */
function calcNodeSize(commit) {
  const changes = (commit.insertions || 0) + (commit.deletions || 0);
  if (changes === 0) return "sm";
  if (changes < 20) return "sm";
  if (changes < 100) return "md";
  if (changes < 500) return "lg";
  return "xl";
}

/**
 * Format a YYYY-MM-DD date string for display.
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

module.exports = { buildTimeline, classifyCommit };
