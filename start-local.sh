#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Casino Aurelius — local quick-start (no Docker required)
# Requires: Node.js 18+ (https://nodejs.org)
# ─────────────────────────────────────────────────────────────
set -e

echo ""
echo "🎰  Casino Aurelius — Local Setup"
echo "────────────────────────────────────"

# ── 1. Check Node ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install it from https://nodejs.org then re-run this script."
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>&1 || true)
if node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null; then
  : # ok
else
  echo "❌  Node.js 18 or newer is required. Found: $(node -v)"
  exit 1
fi

echo "✅  Node.js $(node -v) detected"

# ── 2. Install dependencies ──────────────────────────────────
echo ""
echo "📦  Installing dependencies…"
npm install

# ── 3. Set up .env if missing ────────────────────────────────
if [ ! -f .env ]; then
  echo ""
  echo "⚙️   Creating .env file…"
  cat > .env <<'ENVEOF'
JWT_SECRET="casino-aurelius-local-change-me"
PORT=3000
ENVEOF
  echo "✅  .env created"
fi

# ── 4. Build TypeScript ──────────────────────────────────────
echo ""
echo "🔨  Building TypeScript…"
npm run build

# ── 5. Start the server ──────────────────────────────────────
echo ""
echo "────────────────────────────────────"
echo "🚀  Casino Aurelius is starting!"
echo "    Open → http://localhost:3000"
echo "    Press Ctrl+C to stop"
echo "────────────────────────────────────"
echo ""
node dist/server.js
