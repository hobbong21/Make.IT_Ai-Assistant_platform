// MaKIT WebSocket Client — SockJS + STOMP, 알림 종 실시간 갱신
//
// 의존성: SockJS + StompJS CDN (이 파일 전에 로드)
// 자동 마운트 (login 페이지 제외, 로그인 상태에서만)
(function () {
  if (window.__makitWsMounted) return;
  window.__makitWsMounted = true;
  if (/login\.html$/i.test(location.pathname)) return;
  if (!window.auth || !auth.isLoggedIn()) return;

  var stompClient = null;
  var reconnectTimer = null;
  var reconnectDelay = 2000; // ms, 지수적 백오프 가능

  function getUserId() {
    try {
      var u = auth.getUser();
      return (u && u.id) || null;
    } catch (_) { return null; }
  }

  function refreshNotifBell() {
    // app-shell-extras.js의 알림 종을 갱신
    var trigger = document.getElementById('mkNotifTrigger');
    if (!trigger) return;
    // unread-count + list 재로드 (panel 열려있는지와 무관)
    if (api.notifications) {
      api.notifications.unreadCount().then(function (r) {
        var badge = document.getElementById('mkNotifBadge');
        if (!badge) return;
        var n = (r && r.count) || 0;
        badge.textContent = n > 99 ? '99+' : n;
        badge.hidden = n === 0;
      }).catch(function () {});
      // panel이 열려있다면 리스트도 갱신
      var panel = document.querySelector('.mk-notif-panel');
      if (panel && panel.classList.contains('mk-notif-panel--open')) {
        api.notifications.list({ page: 0, size: 10 }).then(function (page) {
          var list = document.getElementById('mkNotifList');
          if (!list) return;
          // app-shell-extras.js의 renderNotifList와 동일 로직 (간단 inline)
          var items = page.content || [];
          if (!items.length) { list.innerHTML = '<p class="mk-notif-empty">새 알림이 없습니다.</p>'; return; }
          list.innerHTML = items.map(function (n) {
            var typeClass = 'mk-notif-type-' + (n.type || 'INFO');
            return '<a href="' + (n.linkUrl || '#') + '" class="mk-notif-item ' +
              (n.readAt ? '' : 'mk-notif-item--unread') + '" data-id="' + n.id + '">' +
              '<span class="mk-notif-type ' + typeClass + '"></span>' +
              '<div class="mk-notif-body"><strong>' + (n.title || '') + '</strong>' +
              (n.message ? '<small>' + n.message + '</small>' : '') +
              '<time>방금</time></div></a>';
          }).join('');
        }).catch(function () {});
      }
    }
  }

  function showToastForNotification(notif) {
    if (window.ui && ui.toast) {
      var msg = (notif.title || '새 알림') + (notif.message ? ' — ' + notif.message : '');
      var cls = (notif.type || 'INFO').toLowerCase();
      var toastType = cls === 'error' ? 'error' : cls === 'warn' ? 'warn' : (cls === 'success' ? 'success' : 'info');
      ui.toast(msg, toastType);
    }
  }

  function connect() {
    if (typeof SockJS === 'undefined' || typeof StompJs === 'undefined') {
      console.warn('[ws-client] SockJS 또는 StompJs 미로드 — WebSocket 비활성');
      return;
    }
    var token = auth.getToken();
    if (!token) return;

    try {
      stompClient = new StompJs.Client({
        webSocketFactory: function () { return new SockJS('/ws'); },
        connectHeaders: { Authorization: 'Bearer ' + token },
        reconnectDelay: reconnectDelay,
        debug: function () {} // 무음
      });

      stompClient.onConnect = function () {
        console.log('[ws-client] connected');
        var userId = getUserId();
        // user destination 구독: /user/{userId}/queue/notifications
        stompClient.subscribe('/user/queue/notifications', function (message) {
          try {
            var notif = JSON.parse(message.body);
            showToastForNotification(notif);
            refreshNotifBell();
          } catch (e) {
            console.warn('[ws-client] notification parse failed', e);
          }
        });
      };

      stompClient.onStompError = function (frame) {
        console.warn('[ws-client] STOMP error', frame.headers && frame.headers.message);
      };

      stompClient.onWebSocketClose = function () {
        console.log('[ws-client] disconnected — auto-reconnect in', reconnectDelay, 'ms');
      };

      stompClient.activate();
    } catch (e) {
      console.warn('[ws-client] activate failed', e);
    }
  }

  function disconnect() {
    if (stompClient) {
      try { stompClient.deactivate(); } catch (_) {}
      stompClient = null;
    }
  }

  window.addEventListener('beforeunload', disconnect);

  // 로그아웃 hook (auth.clearSession이 호출되기 직전 끊기)
  if (window.auth) {
    var orig = auth.clearSession;
    auth.clearSession = function () { disconnect(); return orig.apply(auth, arguments); };
  }

  // SockJS + StompJs CDN이 로드된 뒤 connect — 약간 지연
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(connect, 800); });
  } else {
    setTimeout(connect, 800);
  }

  window.makitWs = { connect: connect, disconnect: disconnect, getClient: function () { return stompClient; } };
})();
