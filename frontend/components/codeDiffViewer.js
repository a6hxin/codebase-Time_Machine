/**
 * codeDiffViewer.js
 * Monaco editor diff viewer for commit changes.
 */

export class CodeDiffViewer {
  constructor(container) {
    this.container = container;
    this.diffEditor = null;
    this.monacoReady = false;
    this._initMonaco();
  }

  _initMonaco() {
    if (typeof require === "undefined") return;

    require.config({
      paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs" },
    });

    require(["vs/editor/editor.main"], () => {
      this.monacoReady = true;
      monaco.editor.defineTheme("ctm-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [{ background: "090b0f" }],
        colors: {
          "editor.background": "#090b0f",
          "diffEditor.insertedTextBackground": "#00ffa310",
          "diffEditor.removedTextBackground": "#f8717110",
          "diffEditor.insertedLineBackground": "#00ffa308",
          "diffEditor.removedLineBackground": "#f8717108",
        },
      });

      this.diffEditor = monaco.editor.createDiffEditor(this.container, {
        theme: "ctm-dark",
        readOnly: true,
        automaticLayout: true,
        renderSideBySide: true,
        fontSize: 12,
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        diffWordWrap: "off",
      });

      // If content was queued before Monaco was ready
      if (this._pendingDiff) {
        this._applyDiff(this._pendingDiff.diff, this._pendingDiff.fileName);
        this._pendingDiff = null;
      }
    });
  }

  render(diffText, fileName = "") {
    if (!this.monacoReady || !this.diffEditor) {
      this._pendingDiff = { diff: diffText, fileName };
      return;
    }
    this._applyDiff(diffText, fileName);
  }

  _applyDiff(diffText, fileName) {
    if (!diffText) {
      this.container.innerHTML = `<div class="empty-state" style="height:100%">No diff available for this commit</div>`;
      return;
    }

    const { oldContent, newContent } = this._parseDiffToContents(diffText, fileName);
    const lang = this._detectLanguage(fileName);

    const original = monaco.editor.createModel(oldContent, lang);
    const modified = monaco.editor.createModel(newContent, lang);

    this.diffEditor.setModel({ original, modified });
  }

  /**
   * Extract old and new file contents from a unified diff.
   */
  _parseDiffToContents(diffText, targetFile = "") {
    const lines = diffText.split("\n");
    let inTargetFile = false;
    const oldLines = [];
    const newLines = [];
    let oldLineNo = 0;
    let newLineNo = 0;

    for (const line of lines) {
      // File header
      if (line.startsWith("diff --git")) {
        inTargetFile = !targetFile || line.includes(targetFile);
        continue;
      }

      if (!inTargetFile) continue;

      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) {
        if (line.startsWith("@@")) {
          // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
          const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (match) {
            // Fill gaps with empty lines to maintain line numbers
            while (oldLines.length < parseInt(match[1]) - 1) oldLines.push("");
            while (newLines.length < parseInt(match[2]) - 1) newLines.push("");
          }
        }
        continue;
      }

      if (line.startsWith("-")) {
        oldLines.push(line.slice(1));
      } else if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else {
        // Context line
        const content = line.startsWith(" ") ? line.slice(1) : line;
        oldLines.push(content);
        newLines.push(content);
      }
    }

    return {
      oldContent: oldLines.join("\n"),
      newContent: newLines.join("\n"),
    };
  }

  _detectLanguage(fileName = "") {
    const ext = fileName.split(".").pop().toLowerCase();
    const map = {
      js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
      py: "python", json: "json", md: "markdown", css: "css", html: "html",
      sh: "shell", yml: "yaml", yaml: "yaml", go: "go", rs: "rust",
    };
    return map[ext] || "plaintext";
  }

  setSideBySide(enabled) {
    if (this.diffEditor) {
      this.diffEditor.updateOptions({ renderSideBySide: enabled });
    }
  }

  dispose() {
    if (this.diffEditor) {
      this.diffEditor.dispose();
    }
  }
}
