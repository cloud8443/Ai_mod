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
- Uses semantic version-range parsing (Maven + semver-style ranges) for MC and dependency checks
- Detects dependency missing/conflict scenarios across parsed mods
- Produces confidence scoring with explainable factors and matched migration knowledge IDs

### 2) AI planning (still multi-provider)
- OpenAI (`/v1/responses`)
- Anthropic (`/v1/messages`)
- Gemini (`generateContent`)

### 3) Deterministic + AST-aware transformation pipeline (phase 2)
- Fixed, deterministic rule ordering
- Rule selection is version-aware + loader-aware with per-rule confidence
- **AST-aware Java scaffold** (parser-validated) runs first for conservative mappings:
  - import renames
  - class identifier renames
  - selected method/constructor migration patterns
- Preview mode (default recommended)
- Apply mode for transformed output payloads
- Returns selected/skipped rule reasons and matched migration knowledge IDs
- Backup/rollback support **design contract** included in output manifest:
  - manifest ID
  - backup strategy
  - rollback instructions

Mapping datasets are expandable JSON sources in:
- `src/lib/transform/mappings/imports.json`
- `src/lib/transform/mappings/classes.json`
- `src/lib/transform/mappings/methods.json`

Generated runtime mapping module:
- `src/lib/transform/generatedMappings.ts`

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

## Typecheck + build + tests

```bash
npm run typecheck
npm run build
npm test
```

## Mapping dataset + regression commands

```bash
# regenerate src/lib/transform/generatedMappings.ts from JSON datasets
npm run dataset:refresh

# build electron lib + run all node regression tests
npm run test:regression
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

### Terminal log panel (new)
- The **Terminal** panel shows step-by-step app activity with timestamp + level (`INFO`, `SUCCESS`, `WARN`, `ERROR`, `DEBUG`)
- Major actions are logged, including:
  - metadata parse
  - compatibility analyze
  - AI plan generation
  - OpenAI OAuth start + poll
  - deterministic rules preview + apply
- Use **Clear Logs** to reset the in-memory renderer log stream

### Credential handling
- Enter API key/token in credential field
- Use **Save Credential** to persist locally
- Use **Load Stored Credential** / **Clear Stored Credential** as needed

### Settings panel (new)
Open via the **Settings** button in the top-right.

Available toggles:
- **Show terminal panel**
- **Auto-scroll terminal**
- **Clear logs on app start**
- **Verbose logging** (enables debug-level log lines)

Quick controls:
- **Hide Terminal / Show Terminal** button beside Settings for one-click visibility toggle

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

## GitHub Actions CI (Windows build artifact)

Workflow file: `.github/workflows/windows-build.yml`

Behavior:
- Trigger: push/PR/manual (`workflow_dispatch`)
- Runner: `windows-latest`
- Steps:
  - `npm ci`
  - `npm run typecheck`
  - `npm run build`
  - `npm run dist:win`
  - generate SHA256 checksums for installer artifacts
  - upload `dist/*.exe`, `dist/*.yml`, `dist/*.sha256`, `dist/win-unpacked/**`

### Download artifact from GitHub Actions
1. Push branch to GitHub (or manually run workflow from **Actions → Windows Build → Run workflow**).
2. Open the finished workflow run.
3. In **Artifacts**, download `mc-mod-converter-ai-windows`.
4. Unzip and verify checksum (PowerShell example):
   ```powershell
   Get-FileHash .\"MC Mod Converter AI Setup *.exe" -Algorithm SHA256
   Get-Content .\"MC Mod Converter AI Setup *.exe.sha256"
   ```

---

## Important limitations

- Not a one-click guaranteed converter
- Knowledge base is representative (old/mid/latest ranges) and not exhaustive for every mod ecosystem edge-case
- Semantic range parsing improves metadata checks, but malformed/non-standard metadata can still reduce accuracy
- Rules engine is deterministic but regex-based (not semantic Java/Kotlin transforms)
- Rule confidence is heuristic and should be treated as guidance, not proof of correctness
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
- `src/lib/analysis/` – compatibility scoring + confidence factors
- `src/lib/knowledge/migrationKnowledge.ts` – versioned migration KB + loader API rename mappings
- `src/lib/ai/` – AI provider clients
- `src/lib/transform/javaAstTransform.ts` – parser-validated Java transform scaffold
- `src/lib/transform/mappings/*.json` – editable mapping dataset sources
- `src/lib/transform/generatedMappings.ts` – generated mapping module used at runtime
- `src/lib/transform/rulesEngine.ts` – deterministic migration rules engine
- `tests/fixtures/regression/` – Java regression fixtures for transform output
- `src/App.tsx` – UI for metadata, OAuth, credential store, rules preview/apply
