# mc-mod-converter-ai

Desktop assistant scaffold for **planning and previewing** Minecraft mod migrations (Electron + React + TypeScript).

This project is intentionally conservative:
- deterministic code rules are preview-first,
- backups/rollback are explicitly planned,
- AI output remains advisory,
- no claim of full automatic mod conversion.

---

## Features

### 1) Metadata + compatibility workflow
- Parses Forge `mods.toml`, Fabric `fabric.mod.json`, and legacy `mcmod.info`
- Scores likely compatibility and surfaces metadata-level issues

### 2) AI planning (still multi-provider)
- OpenAI (`/v1/responses`)
- Anthropic (`/v1/messages`)
- Gemini (`generateContent`)

### 3) Deterministic transformation rules engine (new)
- Fixed, deterministic rule ordering
- Preview mode (default recommended)
- Apply mode for transformed output payloads
- Backup/rollback support **design contract** included in output manifest:
  - manifest ID
  - backup strategy
  - rollback instructions

> Current rules are regex-based and intentionally narrow (common Forge↔Fabric + version migration hints). They are not AST-safe refactors.

### 4) OpenAI OAuth + secure local persistence (new)
- Device-flow helpers for OpenAI OAuth endpoints (client_id required)
- Browser-assisted verification launch
- Local secret persistence abstraction via Electron `safeStorage` when available
- Fallback to plain JSON if OS encryption is unavailable

### 5) CI for Windows artifacts (new)
- GitHub Actions workflow: `.github/workflows/windows-build.yml`
- Runs typecheck/build and emits NSIS artifacts

---

## Run locally

```bash
npm install
npm run dev
```

## Typecheck + build

```bash
npm run typecheck
npm run build
```

## Build Windows installer locally

```bash
npm run dist:win
```

Artifacts are placed in `dist/`.

---

## UI usage guide

### Metadata and planning
1. Paste or load metadata text in Forge/Fabric panels
2. Set source/target loader + target MC version
3. Parse metadata
4. Analyze compatibility
5. Generate AI migration plan

### Credential handling
- Enter API key/token in credential field
- Use **Save Credential** to persist locally
- Use **Load Stored Credential** / **Clear Stored Credential** as needed

### OpenAI device OAuth (practical flow)
1. Enter your OpenAI OAuth `client_id`
2. Click **Start OpenAI Device Flow** (app opens verification URL)
3. Complete verification in browser
4. Click **Poll Device Token**
5. Token is auto-saved in local secret store

### Deterministic rules engine
1. Paste source code into the rules input panel
2. Click **Preview Rules** first
3. Inspect rule order, hashes, before/after snippets, backup manifest
4. Optionally click **Apply Rules** to update editor content

---

## GitHub Actions CI (Windows build)

Workflow file: `.github/workflows/windows-build.yml`

Behavior:
- Trigger: push/PR/manual
- Runner: `windows-latest`
- Steps:
  - `npm ci`
  - `npm run typecheck`
  - `npm run build`
  - `npm run dist:win`
  - upload `dist/*.exe`, `dist/*.yml`, `dist/win-unpacked/**`

---

## Important limitations

- Not a one-click guaranteed converter
- Rules engine is deterministic but regex-based (not semantic Java/Kotlin transforms)
- No project-wide filesystem rewrite pipeline yet (engine currently transforms provided file payloads)
- OAuth device flow depends on endpoint/client availability and may require provider-side configuration
- Secret storage uses `safeStorage` when available; otherwise plaintext fallback is used in app data
- No automatic runtime/game launch verification yet

---

## Project structure

- `electron/main.ts` – window + IPC wiring
- `electron/tokenStore.ts` – local secret persistence abstraction
- `electron/openaiOAuth.ts` – OpenAI device-flow helpers
- `src/lib/parsers/` – metadata parsing
- `src/lib/analysis/` – compatibility scoring
- `src/lib/ai/` – AI provider clients
- `src/lib/transform/rulesEngine.ts` – deterministic migration rules engine
- `src/App.tsx` – UI for metadata, OAuth, credential store, rules preview/apply
