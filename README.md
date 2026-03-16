# ⏱ Codebase Time Machine

> See how your code evolved. Understand *why* it changed.

Connect any Git repo and watch your codebase's history come alive — with AI-powered explanations for every commit, a visual timeline, and function-level evolution tracking.
Preview Img: ![alt text](<assets/preview 1.png>) ![alt text](<assets/preview 2.png>)
---

## Features

- **Visual Timeline** — Scrollable commit history with type-color-coded nodes (feature/fix/refactor/etc.)
- **Function Evolution** — Track a single function across every commit that touched it
- **Monaco Diff Viewer** — Side-by-side diffs with full syntax highlighting
- **AI Commit Explanation** — GPT-4o-mini explains *what* changed, *why*, and the risk level
- **Bug Origin Detector** — Git blame + AI to find where a bug was introduced

---

## Quick Start

```bash
# 1. Clone this repo
git clone <this-repo>
cd codebase-time-machine

# 2. Run setup (installs Node + Python deps, creates .env)
bash scripts/setup.sh

# 3. Add your OpenAI key to .env
echo "OPENAI_API_KEY=sk-..." >> .env

# 4. Start the Node API (terminal 1)
npm run dev

# 5. Start the AI service (terminal 2)
python3 ai-engine/explain_changes.py

# 6. Open the frontend
open frontend/index.html
```

---

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

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/repo/connect` | Connect to a Git repo |
| GET | `/api/repo/:id` | Get repo metadata |
| GET | `/api/repo/:id/files` | List all files |
| GET | `/api/commits/:id` | List commits |
| GET | `/api/commits/:id/:hash` | Commit detail |
| GET | `/api/commits/:id/:hash/diff` | Commit diff |
| GET | `/api/history/:id/timeline` | Full timeline data |
| GET | `/api/history/:id/function` | Function evolution |
| POST | `/api/analyze/commit` | Start AI analysis |
| GET | `/api/analyze/status/:jobId` | Poll analysis status |

---

## Environment Variables

```env
PORT=3000
AI_SERVICE_URL=http://localhost:5001
OPENAI_API_KEY=your_key_here
REPOS_DIR=./data/repos
RESULTS_DIR=./data/analysis_results
```

---

## Tech Stack

- **Frontend**: Vanilla JS (ES modules), Monaco Editor, custom CSS
- **Backend**: Node.js, Express, simple-git, @babel/parser
- **AI Engine**: Python, Flask, OpenAI GPT-4o-mini, GitPython
- **Git Analysis**: simple-git, custom AST traversal

---

Built with ⏱ by your team.
