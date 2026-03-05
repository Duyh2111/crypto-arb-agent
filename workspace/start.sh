#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Env validation ────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "❌ .env file not found. Copy .env.example and fill in your values."
  exit 1
fi

source .env

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — alerts disabled"
fi

# ── Dependency check ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install Node 18+."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "❌ Node.js 18+ required (found v$NODE_MAJOR)"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# ── Launch ────────────────────────────────────────────────────────────────────
mkdir -p logs reports/daily

LOG_FILE="logs/scheduler-$(date +%Y-%m-%d).log"
echo "🚀 Starting scheduler... (log: $LOG_FILE)"
exec node scheduler.js 2>&1 | tee -a "$LOG_FILE"
