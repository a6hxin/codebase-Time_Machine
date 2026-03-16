/**
 * commitViewer.js
 * Renders commit detail metadata in the right-hand panel.
 */

export class CommitViewer {
  constructor(container) {
    this.container = container;
  }

  render(data) {
    const { commit, files } = data;
    if (!commit) {
      this.container.innerHTML = `<div class="empty-state">No commit data</div>`;
      return;
    }

    this.container.innerHTML = `
      ${this._row("Hash", `<span class="mono">${commit.hash || ""}</span>`)}
      ${this._row("Author", this._escapeHtml(commit.author || ""))}
      ${this._row("Date", new Date(commit.timestamp || 0).toLocaleString())}
      ${this._row("Message", this._escapeHtml(commit.message || "(no message)"))}
      ${commit.body ? this._row("Body", `<pre style="font-size:11px;color:var(--text3);white-space:pre-wrap">${this._escapeHtml(commit.body)}</pre>`) : ""}
      ${files && files.length ? this._fileList(files) : ""}
    `;
  }

  _row(label, value) {
    return `
      <div class="detail-row">
        <label>${label}</label>
        <div class="value">${value}</div>
      </div>
    `;
  }

  _fileList(files) {
    const items = files
      .slice(0, 20)
      .map(
        (f) => `
        <li class="file-change-item">
          <span>📄</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._escapeHtml(f.file)}</span>
          <span class="adds">+${f.additions}</span>
          <span class="dels">-${f.deletions}</span>
        </li>`
      )
      .join("");

    return `
      <div class="detail-row">
        <label>Changed Files (${files.length})</label>
        <ul class="file-change-list">${items}</ul>
        ${files.length > 20 ? `<div style="color:var(--text3);font-size:11px;margin-top:4px">+${files.length - 20} more</div>` : ""}
      </div>
    `;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
