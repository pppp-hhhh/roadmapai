# AGENTS.md

## Project
Tauri 2 desktop: React 18+TS+Vite frontend + Rust+SQLite(sqx) backend. AI learning roadmap generator with spaced repetition flashcards.

## Commands
- `npm run tauri dev` — full dev (frontend+Rust)
- `npm run tauri build` — production bundle → .app / .dmg
- `npm run build` — frontend only (tsc+vite), no Rust
- `npm run dev` — Vite only, Rust commands fail
- `cargo check` — Rust lint, 0 warnings required

## Architecture (3-layer parallel generation)

```
Layer 1 (1 call): Outline → N stages + time estimates
Layer 2 (N calls): Stage skeleton → task titles + types  (并行 semaphore 6)
Layer 3 (M×N calls): Task content → content+code+exercise+resources+flashcards  (并行)
```

Each API call uses `call_ai()` which dispatches by `provider_type`:
- `"anthropic"` → `call_claude()` (direct Anthropic API)
- anything else → `call_openai_compatible()` (OpenAI-compatible / DeepSeek / MiniMax)

## Key Files
- `commands/roadmap.rs` — generate_roadmap + CRUD + retry_stage
- `services/ai.rs` — 3 prompt builders + AiProvider trait (for chat/settings)
- `services/roadmap_parser.rs` — tolerant JSON parser (3-tier: strict→extract→regex)
- `services/parallel.rs` — shared data structures
- `services/tavily.rs` — Tavily search integration

## Critical Notes
- `finish_reason=length` is non-fatal on Layer 1 (warn+continue), logged on other layers
- `.ok()` is NEVER used on call_ai — errors must be logged before fallback
- Layer 2 failure → empty task_outlines + StageDetail::fallback (not generic tasks)
- Layer 3 failure → regex fallback for content field, empty for rest
- Old `AiProvider` trait + `build_roadmap_prompt` are dead code but kept for chat/settings
- Vite strictPort=5173, kill with `lsof -ti:5173 | xargs kill -9`
- `cargo check` must be 0 warnings; `tsc --noEmit` must pass
- No tests, no CI. TypeScript strict mode on build.
