# 03 — Prompt Versioning Scheme

**Author**: ai-engineer agent
**Date**: 2026-04-20
**Status**: Live — shipped in Phase 4.x Operations Readiness round.

## Scheme

Each prompt lives under `backend/src/main/resources/prompts/<domain>/<name>.md`.
Multiple versions may co-exist:

```
prompts/
  commerce/
    rag_system.md       <-- default (= latest)
    rag_system.v1.md    <-- pinned historical copy
    rag_system.v2.md    <-- rollout candidate
```

Each file begins with a comment:

```
<!-- version: 2.0 | updated: 2026-04-20 | author: ... -->
```

`PromptLoader` extracts the `version:` token and attaches it to the returned
`LoadedPrompt(text, version, resolvedKey)` record.

## Resolution

`PromptLoader.loadVersioned(key, vars)` follows this algorithm:

1. Normalize the caller key — strip trailing `.md`.
2. Look up `aws.bedrock.rag.promptVariants[normalizedKey]`.
3. If the value is missing, blank, or `"latest"` -> load `<key>.md` (default file).
4. Otherwise load `<normalizedKey>.<variant>.md`.
5. Read + cache the file, extract the `<!-- version: X.Y -->` header, return both.

Cache is keyed on the *resolved* file path, so switching variants at runtime
(dev only, with `-Dmakit.prompts.reload=true`) picks up the new file cleanly.

## Operator workflow

### 1. Roll a new variant

```bash
# Author v2 alongside the existing file
cp prompts/commerce/rag_system.md prompts/commerce/rag_system.v2.md
# Edit version header to "version: 2.0"
# Edit system block as needed

# Deploy, then A/B via variant override in a canary profile
```

### 2. Canary via environment-scoped config

`application-canary.yml`:

```yaml
aws:
  bedrock:
    rag:
      promptVariants:
        commerce/rag_system: v2
```

Default/production stays on the latest `.md` file until the canary metrics clear
(watch `bedrock.invoke{prompt_version}` timer + citation/refusal rates).

### 3. Rollback

Either:
- Set `promptVariants.commerce/rag_system: v1` (pin)
- Or remove the key entirely to fall back to the default file

No code/rebuild required — only a config flip.

### 4. Metrics

`bedrock.invoke` timer now carries a `prompt_version` tag. Dashboards to add:

- Latency by prompt version: `avg by (prompt_version) (bedrock_invoke_seconds)`
- Refusal rate deltas: join with app-level "정보가 부족합니다" counter

## Caveats

- Version string is purely informational; authority is the filename suffix.
- `PromptLoader` never guesses "closest" versions — a missing `v3.md` with
  `promptVariants: v3` throws `IllegalArgumentException`. Fail loud.
- The header regex scans only the first 256 chars of the file. Keep the
  comment at the top.
