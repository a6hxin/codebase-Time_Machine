"""
explain_changes.py
Flask microservice — AI-powered commit and function explanation.
Run: python ai-engine/explain_changes.py
Listens on: http://localhost:5001
"""

import os
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key="")
MODEL = "llama3-8b-8192"
MAX_DIFF_CHARS = 3000

PROMPTS_DIR = Path(__file__).parent / "prompts"
EXPLANATION_PROMPT = (PROMPTS_DIR / "explanation_prompt.txt").read_text()


def truncate_diff(diff: str, max_chars: int = MAX_DIFF_CHARS) -> str:
    if len(diff) <= max_chars:
        return diff
    lines = diff.split("\n")
    changed = [l for l in lines if l.startswith(("+", "-", "@@", "diff"))]
    return "\n".join(changed)[:max_chars] + "\n... (truncated)"


def call_ai(system_prompt: str, user_prompt: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=1000,
    )
    return response.choices[0].message.content


def parse_json_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        cleaned = text.strip()
        if "```" in cleaned:
            parts = cleaned.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                try:
                    return json.loads(part)
                except:
                    continue
        raise ValueError(f"Could not parse JSON from: {text[:200]}")


def extract_commit_message(raw: str) -> str:
    if not raw:
        return "(no message)"
    for line in raw.split("\n"):
        line = line.strip()
        if line and not line.startswith(("commit ", "Author:", "Date:", "Merge:")):
            return line
    return "(no message)"


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL})


@app.route("/explain/commit", methods=["POST"])
def explain_commit():
    data = request.json
    if not data or "diff" not in data:
        return jsonify({"error": "diff is required"}), 400

    diff = truncate_diff(data.get("diff", ""))
    commit_msg = extract_commit_message(data.get("raw", ""))
    commit_hash = data.get("hash", "unknown")[:7]

    user_prompt = f"""Commit: {commit_hash}
Message: {commit_msg}

Diff:
{diff}

Reply ONLY with this JSON (no extra text):
{{
  "summary": "one sentence summary",
  "what": "what changed",
  "why": "why it changed",
  "impact": "what this affects",
  "type": "feature",
  "complexity": "low",
  "keywords": ["keyword1"],
  "riskLevel": "low",
  "riskReason": ""
}}"""

    try:
        result = call_ai("You are a code analyst. Reply ONLY with valid JSON.", user_prompt)
        parsed = parse_json_response(result)
        parsed["hash"] = data.get("hash", "")
        parsed["commitMessage"] = commit_msg
        return jsonify(parsed)
    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/explain/function", methods=["POST"])
def explain_function():
    data = request.json
    if not data or "functionName" not in data:
        return jsonify({"error": "functionName is required"}), 400

    try:
        result = call_ai(
            "You are a code analyst. Reply ONLY with valid JSON.",
            f"Explain evolution of function {data['functionName']}. Reply with JSON: {{\"summary\":\"...\",\"overallPattern\":\"...\",\"complexity\":\"...\",\"recommendation\":\"...\"}}"
        )
        parsed = parse_json_response(result)
        parsed["functionName"] = data["functionName"]
        return jsonify(parsed)
    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/detect/bug", methods=["POST"])
def detect_bug():
    return jsonify({"error": "Not implemented yet"}), 501


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", 5001))
    print(f"🤖 AI engine running on http://localhost:{port}")
    print(f"   Model: {MODEL}")
    app.run(host="0.0.0.0", port=port, debug=False)
