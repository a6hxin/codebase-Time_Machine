/**
 * timeline.js
 * Visual commit timeline component.
 * Renders a scrollable list of commits with type-color-coded dots.
 */

export class Timeline {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.data = null;
    this.selectedHash = null;
  }

  render(timelineData) {
    this.data = timelineData;
    this.container.innerHTML = "";

    if (!timelineData || !timelineData.nodes || !timelineData.nodes.length) {
      this.container.innerHTML = `<div class="empty-state large"><div class="empty-icon">⏱</div><div>No commits found</div></div>`;
      return;
    }

    // Header with stats
    this.container.appendChild(this._buildHeader(timelineData));

    // Timeline track
    const track = document.createElement("div");
    track.className = "timeline-track";

    // Vertical line
    const line = document.createElement("div");
    line.className = "timeline-line";
    track.appendChild(line);

    // Commit nodes (reverse = newest first)
    const nodes = [...timelineData.nodes].reverse();
    for (const node of nodes) {
      track.appendChild(this._buildNode(node));
    }

    this.container.appendChild(track);
  }

  _buildHeader(data) {
    const stats = data.stats || {};
    const header = document.createElement("div");
    header.className = "timeline-header";

    header.innerHTML = `
      <div style="font-size:16px; font-weight:700; color:var(--text)">
        Commit History
        <span style="font-size:12px; color:var(--text3); font-weight:400; margin-left:8px">
          ${data.totalCommits} commits
        </span>
      </div>
      <div class="timeline-stats">
        ${this._statItem(data.totalCommits, "Commits")}
        ${this._statItem(stats.authors?.length || 0, "Authors")}
        ${this._statItem(stats.daySpan || 0, "Days")}
        ${this._statItem(stats.totalInsertions || 0, "Lines Added")}
      </div>
    `;

    return header;
  }

  _statItem(value, label) {
    return `
      <div class="stat-item">
        <div class="stat-value">${value?.toLocaleString()}</div>
        <div class="stat-label">${label}</div>
      </div>
    `;
  }

  _buildNode(node) {
    const wrapper = document.createElement("div");
    wrapper.className = "commit-node";
    wrapper.dataset.hash = node.id;

    const dot = document.createElement("div");
    dot.className = `commit-dot ${node.type || "other"}`;
    if (node.id === this.selectedHash) dot.classList.add("selected");

    const card = document.createElement("div");
    card.className = "commit-card";

    const date = node.date ? new Date(node.timestamp).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }) : "";

    const sizeColor = { sm: "var(--text3)", md: "var(--accent3)", lg: "var(--orange)", xl: "var(--red)" };
    const churnColor = sizeColor[node.size] || "var(--text3)";

    card.innerHTML = `
      <div class="commit-card-top">
        <span class="commit-type-tag ${node.type || "other"}">${node.type || "other"}</span>
        <span class="commit-message">${this._escapeHtml(node.label || "(no message)")}</span>
      </div>
      <div class="commit-meta">
        <span class="commit-hash-small">${node.shortId}</span>
        <span>${this._escapeHtml(node.author || "")}</span>
        <span>${date}</span>
        ${node.insertions || node.deletions
          ? `<span class="commit-files-changed" style="color:${churnColor}">
               +${node.insertions || 0} -${node.deletions || 0}
             </span>`
          : ""}
        ${node.filesChanged?.length
          ? `<span style="color:var(--text3)">${node.filesChanged.length} file${node.filesChanged.length !== 1 ? "s" : ""}</span>`
          : ""}
      </div>
    `;

    wrapper.appendChild(dot);
    wrapper.appendChild(card);

    wrapper.addEventListener("click", () => {
      // Deselect previous
      document.querySelectorAll(".commit-dot.selected").forEach((d) => d.classList.remove("selected"));
      dot.classList.add("selected");
      this.selectedHash = node.id;
      this.onSelect(node);
    });

    return wrapper;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  selectCommit(hash) {
    this.selectedHash = hash;
    document.querySelectorAll(".commit-dot").forEach((d) => d.classList.remove("selected"));
    const node = document.querySelector(`.commit-node[data-hash="${hash}"] .commit-dot`);
    if (node) node.classList.add("selected");
  }

  filter(query) {
    const q = query.toLowerCase();
    document.querySelectorAll(".commit-node").forEach((n) => {
      const text = n.textContent.toLowerCase();
      n.style.display = !q || text.includes(q) ? "" : "none";
    });
  }
}
