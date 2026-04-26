/**
 * Service Worker Registration & Install Prompt Manager
 * Handles:
 *  - SW registration with update checks
 *  - beforeinstallprompt event capture
 *  - Manual install button logic
 *  - Update notification
 */

(function initServiceWorker() {
  // Only register in production-like HTTPS or localhost
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (!('serviceWorker' in navigator) || !isSecure) {
    console.log('[SW] ServiceWorker not available or insecure context');
    return;
  }

  /**
   * Global install API
   */
  window.makitInstall = {
    deferredPrompt: null,
    canPrompt() {
      return !!this.deferredPrompt;
    },
    prompt() {
      if (!this.deferredPrompt) {
        console.warn('[SW] Install prompt not available');
        return;
      }
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[SW] User accepted install');
        } else {
          console.log('[SW] User dismissed install');
        }
        this.deferredPrompt = null;
      });
    },
    isInstalled() {
      return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    },
  };

  /**
   * Capture beforeinstallprompt to show custom install button
   */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.makitInstall.deferredPrompt = e;
    showInstallButton();
  });

  /**
   * Show install button in app shell if available
   */
  function showInstallButton() {
    const appShellNav = document.querySelector('.app-shell-nav, [data-install-button]');
    if (!appShellNav) return;

    // Check if button already exists
    if (document.getElementById('mk-pwa-install-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'mk-pwa-install-btn';
    btn.className = 'mk-pwa-install';
    btn.setAttribute('aria-label', 'MaKIT 앱 설치');
    btn.title = 'MaKIT을 홈 화면에 추가합니다';
    btn.innerHTML = '📱 설치';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.makitInstall.prompt();
    });

    // Insert at the end of nav or user-menu area
    appShellNav.appendChild(btn);
  }

  /**
   * Register service worker
   */
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] Registered successfully:', registration.scope);

      /**
       * Check for updates periodically
       */
      setInterval(() => {
        registration.update();
      }, 60000); // Check every 1 minute

      /**
       * Handle new service worker activation
       */
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New SW is ready and there was an old one
            console.log('[SW] New version available');
            showUpdateNotification();
          }
        });
      });
    })
    .catch((err) => {
      console.warn('[SW] Registration failed (non-fatal):', err.message);
    });

  /**
   * Post message to SW to skip waiting (for update)
   */
  function skipWaiting() {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Show update notification (optional toast)
   */
  function showUpdateNotification() {
    // If ui.toast is available (from app-shell-extras.js)
    if (window.ui && window.ui.toast) {
      window.ui.toast('새 버전이 준비되었습니다. 새로고침해주세요.', 'info');
    }

    // Auto-reload after 10 seconds if user doesn't interact
    setTimeout(() => {
      skipWaiting();
      location.reload();
    }, 10000);
  }

  /**
   * Handle app install completion
   */
  window.addEventListener('appinstalled', () => {
    console.log('[SW] App installed successfully');
    // Optionally hide the install button
    const btn = document.getElementById('mk-pwa-install-btn');
    if (btn) {
      btn.style.display = 'none';
    }
  });

})();
