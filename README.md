# ⏱ Codebase Time Machine

See how your code evolved. Understand *why* it changed.

Connect any Git repo and watch your codebase's history come alive — with AI-powered explanations for every commit, a visual timeline, and function-level evolution tracking.
Preview Img: ![alt text](<assets/preview 1.png>) ![alt text](<assets/preview 2.png>)
---

## Features

1. Visual Timeline — Scrollable commit history with type-color-coded nodes (feature/fix/refactor/etc.)
2. Function Evolution — Track a single function across every commit that touched it
3. Monaco Diff Viewer — Side-by-side diffs with full syntax highlighting
4. AI Commit Explanation — GPT-4o-mini explains what changed, why, and the risk level
4. Bug Origin Detector — Git blame + AI to find where a bug was introduced


## Project Structure

```
codebase-time-machine/
├── frontend/               # Browser UI
│   ├── index.html
│   ├── style.css
│   ├── app.js              # App bootstrap & state
│   └── components/
│       ├── timeline.js     # Visual commit timeline
│       ├── commitViewer.js # Commit detail panel
│       ├── codeDiffViewer.js  # Monaco diff editor
│       └── aiExplanation.js   # AI result panel
│
├── backend/                # Node.js API (Express)
│   ├── server.js
│   ├── routes/
│   │   ├── repo.js         # Connect/clone repos
│   │   ├── commits.js      # Commit list & details
│   │   ├── history.js      # Timeline & function history
│   │   └── analyze.js      # AI job queue
│   ├── services/
│   │   ├── gitService.js   # Git operations wrapper
│   │   ├── diffAnalyzer.js # Function-level diff
│   │   └── timelineGenerator.js
│   └── utils/
│       ├── fileParser.js   # AST function extraction
│       └── commitParser.js # Git log parser
│
├── ai-engine/              # Python AI microservice
│   ├── explain_changes.py  # Flask API + OpenAI calls
│   ├── bug_origin_detector.py
│   └── prompts/
│       └── explanation_prompt.txt
│
├── git-analyzer/           # Git analysis utilities
│   ├── repo_cloner.js
│   ├── commit_tracker.js
│   └── function_evolution.js  # Core: tracks 1 function across N commits
│
├── data/
│   ├── repos/              # Cloned repos stored here
│   └── analysis_results/   # Cached AI results
│
├── scripts/
│   └── setup.sh
├── package.json
└── requirements.txt
```
## Tech Stack

1. Frontend: Vanilla JS (ES modules), Monaco Editor, custom CSS
2. Backend: Node.js, Express, simple-git, @babel/parser
3. AI Engine: Python, Flask, OpenAI GPT-4o-mini, GitPython
4. Git Analysis: simple-git, custom AST traversal

