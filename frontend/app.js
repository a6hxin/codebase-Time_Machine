/**
 * app.js
 * Main application bootstrap — wires up all components and manages state.
 */

import { Timeline } from "./components/timeline.js";
import { CommitViewer } from "./components/commitViewer.js";
import { CodeDiffViewer } from "./components/codeDiffViewer.js";
import { AIExplanation } from "./components/aiExplanation.js";

const API = "http://localhost:3000/api";

// ─── App State ──────────────────────────────────────────────────────
const state = {
  repoId: null,
  repoName: null,
  selectedCommit: null,
  selectedFile: null,
  activeTab: "timeline",
};

// ─── Component Instances ────────────────────────────────────────────
const timeline = new Timeline(document.getElementById("timeline-container"), onCommitSelect);
const commitViewer = new CommitViewer(document.getElementById("commit-detail-content"));
const diffViewer = new CodeDiffViewer(document.getElementById("monaco-diff-container"));
const aiExplainer = new AIExplanation(document.getElementById("ai-container"));

// ─── Init ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupRepoConnect();
  setupEvolutionControls();
  setupCommitPanel();
});

// ─── Tab navigation ──────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${tabName}`);
  });
}

// ─── Repo Connect ─────────────────────────────────────────────────────

function setupRepoConnect() {
  const input = document.getElementById("repo-url-input");
  const btn = document.getElementById("connect-btn");
  const status = document.getElementById("repo-status");

  btn.addEventListener("click", async () => {
    const url = input.value.trim();
    if (!url) return showToast("Enter a repo URL or path", "error");

    btn.textContent = "Connecting…";
    btn.disabled = true;
    status.classList.remove("hidden", "error");
    status.textContent = "Connecting to repository…";

    try {
      const res = await fetch(`${API}/repo/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      state.repoId = data.repo.id;
      state.repoName = data.repo.name;

      status.textContent = `✓ Connected: ${data.repo.name}`;
      showToast(`Connected to ${data.repo.name}`, "success");

      // Load timeline & files
      await Promise.all([loadTimeline(), loadFileTree()]);
    } catch (err) {
      status.classList.add("error");
      status.textContent = `✗ ${err.message}`;
      showToast(err.message, "error");
    } finally {
      btn.textContent = "Connect";
      btn.disabled = false;
    }
  });

  // Allow Enter key
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });
}

// ─── Timeline ─────────────────────────────────────────────────────────

async function loadTimeline() {
  if (!state.repoId) return;

  try {
    const res = await fetch(`${API}/history/${state.repoId}/timeline?maxCount=200`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    timeline.render(data);
  } catch (err) {
    showToast(`Timeline error: ${err.message}`, "error");
  }
}

function onCommitSelect(commit) {
  state.selectedCommit = commit;

  // Update topbar
  document.getElementById("commit-info").classList.remove("hidden");
  document.getElementById("commit-hash").textContent = commit.shortId || commit.shortHash;
  document.getElementById("commit-msg").textContent = commit.label || commit.message;

  // Load commit detail panel
  loadCommitDetail(commit.id || commit.hash);

  // Show panel
  document.getElementById("commit-panel").classList.remove("hidden");
}

// ─── Commit Detail Panel ──────────────────────────────────────────────

function setupCommitPanel() {
  document.getElementById("close-panel-btn").addEventListener("click", () => {
    document.getElementById("commit-panel").classList.add("hidden");
  });

  document.getElementById("explain-ai-btn").addEventListener("click", async () => {
    if (!state.selectedCommit) return;
    switchTab("ai");
    await triggerAIExplain(state.selectedCommit.id || state.selectedCommit.hash);
  });

  document.getElementById("view-diff-btn").addEventListener("click", async () => {
    if (!state.selectedCommit) return;
    switchTab("diff");
    await loadDiff(state.selectedCommit.id || state.selectedCommit.hash);
  });
}

async function loadCommitDetail(hash) {
  try {
    const res = await fetch(`${API}/commits/${state.repoId}/${hash}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    commitViewer.render(data);
  } catch (err) {
    console.error("Commit detail error:", err);
  }
}

// ─── File Tree ────────────────────────────────────────────────────────

async function loadFileTree() {
  if (!state.repoId) return;

  try {
    const res = await fetch(`${API}/repo/${state.repoId}/files`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderFileTree(data.files);
  } catch (err) {
    console.error("File tree error:", err);
  }
}

function renderFileTree(files) {
  const container = document.getElementById("file-tree");
  container.innerHTML = "";

  // Group into a simple tree
  const sorted = [...files].sort();

  for (const file of sorted) {
    const item = document.createElement("div");
    item.className = "file-tree-item";
    item.innerHTML = `<span class="icon">📄</span><span>${file}</span>`;
    item.title = file;
    item.addEventListener("click", () => {
      document.querySelectorAll(".file-tree-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      state.selectedFile = file;
    });
    container.appendChild(item);
  }
}

// ─── Diff Viewer ─────────────────────────────────────────────────────

async function loadDiff(hash) {
  if (!state.repoId) return;

  try {
    const res = await fetch(`${API}/commits/${state.repoId}/${hash}/diff`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Show file chips
    const header = document.getElementById("diff-header");
    const fileList = document.getElementById("diff-file-list");
    header.classList.remove("hidden");
    fileList.innerHTML = "";

    data.files.forEach((f, i) => {
      const chip = document.createElement("div");
      chip.className = `diff-file-chip ${i === 0 ? "active" : ""}`;
      chip.innerHTML = `${f.file} <span class="adds">+${f.additions}</span> <span class="dels">-${f.deletions}</span>`;
      chip.addEventListener("click", () => {
        document.querySelectorAll(".diff-file-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        // Re-render diff filtered to this file
        loadDiffForFile(hash, f.file);
      });
      fileList.appendChild(chip);
    });

    diffViewer.render(data.diff, data.files[0]?.file);
  } catch (err) {
    showToast(`Diff error: ${err.message}`, "error");
  }
}

async function loadDiffForFile(hash, filePath) {
  try {
    const res = await fetch(`${API}/commits/${state.repoId}/${hash}/diff?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    diffViewer.render(data.diff, filePath);
  } catch (err) {
    console.error("Diff file error:", err);
  }
}

// ─── Function Evolution ────────────────────────────────────────────────

function setupEvolutionControls() {
  document.getElementById("track-fn-btn").addEventListener("click", async () => {
    const file = document.getElementById("fn-file-input").value.trim();
    const fnName = document.getElementById("fn-name-input").value.trim();

    if (!state.repoId) return showToast("Connect a repo first", "error");
    if (!file || !fnName) return showToast("Enter file path and function name", "error");

    const container = document.getElementById("evolution-container");
    container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><div>Tracking "${fnName}" across commits…</div></div>`;

    try {
      const res = await fetch(`${API}/history/${state.repoId}/function?file=${encodeURIComponent(file)}&name=${encodeURIComponent(fnName)}&maxCommits=30`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      renderEvolution(data, container);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  });
}

function renderEvolution(data, container) {
  if (!data.evolution || !data.evolution.length) {
    container.innerHTML = `<div class="empty-state">Function "${data.function}" not found in ${data.file}</div>`;
    return;
  }

  const versions = data.evolution.filter((e) => e.status === "present");
  if (!versions.length) {
    container.innerHTML = `<div class="empty-state">Function not found at any commit</div>`;
    return;
  }

  let html = `
    <div style="margin-bottom:16px; color:var(--text2)">
      Found <strong style="color:var(--accent)">${data.totalVersions}</strong> version(s) of
      <code style="color:var(--accent2); background:rgba(56,189,248,0.1); padding:2px 6px; border-radius:4px">${data.function}</code>
      in <code>${data.file}</code>
    </div>
    <div class="evolution-timeline">
  `;

  for (const entry of versions) {
    const changed = entry.changed;
    html += `
      <div class="evolution-entry">
        <div class="evolution-entry-header">
          <span class="version-badge">v${entry.version}</span>
          ${changed ? '<span class="changed-badge">changed</span>' : ""}
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--accent2)">${entry.shortHash}</span>
          <span style="font-size:12px;color:var(--text2);flex:1">${entry.message}</span>
          <span style="font-size:11px;color:var(--text3)">${entry.author} · ${new Date(entry.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="evolution-code">
    `;

    if (entry.diff && changed) {
      for (const line of entry.diff.slice(0, 40)) {
        const cls = line.type === "+" ? "add" : line.type === "-" ? "remove" : "context";
        const escaped = escapeHtml(line.line || "");
        html += `<div class="diff-line ${cls}"><span class="diff-line-type">${line.type}</span><span>${escaped}</span></div>`;
      }
    } else if (entry.fn?.code) {
      html += `<pre style="color:var(--text2);font-size:12px;overflow-x:auto">${escapeHtml(entry.fn.code.slice(0, 800))}</pre>`;
    }

    html += `</div></div>`;
  }

  html += "</div>";
  container.innerHTML = html;
}

// ─── AI Explain ───────────────────────────────────────────────────────

async function triggerAIExplain(hash) {
  if (!state.repoId) return;
  aiExplainer.setLoading(true);

  try {
    // Trigger analysis job
    const triggerRes = await fetch(`${API}/analyze/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: state.repoId, hash }),
    });

    const job = await triggerRes.json();
    if (!triggerRes.ok) throw new Error(job.error);

    // Poll for result
    const result = await pollJob(job.jobId);
    aiExplainer.render(result);
  } catch (err) {
    aiExplainer.setError(err.message);
  }
}

async function pollJob(jobId, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(1000);
    const res = await fetch(`${API}/analyze/status/${jobId}`);
    const job = await res.json();
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || "Analysis failed");
  }
  throw new Error("Analysis timed out");
}

// ─── Utilities ────────────────────────────────────────────────────────

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { state, showToast };
