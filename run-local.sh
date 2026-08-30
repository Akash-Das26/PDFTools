#!/usr/bin/env sh
set -eu

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install Node.js 20+ and pnpm 9+ first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update DATABASE_URL before using the API."
fi

pnpm dev:local