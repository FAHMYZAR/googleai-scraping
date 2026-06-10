# `api-fahmyzzx` Agent Instructions

## Architecture & Entrypoints
- Unified server design using **Bun (port 9876)**.
- Entrypoint: `bun run src/index.ts`.
- Architecture consists of Hono routing in `src/index.ts` and background worker subprocesses for browser/webview operations (`src/webview/ipcRunner.ts`).
- Secrets (like Bearer tokens) configured via `.env` (key: `PROVIDER_API_KEY`). All endpoints except `/health` require it.
- State (`cookies.json`, `moodle_cookies.json`) written to `data/` directory.

## Commands & Setup
- Start server: `bun run src/index.ts`
- Clean TypeScript check: `bunx tsc --noEmit`
