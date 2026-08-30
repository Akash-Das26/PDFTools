@echo off
setlocal

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is required. Install Node.js 20+ and pnpm 9+ first.
  exit /b 1
)

if not exist pnpm-workspace.yaml (
  echo Run this script from the PDF Tools repository root.
  echo Expected pnpm-workspace.yaml in the current directory.
  exit /b 1
)

if not exist lib\db\package.json (
  echo Run this script from the PDF Tools repository root.
  echo Expected lib\db\package.json in the current directory.
  exit /b 1
)

if not exist node_modules\.bin\esbuild (
  echo Installing dependencies...
  call pnpm install
  if errorlevel 1 exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example. Update DATABASE_URL before using the API.
)

call pnpm dev:local