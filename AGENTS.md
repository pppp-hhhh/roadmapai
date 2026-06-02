# AGENTS.md

## Project overview
Tauri 2 desktop app: React 18 + TypeScript + Vite frontend, Rust backend with SQLite (sqlx). AI-powered learning roadmap generator.

## Commands

| Task | Command |
|---|---|
| Frontend dev only (no backend) | `npm run dev` |
| Full Tauri app (frontend + Rust + native window) | `npm run tauri dev` |
| Production build (frontend type-check first) | `npm run build` |
| Production Tauri bundle | `npm run tauri build` |
| Preview built frontend | `npm run preview` |

## Architecture

- **Frontend** (`src/`): React SPA with React Router, Zustand stores, Tailwind CSS
- **Backend** (`src-tauri/`): Rust — SQLite via sqlx, reqwest for AI APIs, tokio async runtime
- **All data access goes through Tauri commands** — the frontend never touches the database directly
- Tauri commands are registered in `src-tauri/src/lib.rs` and implemented under `src-tauri/src/commands/`

## Key quirks

- **`npm run dev` runs Vite only** — no Rust backend, no database. Tauri commands will fail. Use `npm run tauri dev` for the real app.
- **Vite uses strict port 5173** (`strictPort: true` in config) — fails if port is in use.
- **No tests, no linter, no CI** in this repo. TypeScript `strict` + `noUnusedLocals`/`noUnusedParameters` enforced at build time via `tsc` in the `build` script.
- **API keys are configured at runtime** in Settings UI, not via `.env` files.
- **Production builds**: `sourcemap: false`, Rust LTO enabled, codegen-units=1.
- **Windows subsystem** on release builds (`#![windows_subsystem = "windows"]` in main.rs) — no console window.
