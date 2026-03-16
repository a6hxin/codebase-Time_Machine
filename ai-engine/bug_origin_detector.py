"""
bug_origin_detector.py
Detects when and where a bug was introduced using git blame + AI analysis.
Can be called directly or via the Flask explain_changes.py service.
"""

import os
import re
import json
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"


def detect_bug_origin(blame_output: str, file_path: str, line_number: int = None,
                       description: str = None) -> dict:
    """
    Analyze git blame output to find where a bug was likely introduced.

    Args:
        blame_output: Raw git blame -l output
        file_path: The file being analyzed
        line_number: Optional specific line number to focus on
        description: Optional description of the bug

    Returns:
        dict with origin analysis
    """
    parsed_blame = parse_blame(blame_output)
    suspects = find_suspects(parsed_blame, line_number)

    if not suspects:
        return {"error": "No blame data found", "suspects": []}

    # Build context for AI
    suspect_context = format_suspects_for_ai(suspects[:10])
    bug_desc = description or "A bug exists in this code"

    system_prompt = """You are a git forensics expert. Analyze git blame data to identify when a bug was likely introduced.

Respond with JSON:
{
  "mostLikelyOrigin": {
    "hash": "short commit hash",
    "author": "name",
    "date": "date string",
    "message": "commit message",
    "confidence": "high|medium|low",
    "reasoning": "Why this commit likely introduced the bug"
  },
  "alternativeSuspects": [
    {
      "hash": "...",
      "author": "...",
      "date": "...",
      "message": "...",
      "reasoning": "..."
    }
  ],
  "pattern": "What pattern of change likely caused the bug (e.g. 'off-by-one in refactor', 'missing null check', 'race condition introduced')",
  "fixSuggestion": "Brief suggestion for how to fix it",
  "affectedLines": [1, 2, 3]
}"""

    user_prompt = f"""File: {file_path}
{f"Focus line: {line_number}" if line_number else ""}
Bug description: {bug_desc}

Git blame data (most recent changes first):
{suspect_context}

Identify when this bug was most likely introduced."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        result["rawSuspects"] = suspects[:5]
        return result
    except Exception as e:
        return {"error": str(e), "rawSuspects": suspects}


def parse_blame(blame_output: str) -> list:
    """
    Parse git blame -l output into structured line entries.
    Format: <hash> (<author> <date> <line_no>) <content>
    """
    lines = []
    pattern = re.compile(
        r'^([a-f0-9]+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2}[^\)]*)\s+(\d+)\)\s(.*)$'
    )

    for line in blame_output.strip().split("\n"):
        m = pattern.match(line)
        if m:
            lines.append({
                "hash": m.group(1)[:7],
                "fullHash": m.group(1),
                "author": m.group(2).strip(),
                "date": m.group(3).strip(),
                "lineNumber": int(m.group(4)),
                "content": m.group(5),
            })

    return lines


def find_suspects(parsed_blame: list, focus_line: int = None) -> list:
    """
    Find the most recently changed lines — likely bug introduction points.
    If focus_line given, prioritize nearby lines.
    """
    if not parsed_blame:
        return []

    # Group by commit
    by_commit = {}
    for entry in parsed_blame:
        h = entry["hash"]
        if h not in by_commit:
            by_commit[h] = {
                "hash": h,
                "fullHash": entry["fullHash"],
                "author": entry["author"],
                "date": entry["date"],
                "lines": [],
                "lineNumbers": [],
            }
        by_commit[h]["lines"].append(entry["content"])
        by_commit[h]["lineNumbers"].append(entry["lineNumber"])

    suspects = list(by_commit.values())

    # Sort by recency (most recent first) — use date string comparison as fallback
    suspects.sort(key=lambda x: x["date"], reverse=True)

    # If focus_line given, boost commits that touched nearby lines
    if focus_line:
        for s in suspects:
            s["proximity"] = min(abs(ln - focus_line) for ln in s["lineNumbers"])
        suspects.sort(key=lambda x: (x["proximity"], x["date"]))

    return suspects


def format_suspects_for_ai(suspects: list) -> str:
    """Format suspect commits into a readable string for the AI prompt."""
    parts = []
    for s in suspects:
        lines_preview = "\n".join(s["lines"][:3])
        parts.append(
            f"Commit {s['hash']} by {s['author']} on {s['date']}\n"
            f"Touched lines: {s['lineNumbers'][:5]}\n"
            f"Code:\n{lines_preview}"
        )
    return "\n\n---\n\n".join(parts)


# ─── Flask route registration (called from explain_changes.py) ──────

def register_routes(app, flask_client=None):
    """Register bug detection routes on the Flask app."""
    from flask import request, jsonify

    @app.route("/detect/bug", methods=["POST"])
    def detect_bug():
        data = request.json
        if not data or "blame" not in data:
            return jsonify({"error": "blame output is required"}), 400

        result = detect_bug_origin(
            blame_output=data["blame"],
            file_path=data.get("file", "unknown"),
            line_number=data.get("lineNumber"),
            description=data.get("description"),
        )
        return jsonify(result)


# ─── CLI usage ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import subprocess

    if len(sys.argv) < 3:
        print("Usage: python3 bug_origin_detector.py <repo_path> <file_path> [line_number]")
        sys.exit(1)

    repo_path = sys.argv[1]
    file_path = sys.argv[2]
    line_no = int(sys.argv[3]) if len(sys.argv) > 3 else None

    print(f"Running git blame on {file_path}...")
    blame = subprocess.check_output(
        ["git", "blame", "-l", file_path],
        cwd=repo_path,
        text=True,
    )

    result = detect_bug_origin(blame, file_path, line_no)
    print(json.dumps(result, indent=2))
