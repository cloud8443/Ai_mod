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

1) **One-Click Mode (default UX)**
- Set loader/version, paste metadata + code, click one main button
- Auto chain: parse -> compatibility check -> prompt build -> rules preview
- Beginner-friendly Korean copy + safer defaults

2) **Advanced mode (optional/collapsible)**
- Expand only when you need per-step manual control
- One-click remains the primary path

3) **Metadata + compatibility workflow**
- Parses Forge `mods.toml`, Fabric `fabric.mod.json`, and legacy `mcmod.info`
- Semantic version-range checks for MC and dependencies
- Explainable score + confidence factors + matched migration knowledge IDs

4) **AI planning**
- OpenAI / Anthropic / Gemini clients remain available
- Prompt now enforces same-loader upgrade scope

5) **Deterministic + AST-aware transform pipeline**
- Deterministic rule ordering
- Version-aware rule selection
- Preview-first workflow, apply optional
- Rollback guidance in backup manifest contract

6) **OpenAI OAuth (link-based approval UX + manual fallback)**
- Generate authorization URL in app
- User opens link and approves in browser
- Paste callback URL or auth code to complete login quickly
- Token persisted locally via secure storage abstraction

7) **i18n (English + Korean)
- Language switch in Settings
- Core wizard/OAuth/logging UI translated

---

## Run locally

```bash
npm install
npm run dev
```

## Quick start (3-step)

1. **Open app and set basics**: choose source loader (Forge/Fabric), set target Minecraft version (same loader only).
2. **Paste inputs**: mods metadata (`mods.toml` / `fabric.mod.json`) and a Java code snippet.
3. **Click one button**: run **One-Click Mode** to auto execute parse -> analyze -> prompt -> rules preview.
   - Optional: paste OpenAI API key/access token first to also get AI plan text.
   - If OAuth link fails, use manual token input and continue (flow is not blocked).

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

- `src/App.tsx` – one-click-first UI + collapsible advanced mode + i18n + OAuth/manual token flow
- `src/lib/analysis/compatibility.ts` – compatibility scoring and same-loader enforcement
- `src/lib/prompts/conversionPrompt.ts` – AI planning prompt contract
- `src/lib/transform/rulesEngine.ts` – deterministic rules (same-loader enforced)
- `electron/openaiOAuth.ts` – OpenAI link-based OAuth + PKCE exchange helpers
- `electron/main.ts` / `electron/preload.ts` – IPC bridge
- `tests/*.test.js` – regression tests
