# Feature Catalog Contributing Guide

Welcome to the MaKIT feature catalog! This guide explains how to maintain and extend the feature catalog structure.

## Overview

The feature catalog provides a single source of truth for:
- **What** features exist and their status (experimental → beta → stable → deprecated)
- **Where** code lives (backend Java, frontend HTML/JS, tests, migrations, docs)
- **Who** owns each feature
- **How** features depend on each other
- **When** each feature was last updated (round history)

Each feature is a directory under `features/` containing:

```
features/{feature-name}/
├── manifest.json       # Machine-readable metadata
├── README.md          # Human-readable overview
├── api.md             # Endpoint specification
└── changelog.md       # Change history by round
```

## When to Update Manifest

Update `manifest.json` when you:

1. **Add new files** — File paths under `files.{backend,frontend,tests,docs,migrations}`
2. **Add/remove endpoints** — REST API paths under `endpoints`
3. **Change status** — Update `status` enum (experimental → beta → stable)
4. **Add dependencies** — List internal features or external services under `dependencies`
5. **Add environment variables** — Document required env vars under `environment`
6. **Complete a round** — Add entry to `roundHistory` with round, date, and changes

## Manifest Schema

All manifests must conform to `features/_TEMPLATE/manifest.schema.json`. Required fields:

- `name` (string, kebab-case) — Machine-readable feature identifier
- `displayName` (string) — Human-readable name (Korean recommended)
- `category` (enum) — One of: `ax-data`, `ax-marketing`, `ax-commerce`, `platform`
- `owners` (array of strings) — GitHub usernames with @ prefix (e.g., `@hobbong21`)
- `status` (enum) — One of: `experimental`, `beta`, `stable`, `deprecated`
- `files` (object) — File paths organized by layer: `backend`, `frontend`, `tests`, `docs`, `migrations`

Optional fields:

- `version` (semantic versioning)
- `description` (feature summary)
- `endpoints` (REST API routes)
- `roundHistory` (array of {round, date, changes})
- `dependencies` (internal features and external services)
- `environment` (env var names and descriptions)
- `lastTouchedRound` (e.g., "R19a")

## Validation

### Local Validation

Before committing, validate locally:

```bash
# Bash
bash deploy/scripts/validate-features.sh

# PowerShell
.\deploy\scripts\validate-features.ps1 -Verbose
```

The script checks:
1. ✓ JSON syntax validity
2. ✓ Schema conformance (required fields, enum values, etc.)
3. ✓ All referenced files exist (unless template placeholders like `{N}` are present)

### CI Validation

When you push to a PR or main:

1. **GitHub Actions** runs `.github/workflows/feature-catalog-check.yml`
2. Validates all manifests (same as local script)
3. Checks README sync (see below)
4. Verifies file references

If validation fails, the CI job will show which features have issues.

## README Auto-Sync

The file `deploy/scripts/sync-feature-readmes.sh` automatically generates the top section of each `README.md` from `manifest.json`:

```markdown
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
## Overview
{Your manual content here}
```

This ensures README headers stay in sync with manifest. The script:
- Runs locally: `bash deploy/scripts/sync-feature-readmes.sh`
- Runs in CI: `.github/workflows/feature-catalog-check.yml` (readme-sync-check job)
- Dry-run mode: `bash deploy/scripts/sync-feature-readmes.sh --dry-run` (CI safe)

**Important**: Do not edit the auto-generated section above the marker. Edit only the manual section below.

## Example: Adding a New Endpoint

You've added a new endpoint `GET /api/marketing/campaigns/{id}/performance`:

1. Update `features/marketing-hub/manifest.json`:

```json
{
  "name": "marketing-hub",
  ...
  "endpoints": [
    "GET /api/marketing/hub",
    "GET /api/marketing/hub/campaigns",
    "GET /api/marketing/campaigns/{id}/performance",  // ← NEW
    ...
  ],
  "lastTouchedRound": "R19a"
}
```

2. If you added new files, add them to `files`:

```json
{
  ...
  "files": {
    "backend": [
      "backend/src/main/java/com/humanad/makit/marketing/hub/PerformanceMetricsService.java",  // ← NEW
      ...
    ]
  }
}
```

3. Validate:

```bash
bash deploy/scripts/validate-features.sh
```

4. If README was auto-generated, sync it:

```bash
bash deploy/scripts/sync-feature-readmes.sh
```

5. Commit all changes together.

## Example: Creating a New Feature

Use the scaffold script:

```bash
# Bash
bash deploy/scripts/new-feature.sh search-analytics

# PowerShell
.\deploy\scripts\new-feature.ps1 -name search-analytics
```

This creates:

```
features/search-analytics/
├── manifest.json       # Template with {placeholders}
├── README.md          # Template
├── api.md             # Template
└── changelog.md       # Template
```

Then fill in the templates with real data:

1. Update `manifest.json` with actual files, endpoints, owners
2. Update `README.md` with feature overview
3. Update `api.md` with endpoint details
4. Update `changelog.md` with your round entry

Validate before committing:

```bash
bash deploy/scripts/validate-features.sh
```

## File Path Conventions

### Backend

```
backend/src/main/java/com/humanad/makit/{domain}/{feature}/
├── {Feature}Controller.java
├── {Feature}Service.java
├── {Feature}Entity.java
├── {Feature}Repository.java
└── dto/
    ├── {Feature}Request.java
    ├── {Feature}Response.java
    └── {Feature}Dto.java
```

### Frontend

```
frontend/
├── {feature}.html
├── js/pages/{feature}.js
├── css/{feature}-styles.css
└── js/api.js (shared)
```

### Tests

```
tests/e2e/{feature}.spec.ts
```

### Migrations

```
backend/src/main/resources/db/migration/V{TIMESTAMP}__{feature}.sql
```

## Common Issues

### "missing files" validation error

**Problem**: Manifest lists a file path that doesn't exist.

**Solution**:
- Check the file path spelling (case-sensitive)
- If file is in a different location, update manifest
- If file doesn't exist yet, mark with `{placeholder}` (e.g., `V{N}__migration.sql`)

### "SCHEMA_VALIDATION_FAILED: 'status' is not one of..."

**Problem**: `status` field has invalid value.

**Solution**: Use one of: `experimental`, `beta`, `stable`, `deprecated`

### "INVALID_OWNER_FORMAT: alice must start with @"

**Problem**: Owner listed without @ prefix.

**Solution**: Change `"alice"` to `"@alice"`

## Roadmap

### R19b — Lifecycle Audit Log

Track manifest changes: who, when, status transitions → enable feature deprecation workflows.

### R19c — Prometheus Metrics

Export feature health: file count, endpoint count, last updated → observability.

### R19d — CONTRIBUTING Expansion

Multi-language guide + video walkthrough + GitHub issue templates for feature requests.

## Questions?

Ask @hobbong21 or open an issue with `[feature-catalog]` tag.
