# MaKIT — Frontend Cleanup Recommendations

**Author**: frontend-engineer agent
**Date**: 2026-04-20
**Status**: Advisory — no files deleted (no authorization for destructive ops)

## Canonical source

`frontend/` is now the single source of truth for the web UI:

```
frontend/
├── index.html
├── intro.html
├── login.html
├── all-services.html
├── service-detail.html
├── css/
│   ├── styles.css
│   ├── intro-styles.css
│   ├── all-services-styles.css
│   ├── service-detail-styles.css
│   └── common.css  (new — loading/toast/error)
└── js/
    ├── config.js
    ├── api.js
    ├── auth.js
    ├── ui.js
    └── pages/
        ├── login.js
        ├── index.js
        ├── all-services.js
        ├── service-detail.js
        └── chatbot.js
```

## Duplicates still present at repo root (should be deleted)

These are stale copies of the same UI, predating the `frontend/` consolidation.
They no longer match `frontend/*.html` (which now link `css/*` and external
`js/*`). Leaving them risks drift and confusion.

- `./index.html`
- `./intro.html`
- `./login.html`  ← still contains the old hardcoded `http://localhost:8083/api` inline script
- `./all-services.html`
- `./service-detail.html`
- `./styles.css`
- `./intro-styles.css`
- `./all-services-styles.css`
- `./service-detail-styles.css`

### Recommendation (pick one — needs leader approval)

1. **Preferred**: remove all the root HTML/CSS listed above. Docker image and
   Nginx already copy from `frontend/` per the architect's deployment plan.

2. **Alternative**: replace each root HTML with a 1-line redirect stub:
   ```html
   <!DOCTYPE html><meta http-equiv="refresh" content="0; url=frontend/index.html">
   ```
   Useful only if external links/bookmarks point at root paths; otherwise adds
   noise.

## Devops-engineer handoff (image build)

Ensure the Dockerfile / docker-compose build step copies **only** `frontend/`
into the Nginx image's document root (e.g., `/usr/share/nginx/html`), not the
repo root. Sample:

```dockerfile
FROM nginx:1.27-alpine
COPY frontend/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

This avoids publishing the stale duplicates even if they remain in the repo.

## Archive (do NOT delete)

- `0. Design1_Mokup/` — design snapshot, read-only reference. Kept as-is per
  the frontend-engineer constraints.

## Why not delete from this task

Per scope constraints, the agent does not have authorization for destructive
file operations. A maintainer (or devops-engineer during image build) should
perform the cleanup after verifying `frontend/` renders correctly via Nginx.
