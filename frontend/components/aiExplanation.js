/**
 * aiExplanation.js
 * Renders AI-generated commit explanations in the AI tab.
 */

export class AIExplanation {
  constructor(container) {
    this.container = container;
  }

  setLoading(active) {
    if (active) {
      this.container.innerHTML = `
        <div class="ai-loading">
          <div class="spinner"></div>
          <div>Analyzing commit with AI…</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">This may take 5–10 seconds</div>
        </div>
      `;
    }
  }

  setError(message) {
    this.container.innerHTML = `
      <div class="ai-result">
        <div class="ai-result-header" style="background:rgba(248,113,113,0.05)">
          <span>❌</span>
          <span class="ai-summary" style="color:var(--red)">Analysis failed</span>
        </div>
        <div class="ai-body">
          <p style="color:var(--text2)">${this._escape(message)}</p>
          <p style="color:var(--text3);font-size:12px">Make sure the AI service is running: <code>python3 ai-engine/explain_changes.py</code></p>
        </div>
      </div>
    `;
  }

  render(data) {
    if (!data || data.error) {
      this.setError(data?.error || "No data returned");
      return;
    }

    const riskClass = `risk-${data.riskLevel || "low"}`;
    const typeColor = this._typeColor(data.type);

    this.container.innerHTML = `
      <div class="ai-result">

        <div class="ai-result-header">
          <span style="font-size:18px">🤖</span>
          <div style="flex:1">
            <div class="ai-summary">${this._escape(data.summary || "")}</div>
            <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
              <span style="font-size:11px;padding:2px 8px;border-radius:3px;background:${typeColor.bg};color:${typeColor.fg};font-weight:700;text-transform:uppercase;letter-spacing:1px">
                ${data.type || "unknown"}
              </span>
              <span class="risk-badge ${riskClass}">
                ${data.riskLevel || "low"} risk
              </span>
              <span style="font-size:11px;color:var(--text3)">
                ${data.complexity || ""} complexity
              </span>
            </div>
          </div>
        </div>

        <div class="ai-body">

          ${data.what ? `
          <div class="ai-section">
            <label>What Changed</label>
            <p>${this._escape(data.what)}</p>
          </div>` : ""}

          ${data.why ? `
          <div class="ai-section">
            <label>Why It Changed</label>
            <p>${this._escape(data.why)}</p>
          </div>` : ""}

          ${data.impact ? `
          <div class="ai-section">
            <label>Impact</label>
            <p>${this._escape(data.impact)}</p>
          </div>` : ""}

          ${data.riskReason && data.riskLevel !== "low" ? `
          <div class="ai-section" style="padding:12px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.15);border-radius:6px">
            <label style="color:var(--accent3)">⚠ Risk Note</label>
            <p>${this._escape(data.riskReason)}</p>
          </div>` : ""}

          ${data.keywords && data.keywords.length ? `
          <div class="ai-section">
            <label>Keywords</label>
            <div class="ai-tags">
              ${data.keywords.map((k) => `<span class="ai-tag">${this._escape(k)}</span>`).join("")}
            </div>
          </div>` : ""}

          ${data.commitMessage ? `
          <div class="ai-section" style="border-top:1px solid var(--border);padding-top:12px">
            <label>Original Commit Message</label>
            <p style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">${this._escape(data.commitMessage)}</p>
          </div>` : ""}

        </div>
      </div>
    `;
  }

  _typeColor(type) {
    const map = {
      feature: { bg: "rgba(0,255,163,0.1)", fg: "var(--accent)" },
      fix: { bg: "rgba(248,113,113,0.1)", fg: "var(--red)" },
      refactor: { bg: "rgba(167,139,250,0.1)", fg: "var(--purple)" },
      docs: { bg: "rgba(56,189,248,0.1)", fg: "var(--accent2)" },
      test: { bg: "rgba(251,191,36,0.1)", fg: "var(--accent3)" },
      chore: { bg: "rgba(71,85,105,0.2)", fg: "var(--text3)" },
      style: { bg: "rgba(251,191,36,0.1)", fg: "var(--accent3)" },
    };
    return map[type] || map.chore;
  }

  _escape(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
