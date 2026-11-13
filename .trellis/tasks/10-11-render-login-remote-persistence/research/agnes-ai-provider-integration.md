# Research: Agnes AI provider integration in 9router

- **Query**: Integrate provider "Agnes AI" (API: https://apihub.agnes-ai.com) as a Free Tier Provider
- **Scope**: internal (codebase) — no external lookup needed
- **Date**: 2026-11-13

## Key Finding

**The Agnes AI provider is ALREADY fully integrated in this codebase.** No new files need to be created.
The current task (`10-11-render-login-remote-persistence`) is unrelated to provider work — the research
was written to a placeholder task dir only because no provider task exists. If this work belongs to a
new task, move this file accordingly.

Evidence: `CHANGELOG.md` lines 236 & 262:
- `**Agnes**: seed the 2.5/3.0 model ids in the registry`
- `**Providers**: add Token Harbor provider and four OpenAI-compatible aggregator providers (dahl, atria, agnes, bai)`

---

## 1. Provider structure in 9router — where things live

| Layer | File(s) | Role |
|---|---|---|
| **Registry entry** (single source of truth) | `open-sse/providers/registry/{id}.js` | One file per provider: id, category, display, transport, models, flags |
| **Registry index** | `open-sse/providers/registry/index.js` | Auto-generated static import list — regenerate, never hand-edit |
| **Field contract** | `open-sse/providers/schema.js` | `@typedef RegistryEntry` — only `id` + `category` required |
| **Template** | `open-sse/providers/REGISTRY_TEMPLATE.js` | Copy-paste starting point for new providers |
| **Pricing** | `open-sse/providers/pricing.js` | `PROVIDER_PRICING` (provider-specific overrides), `MODEL_PRICING`, `PATTERN_PRICING` |
| **Runtime build** | `open-sse/providers/index.js` | Builds `PROVIDERS[id]`, `PROVIDER_OAUTH`, `PROVIDER_MEDIA` from registry |
| **UI constants** | `src/shared/constants/providers.js` | Derives `FREE_PROVIDERS`, `FREE_TIER_PROVIDERS`, etc. from registry by `category` — **no per-provider code here** |
| **Icon** | `public/providers/{id}.png` | UI fallback (textIcon tile if missing) |
| **Auth test case** | `src/app/api/providers/[id]/test/testUtils.js` | `case "{id}":` in the key-validation switch |
| **Live model discovery** | `src/app/api/providers/[id]/models/route.js` | `"{id}": createOpenAIModelsConfig(url)` entry |
| **Baselines** | `tests/__baseline__/providers-baseline.json`, `alias-baseline.json` | Snapshot of built provider map + alias map |
| **Tests** | `tests/unit/...` | Regression tests |

### Required fields in a registry entry (from `schema.js` + template)

Minimal for a plain API-key OpenAI-compatible LLM:

```js
export default {
  id: "myprovider",           // REQUIRED, kebab-case, unique
  category: "freeTier",      // REQUIRED: "apikey" | "oauth" | "freeTier" | "free" | "webCookie"
  alias: "mp",               // key used in PROVIDER_MODELS (defaults to id)
  aliases: ["my-provider"],  // extra lookup tokens
  display: {
    name: "My Provider",
    icon: "bolt",            // material icon or textIcon fallback
    color: "#3B82F6",
    textIcon: "MP",
    website: "https://example.com",
    notice: { apiKeyUrl: "https://example.com/keys" },
  },
  authType: "apikey",
  transport: {
    baseUrl: "https://api.example.com/v1/chat/completions", // full chat URL
    format: "openai",  // default; only declare when different
    validateUrl: "https://api.example.com/v1/models",
  },
  models: [{ id: "model-1", name: "Model 1" }],
  passthroughModels: true,  // accept arbitrary model ids
};
```

Key rule from `open-sse/AGENTS.md`: **"Generic providers need no executor (DefaultExecutor handles OpenAI-compatible APIs)."** No file in `open-sse/executors/` is needed for an OpenAI-compatible provider — confirmed: `grep agnes open-sse/executors/` returns nothing, and `tests/unit/aggregator-providers-batch.test.js` asserts `getExecutor("agnes")` **is** a `DefaultExecutor`.

### Pricing

No entry needed for free providers unless you want cost tracking. `pricing.js` resolution order:
`PROVIDER_PRICING[provider][model]` → free namespaces → `MODEL_PRICING` → `PATTERN_PRICING`.
Unlisted models simply return `null` cost. (Agnes has **no** entry in `pricing.js` — intentionally.)

### Executor

None. The executor map (`open-sse/executors/index.js`) only contains special-case providers
(protobuf, binary, custom auth). `getExecutor(provider)` falls back to `DefaultExecutor`.

---

## 2. Agnes AI — current state in the codebase (exact files)

### 2.1 `open-sse/providers/registry/agnes.js` (EXISTS — 38 lines)

```js
export default {
  id: "agnes",
  priority: 120,
  alias: "agnes",
  aliases: ["agnes-ai"],
  uiAlias: "agnes",
  display: {
    name: "Agnes AI",
    icon: "auto_awesome",
    color: "#7C3AED",
    textIcon: "AG",
    website: "https://agnes-ai.com",
    notice: {
      text: "OpenAI-compatible gateway from Agnes AI, offering free API credits on sign-up. Accepts a bearer token or an x-api-key header.",
      apiKeyUrl: "https://platform.agnes-ai.com",
    },
  },
  category: "freeTier",
  authType: "apikey",
  transport: {
    baseUrl: "https://apihub.agnes-ai.com/v1/chat/completions",
    validateUrl: "https://apihub.agnes-ai.com/v1/models",
  },
  models: [
    { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash" },
    { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro" },
    { id: "agnes-2.5-pro-beta", name: "Agnes 2.5 Pro Beta" },
    { id: "agnes-3.0-flash", name: "Agnes 3.0 Flash" },
  ],
  passthroughModels: true,
};
```

Notes from the file's own comment: the live `/v1/models` catalogue answers `401 "Token not provided"`,
so the seed list is curated, not a verified dump; `passthroughModels: true` accepts any id the account actually has.

### 2.2 `open-sse/providers/registry/index.js`

Already wired:
- Line 132: `import p129 from "./agnes.js";`
- Line 281: `p129,` in the exported array

### 2.3 API key validation — `src/app/api/providers/[id]/test/testUtils.js` (lines 799–810)

```js
case "tokenharbor":
case "dahl":
case "atria":
case "agnes":          // ← already present
case "bai":
case "muse":
case "runcrate":
case "synthetic": {
  const cfg = PROVIDERS[connection.provider];
  const res = await fetchWithConnectionProxy(cfg.validateUrl, { headers: { Authorization: `Bearer ${connection.apiKey}` } }, effectiveProxy);
  return { valid: res.ok, error: res.ok ? null : "Invalid API key" };
}
```

### 2.4 Live model discovery — `src/app/api/providers/[id]/models/route.js` (line 346)

```js
agnes: createOpenAIModelsConfig("https://apihub.agnes-ai.com/v1/models"),
```

### 2.5 Baselines & snapshots

- `tests/__baseline__/providers-baseline.json` (line 1135): `"agnes": { baseUrl, validateUrl, format: "openai" }`
- `tests/__baseline__/alias-baseline.json` (line 137): `"agnes": "agnes"`
- `tests/translator/__snapshots__/golden-url-header.test.js.snap`: golden `buildHeaders`/`buildUrl` for `agnes`

### 2.6 Tests

- `tests/unit/agnes-model-seeds.test.js` — pins the 4 model ids, `passthroughModels: true`, transport URLs
- `tests/unit/aggregator-providers-batch.test.js` — batch test: category, alias, `DefaultExecutor` routing, icon existence, models-route registration

### 2.7 Icon

`public/providers/agnes.png` — EXISTS.

---

## 3. User's requested spec vs. current state

| Requirement | Status |
|---|---|
| Base URL `https://apihub.agnes-ai.com/v1` | ✅ `transport.baseUrl` = `.../v1/chat/completions`, `validateUrl` = `.../v1/models` |
| Model `agnes-2.5-flash` | ✅ seeded first in `models[]` |
| Category Free Tier | ✅ `category: "freeTier"` → appears in `FREE_TIER_PROVIDERS` (`src/shared/constants/providers.js:48`) |
| Video generation | ⚠️ NOT wired. No `media.videoConfig` in the registry entry. (User's claim "có hỗ trợ video generation" — not reflected in code; if the API really exposes video, a `media: { serviceKinds: [...], videoConfig: {...} }` block would need to be added, plus possibly a media handler. No such endpoint docs found in-repo.) |
| Image reading (imageToText) | ⚠️ NOT wired. Batch test explicitly asserts agnes has **no** `imageToTextConfig` (`tests/unit/aggregator-providers-batch.test.js:128-136`: "none of them has documented image input"). Would need `media.imageToTextConfig` + updating that test. |
| Code generation | ✅ implicit — LLM chat completions; no special config needed |

---

## 4. Files to create / modify

**To create: none.** Everything is already in place.

**Optional / only if scope extends beyond "LLM provider":**

1. **Video generation support** (if the API actually has it):
   - Edit `open-sse/providers/registry/agnes.js`: add
     ```js
     media: {
       serviceKinds: ["llm", "video"],
       videoConfig: { baseUrl: "https://apihub.agnes-ai.com/v1/videos/generations" },
     },
     ```
     (endpoint shape follows `MEDIA_PROVIDER_KINDS` in `src/shared/constants/providers.js:82`)
   - Add a `video` model entry if the provider takes a model id for video.
2. **Image input (imageToText)**:
   - Edit `open-sse/providers/registry/agnes.js`: add `media.imageToTextConfig` + `serviceKinds`
   - **Update `tests/unit/aggregator-providers-batch.test.js`** — the "does not claim vision" invariant would fail; agnes must be excluded from that loop or its assertions changed.
3. **Pricing entry** (only if the free tier still bills some models): add `agnes: { ... }` under `PROVIDER_PRICING` in `open-sse/providers/pricing.js`.
4. **Executor**: only if the upstream is NOT OpenAI-compatible. Not the case here.
5. **Tests**: add/adjust in `tests/unit/`; update `tests/__baseline__/*.json` if the built provider shape changes (these are regenerated by the baseline test suite).
6. **CHANGELOG.md**: append an entry if anything above is done.

---

## 5. Classification

- **Free Tier** — yes, `category: "freeTier"` is correct and already set; it feeds the `FREE_TIER_PROVIDERS` export used by the UI ("hasFree" grouping).
- **OpenAI-compatible** — yes; `transport.format` defaults to `"openai"` (not explicitly written, inherited via `PROVIDER_DEFAULTS` in `schema.js`). Routed through `DefaultExecutor`.
- The in-repo prefix conventions `openai-compatible-*` / `anthropic-compatible-*` (`src/shared/constants/providers.js:87-97`) are for *user-defined* custom providers, not for shipping registry providers — Agnes is a shipped registry entry, so no prefix needed.

## Caveats / Not Found

- User stated Agnes "supports video generation, image reading" — no in-repo or documented API endpoint confirms this; the codebase intentionally omits media config for agnes, and the batch test guards against asserting vision. Verify against the actual Agnes AI API docs before adding `media` blocks.
- No active Trellis task exists for provider work; this research was persisted under the fallback task `10-11-render-login-remote-persistence` (unrelated — login/remote persistence). Move the file if the provider work gets its own task.
- Model list is a curated seed, not a verified catalogue (`/v1/models` requires auth); `passthroughModels: true` covers newer/other model ids.
