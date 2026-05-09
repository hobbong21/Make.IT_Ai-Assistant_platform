/**
 * MaKIT Service Worker — Offline support & smart caching
 * Cache strategy:
 *  - Static shell (CSS/JS/SVG/fonts): stale-while-revalidate
 *  - API calls: network-first, no caching
 *  - HTML: network-first with fallback to cache
 */

const CACHE_VERSION = 'makit-v21';
const SHELL_ASSETS = [
  '/index.html',
  '/services/nlp-analyze.html',
  '/css/pages/nlp-analyze.css',
  '/js/pages/nlp-analyze.js',
  '/services/youtube-comments.html',
  '/css/pages/youtube-comments.css',
  '/js/pages/youtube-comments.js',
  '/css/pages/analytics-shared.css',
  '/services/youtube-influence.html',
  '/js/pages/youtube-influence.js',
  '/services/url-analyze.html',
  '/js/pages/url-analyze.js',
  '/services/youtube-keyword-search.html',
  '/js/pages/youtube-keyword-search.js',
  '/services/review-analysis.html',
  '/js/pages/review-analysis.js',
  '/services/feed-generate.html',
  '/js/pages/feed-generate.js',
  '/services/remove-bg.html',
  '/js/pages/remove-bg.js',
  '/services/modelshot.html',
  '/js/pages/modelshot.js',
  '/services/chatbot.html',
  '/js/pages/chatbot.js',
  '/js/pages/chatbot-page.js',
  '/services/meeting-notes.html',
  '/css/core/tokens.css',
  '/css/core/common.css',
  '/css/core/app-shell.css',
  '/css/pages/styles.css',
  '/css/pages/intro-styles.css',
  '/css/pages/all-services-styles.css',
  '/css/pages/service-detail-styles.css',
  '/css/pages/marketing-hub.css',
  '/css/pages/meeting-notes.css',
  '/js/core/api.js',
  '/js/core/auth.js',
  '/js/core/ui.js',
  '/js/widgets/app-shell-extras.js',
  '/js/widgets/user-menu.js',
  '/js/widgets/chatbot-widget.js',
  '/js/core/modal.js',
  '/js/widgets/auth-gate.js',
  '/js/widgets/settings-menu.js',
  '/js/core/sw-register.js',
  '/js/pages/meeting-notes.js',
];

const ICON_ASSETS = [
  '/img/illustrations/login-mark.svg',
  '/img/illustrations/index-hero.svg',
  '/img/illustrations/intro-hero.svg',
  '/img/illustrations/all-services-hero.svg',
  '/img/illustrations/service-detail-hero.svg',
  '/img/illustrations/ax-data.svg',
  '/img/illustrations/ax-marketing.svg',
  '/img/illustrations/commerce-brain.svg',
  '/img/illustrations/feature-1.svg',
  '/img/illustrations/feature-2.svg',
];

const FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
];

/**
 * Install event: precache shell assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all([
        cache.addAll(SHELL_ASSETS),
        cache.addAll(ICON_ASSETS),
      ]).catch((err) => {
        console.warn('[SW] Install precache error (non-fatal):', err);
      });
    }).then(() => {
      self.skipWaiting(); // Activate immediately
    })
  );
});

/**
 * Activate event: clean old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_VERSION) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      self.clients.claim(); // Claim all clients immediately
    })
  );
});

/**
 * Fetch event: route-based cache strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome extensions, etc.
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // API calls: network-first, never cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Network error: return offline response
          return new Response(
            JSON.stringify({ error: 'offline', message: '오프라인 상태입니다. 네트워크를 확인해주세요.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Static shell + icons: stale-while-revalidate
  if (
    SHELL_ASSETS.includes(url.pathname) ||
    ICON_ASSETS.includes(url.pathname) ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          // Update cache in background if response is fresh
          if (response.status === 200) {
            const cache = caches.open(CACHE_VERSION);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));

        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response(
              '<!DOCTYPE html><html><body><h1>오프라인 상태</h1><p>인터넷 연결을 확인해주세요.</p></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }

  // Default: just fetch
  event.respondWith(fetch(request).catch(() => new Response('Not found', { status: 404 })));
});

/**
 * Push event: handle incoming Web Push notifications (VAPID)
 */
self.addEventListener('push', (event) => {
  let title = 'MaKIT 알림';
  let options = {
    body: '',
    icon: '/img/illustrations/login-mark.svg',
    badge: '/img/illustrations/login-mark.svg',
    tag: 'makit-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      options.body = payload.message || '';
      options.tag = payload.tag || 'makit-notification';
      options.data = payload;
    } catch (e) {
      // Fallback if payload is not JSON
      options.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification click event: track click, then navigate to URL or home
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/index.html';

  event.waitUntil(
    // Track the click event asynchronously
    fetch('/api/notifications/push/track-click', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: data.notificationId,
        tag: data.tag || 'makit-notification',
        url: url
      })
    }).catch(() => {
      // Ignore tracking errors; navigation continues anyway
    }).then(() => {
      // Navigate to URL
      return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Try to find existing window
        for (let client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not found
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      });
    })
  );
});

/**
 * Message handler: allow clients to skip waiting
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
