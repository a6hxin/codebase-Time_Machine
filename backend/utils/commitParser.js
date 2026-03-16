/**
 * commitParser.js
 * Parses raw git log output into clean structured commit objects.
 */

/**
 * Parse a single git log entry string into a commit object.
 * @param {string} raw - Raw git log entry
 * @returns {object} Structured commit
 */
function parseCommit(raw) {
  const lines = raw.trim().split("\n");
  if (!lines.length) return null;

  const commit = {
    hash: "",
    shortHash: "",
    author: "",
    email: "",
    date: "",
    timestamp: 0,
    message: "",
    body: "",
    filesChanged: [],
    insertions: 0,
    deletions: 0,
  };

  let bodyLines = [];
  let inBody = false;
  let inFiles = false;

  for (const line of lines) {
    if (line.startsWith("commit ")) {
      commit.hash = line.replace("commit ", "").trim();
      commit.shortHash = commit.hash.slice(0, 7);
    } else if (line.startsWith("Author:")) {
      const authorStr = line.replace("Author:", "").trim();
      const emailMatch = authorStr.match(/<(.+)>/);
      commit.email = emailMatch ? emailMatch[1] : "";
      commit.author = authorStr.replace(/<.+>/, "").trim();
    } else if (line.startsWith("Date:")) {
      const dateStr = line.replace("Date:", "").trim();
      commit.date = dateStr;
      commit.timestamp = new Date(dateStr).getTime();
    } else if (line.trim() === "" && !inBody && commit.message === "") {
      inBody = true;
    } else if (inBody && !inFiles) {
      if (line.match(/^\s+\S/)) {
        if (!commit.message) {
          commit.message = line.trim();
        } else {
          bodyLines.push(line.trim());
        }
      } else if (line.match(/^[0-9]+ files? changed/)) {
        inFiles = true;
        parseStatLine(line, commit);
      }
    } else if (line.match(/\|\s+[0-9]+/)) {
      // File stat line: "  src/foo.js | 12 ++--"
      const fileMatch = line.match(/^\s*(.+?)\s*\|/);
      if (fileMatch) {
        commit.filesChanged.push(fileMatch[1].trim());
      }
    }
  }

  commit.body = bodyLines.join("\n");
  return commit;
}

/**
 * Parse the summary stats line e.g. "3 files changed, 10 insertions(+), 2 deletions(-)"
 */
function parseStatLine(line, commit) {
  const ins = line.match(/(\d+) insertion/);
  const del = line.match(/(\d+) deletion/);
  if (ins) commit.insertions = parseInt(ins[1]);
  if (del) commit.deletions = parseInt(del[1]);
}

/**
 * Parse full git log output (multiple commits) into an array.
 * @param {string} logOutput - Full git log string
 * @returns {object[]} Array of commit objects
 */
function parseGitLog(logOutput) {
  if (!logOutput || !logOutput.trim()) return [];

  // Split on commit boundaries
  const rawCommits = logOutput.split(/(?=^commit [a-f0-9]{40})/m).filter(Boolean);
  return rawCommits.map(parseCommit).filter(Boolean);
}

/**
 * Parse a single-line git log (--oneline format) into minimal objects.
 * @param {string} onelineOutput
 * @returns {object[]}
 */
function parseOnelineLog(onelineOutput) {
  return onelineOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.match(/^([a-f0-9]+)\s+(.*)$/);
      if (!parts) return null;
      return { shortHash: parts[1], message: parts[2] };
    })
    .filter(Boolean);
}

/**
 * Group commits by date (YYYY-MM-DD).
 * @param {object[]} commits
 * @returns {object} { "2024-01-15": [commit, ...], ... }
 */
function groupByDate(commits) {
  return commits.reduce((acc, commit) => {
    const day = new Date(commit.timestamp).toISOString().split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(commit);
    return acc;
  }, {});
}

module.exports = { parseCommit, parseGitLog, parseOnelineLog, groupByDate };
