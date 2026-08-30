# PDF Tools

A browser-based PDF toolkit with real PDF processing, AI summarization, text
extraction, and page numbering.

## Run locally

### Requirements

- Node.js 20 or newer
- pnpm 10 (the repository pins pnpm 10.26.1)
- PostgreSQL 14 or newer

### Setup

```bash
pnpm install
cp .env.example .env
```

Update `DATABASE_URL` in `.env` with a local PostgreSQL connection string. Then
create the database tables:

```bash
pnpm --filter @workspace/db run push
```

Start the frontend and API server together:

```bash
pnpm dev:local
```

Open http://localhost:5173.

If you prefer a one-command start after cloning, use `./run-local.sh` on
macOS/Linux or `run-local.bat` on Windows. These launchers install dependencies
on the first run (or repair a partial install) and create `.env` from
`.env.example`.

The local launcher reads `.env`, starts the API on port `8080`, starts the Vite
frontend on port `5173`, and proxies `/api` requests to the API server. Set
`WEB_PORT` or `API_PORT` in `.env` to use different ports.

`OPENAI_API_KEY` is optional. Without it, the standard PDF tools still work but
the AI summarizer cannot call the model.

## Run services separately

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ API_PORT=8080 pnpm --filter @workspace/pdftools run dev
```

## Production build

```bash
pnpm build
```

## GitHub checkout

The repository root is the runnable project. After cloning it from GitHub:

```bash
git clone <repository-url>
cd <repository-directory>
pnpm install
cp .env.example .env
pnpm --filter @workspace/db run push
pnpm dev:local
```