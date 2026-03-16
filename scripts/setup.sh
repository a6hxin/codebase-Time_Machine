#!/bin/bash
set -e

echo "🕰️  Setting up Codebase Time Machine..."

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
  echo "❌ Python 3 not found. Install from https://python.org"
  exit 1
fi

# Check Git
if ! command -v git &> /dev/null; then
  echo "❌ Git not found. Install Git first."
  exit 1
fi

echo "✅ Dependencies found."

# Create .env if not exists
if [ ! -f .env ]; then
  cat > .env <<EOF
PORT=3000
AI_SERVICE_URL=http://localhost:5001
OPENAI_API_KEY=your_openai_api_key_here
REPOS_DIR=./data/repos
RESULTS_DIR=./data/analysis_results
EOF
  echo "✅ .env file created — add your OpenAI API key!"
fi

# Install Node deps
echo "📦 Installing Node packages..."
npm install

# Install Python deps
echo "🐍 Installing Python packages..."
pip3 install -r requirements.txt

# Create data dirs
mkdir -p data/repos data/analysis_results

echo ""
echo "🚀 Setup complete!"
echo "   1. Add your OpenAI API key to .env"
echo "   2. Run: npm run dev        (starts Node API on port 3000)"
echo "   3. Run: python3 ai-engine/explain_changes.py   (starts AI service on port 5001)"
echo "   4. Open frontend/index.html in your browser"
