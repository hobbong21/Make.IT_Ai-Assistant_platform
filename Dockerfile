# MaKIT Frontend — Nginx static server + API reverse proxy
FROM nginx:alpine

# Consolidated frontend assets (frontend-engineer single-source-of-truth)
COPY frontend/ /usr/share/nginx/html/

# Nginx config (API proxy, SSE, SPA fallback, cache, healthcheck)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1
