# mc-mod-converter-ai

Desktop assistant scaffold for **planning and previewing** Minecraft mod upgrades (Electron + React + TypeScript).

## Scope (important)

This build only supports **same-loader version migration**:
- Forge -> Forge ✅
- Fabric -> Fabric ✅
- Forge -> Fabric ❌
- Fabric -> Forge ❌

Cross-loader conversion is intentionally blocked in analyzer/rules/UI/prompts.

---

## Key features

1) **Beginner-friendly wizard UI**
- Step-by-step flow (setup -> parse/check -> AI login/plan -> rules preview)
- Simpler labels, safer defaults
- Optional terminal panel (off by default)

2) **Metadata + compatibility workflow**
- Parses Forge `mods.toml`, Fabric `fabric.mod.json`, and legacy `mcmod.info`
- Semantic version-range checks for MC and dependencies
- Explainable score + confidence factors + matched migration knowledge IDs

3) **AI planning**
- OpenAI / Anthropic / Gemini clients remain available
- Prompt now enforces same-loader upgrade scope

4) **Deterministic + AST-aware transform pipeline**
- Deterministic rule ordering
- Version-aware rule selection
- Preview-first workflow, apply optional
- Rollback guidance in backup manifest contract

5) **OpenAI OAuth (link-based approval UX)**
- Generate authorization URL in app
- User opens link and approves in browser
- Paste callback URL or auth code to complete login quickly
- Token persisted locally via secure storage abstraction

6) **i18n (English + Korean)**
- Language switch in Settings
- Core wizard/OAuth/logging UI translated

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

## Regression/dataset helpers

```bash
npm run dataset:refresh
npm run test:regression
```

---

## OAuth quick flow (link-based)

1. Enter OpenAI OAuth `client_id`
2. (Optional) adjust redirect URI
3. Click **Generate approval link**
4. Open link, approve access in browser
5. Paste callback URL or code into app
6. Click **Complete login**

---

## Project structure

- `src/App.tsx` – wizard UI + i18n + optional terminal + OAuth link flow
- `src/lib/analysis/compatibility.ts` – compatibility scoring and same-loader enforcement
- `src/lib/prompts/conversionPrompt.ts` – AI planning prompt contract
- `src/lib/transform/rulesEngine.ts` – deterministic rules (same-loader enforced)
- `electron/openaiOAuth.ts` – OpenAI link-based OAuth + PKCE exchange helpers
- `electron/main.ts` / `electron/preload.ts` – IPC bridge
- `tests/*.test.js` – regression tests
