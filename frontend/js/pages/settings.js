// Settings page — 프로필/비밀번호/테마
(function () {
  function byId(id) { return document.getElementById(id); }
  function showMsg(id, text, ok) {
    var el = byId(id); if (!el) return;
    el.innerHTML = text ? '<span class="' + (ok ? 'msg-success' : 'msg-error') + '">' + text + '</span>' : '';
  }

  function init() {
    if (!auth.requireLogin()) return;

    // 프로필 로드
    var u = auth.getUser() || {};
    if (byId('profName')) byId('profName').value = u.name || '';
    if (byId('profEmail')) byId('profEmail').value = u.email || '';

    api.auth.me().then(function (latest) {
      if (latest) {
        if (byId('profName')) byId('profName').value = latest.name || '';
        if (byId('profEmail')) byId('profEmail').value = latest.email || '';
        if (window.auth && auth.updateUser) auth.updateUser(latest);
      }
    }).catch(function () {});

    // 프로필 폼
    var profForm = byId('profileForm');
    if (profForm) {
      profForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = byId('profSaveBtn'); if (btn) btn.disabled = true;
        showMsg('profMessage', '', true);
        try {
          var updated = await api.auth.updateProfile({
            name: byId('profName').value.trim(),
            email: byId('profEmail').value.trim()
          });
          if (updated) {
            if (window.auth && auth.updateUser) auth.updateUser(updated);
            showMsg('profMessage', '프로필이 저장되었습니다.', true);
          }
        } catch (err) {
          var msg = err && err.message || '저장 실패';
          if (err && err.status === 409) msg = '이미 사용 중인 이메일입니다.';
          showMsg('profMessage', msg, false);
        } finally { if (btn) btn.disabled = false; }
      });
    }

    // 비밀번호 폼
    var pwForm = byId('pwForm');
    if (pwForm) {
      pwForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var oldP = byId('pwOld').value;
        var newP = byId('pwNew').value;
        var confirm = byId('pwNewConfirm').value;
        if (!oldP || !newP || newP.length < 6) {
          showMsg('pwMessage', '비밀번호는 6자 이상이어야 합니다.', false); return;
        }
        if (newP !== confirm) {
          showMsg('pwMessage', '새 비밀번호가 일치하지 않습니다.', false); return;
        }
        var btn = byId('pwSaveBtn'); if (btn) btn.disabled = true;
        showMsg('pwMessage', '', true);
        try {
          await api.auth.changePassword({ oldPassword: oldP, newPassword: newP });
          showMsg('pwMessage', '비밀번호가 변경되었습니다.', true);
          pwForm.reset();
        } catch (err) {
          var msg = err && err.message || '변경 실패';
          if (err && (err.code === 'CURRENT_PASSWORD_MISMATCH' || err.status === 400)) {
            msg = '현재 비밀번호가 올바르지 않습니다.';
          }
          showMsg('pwMessage', msg, false);
        } finally { if (btn) btn.disabled = false; }
      });
    }

    // 테마 토글 — `.theme-opt[data-theme]`로 스코프 제한 (다른 라디오 그룹과 분리)
    var current = (window.makitTheme && makitTheme.get()) || 'auto';
    var themeBtns = document.querySelectorAll('.theme-opt[data-theme]');
    themeBtns.forEach(function (b) {
      if (b.dataset.theme === current) b.classList.add('active');
      b.setAttribute('aria-checked', b.dataset.theme === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        var t = b.dataset.theme;
        if (window.makitTheme) makitTheme.set(t);
        themeBtns.forEach(function (x) {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        });
      });
    });

    // AI 답변 신뢰도 임계치 (Task #23)
    var CONF_KEY = 'mk:axhub:confThreshold';
    var DEFAULT_CONF = 0.5;
    function readConf() {
      try {
        var raw = localStorage.getItem(CONF_KEY);
        if (raw == null) return DEFAULT_CONF;
        var v = parseFloat(raw);
        if (!isFinite(v)) return DEFAULT_CONF;
        return Math.max(0, Math.min(1, v));
      } catch (_) { return DEFAULT_CONF; }
    }
    function writeConf(v) {
      try { localStorage.setItem(CONF_KEY, String(v)); } catch (_) {}
    }
    var confInput = byId('confThreshold');
    var confValue = byId('confThresholdValue');
    var confReset = byId('confResetBtn');
    if (confInput && confValue) {
      var initial = Math.round(readConf() * 100);
      confInput.value = String(initial);
      confValue.textContent = initial + '%';
      var applyConf = function (pct, persist) {
        confValue.textContent = pct + '%';
        if (persist) {
          writeConf(pct / 100);
          showMsg('confMessage', '저장되었습니다. AX Office Hub에 즉시 반영됩니다.', true);
        }
      };
      confInput.addEventListener('input', function () {
        applyConf(parseInt(confInput.value, 10) || 0, false);
      });
      confInput.addEventListener('change', function () {
        applyConf(parseInt(confInput.value, 10) || 0, true);
      });
      if (confReset) {
        confReset.addEventListener('click', function () {
          confInput.value = String(Math.round(DEFAULT_CONF * 100));
          applyConf(Math.round(DEFAULT_CONF * 100), true);
        });
      }
    }

    // 약한 근거 답변 경고 강도 (Task #45 — Task #37 boolean을 4단계로 확장)
    var MODE_KEY = 'mk:axhub:lowConfMode';
    var LEGACY_WARN_KEY = 'mk:axhub:lowConfWarn';
    var VALID_MODES = ['strong', 'medium', 'light', 'off'];
    var MODE_LABEL = {
      strong: '강 (토스트+흐림)',
      medium: '중 (토스트만)',
      light:  '약 (배지만)',
      off:    '끔 (표시 안 함)'
    };
    function readMode() {
      try {
        var v = localStorage.getItem(MODE_KEY);
        if (v && VALID_MODES.indexOf(v) !== -1) return v;
        // legacy 호환: lowConfWarn 'true' → strong, 'false' → light
        var legacy = localStorage.getItem(LEGACY_WARN_KEY);
        if (legacy === 'false') return 'light';
        return 'strong';
      } catch (_) { return 'strong'; }
    }
    var modeHost = byId('lowConfModeOptions');
    if (modeHost) {
      var current = readMode();
      var btns = modeHost.querySelectorAll('.theme-opt');
      function paint(mode) {
        btns.forEach(function (b) {
          var on = b.dataset.mode === mode;
          b.classList.toggle('active', on);
          b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      }
      paint(current);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var mode = b.dataset.mode;
          if (VALID_MODES.indexOf(mode) === -1) return;
          try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}
          // legacy 키도 동기화 (다른 코드에서 참조해도 일관되게)
          try { localStorage.setItem(LEGACY_WARN_KEY, (mode === 'off' || mode === 'light') ? 'false' : 'true'); } catch (_) {}
          paint(mode);
          showMsg('confMessage',
            '경고 강도를 "' + MODE_LABEL[mode] + '"(으)로 설정했습니다. AX Office Hub에 즉시 반영됩니다.',
            true);
        });
      });
    }

    // 애니메이션 줄이기 체크박스
    var reduceMotionCheck = byId('reduceMotionCheck');
    if (reduceMotionCheck) {
      // 현재 저장된 값 로드
      var savedReduceMotion = localStorage.getItem('makit_reduce_motion');
      reduceMotionCheck.checked = savedReduceMotion === 'true';
      // 초기화: 저장된 설정 또는 시스템 설정 확인
      applyReduceMotion(reduceMotionCheck.checked);

      // 체크박스 변경 이벤트
      reduceMotionCheck.addEventListener('change', function () {
        try {
          localStorage.setItem('makit_reduce_motion', this.checked ? 'true' : 'false');
        } catch (_) {}
        applyReduceMotion(this.checked);
      });
    }

    function applyReduceMotion(shouldReduce) {
      var html = document.documentElement;
      if (shouldReduce) {
        html.setAttribute('data-reduce-motion', 'true');
      } else {
        html.removeAttribute('data-reduce-motion');
      }
    }

    // Push Notification setup (R14c)
    initPushNotifications();

    // Load Push Analytics (R15a)
    loadPushAnalytics();

    async function initPushNotifications() {
      if (!window.makitPush || !window.makitPush.isSupported) {
        console.log('[Push] Web Push not supported; hiding UI');
        return;
      }

      var card = byId('pushNotificationCard');
      if (!card) return;
      card.style.display = 'block';

      var toggleBtn = byId('pushToggleBtn');
      var testBtn = byId('pushTestBtn');
      var statusEl = byId('pushStatus');

      async function updateStatus() {
        try {
          var status = await window.makitPush.status();
          var hasSubscription = status.hasSubscription;
          var permission = status.permission;

          if (permission === 'denied') {
            statusEl.textContent = '권한이 거부되었습니다. 브라우저 설정에서 변경해주세요.';
            statusEl.style.color = 'var(--mk-color-error-text)';
            toggleBtn.textContent = '권한 요청';
            toggleBtn.disabled = true;
            testBtn.style.display = 'none';
          } else if (hasSubscription) {
            statusEl.textContent = '푸시 알림이 활성화되었습니다.';
            statusEl.style.color = 'var(--mk-color-success-text)';
            toggleBtn.textContent = '비활성화';
            testBtn.style.display = 'inline-block';
          } else {
            statusEl.textContent = '푸시 알림이 비활성화되었습니다.';
            statusEl.style.color = 'var(--mk-color-text-muted)';
            toggleBtn.textContent = '활성화';
            testBtn.style.display = 'none';
          }
        } catch (e) {
          console.error('[Push] Error checking status:', e);
          statusEl.textContent = '상태 확인 실패';
        }
      }

      updateStatus();

      toggleBtn.addEventListener('click', async function () {
        toggleBtn.disabled = true;
        var msgEl = byId('pushMessage');
        msgEl.innerHTML = '';

        try {
          var status = await window.makitPush.status();
          if (status.hasSubscription) {
            var result = await window.makitPush.unsubscribe();
            if (result.success) {
              showMsg('pushMessage', result.message, true);
            } else {
              showMsg('pushMessage', result.message || '구독 해제에 실패했습니다', false);
            }
          } else {
            var result = await window.makitPush.subscribe();
            if (result.success) {
              showMsg('pushMessage', result.message, true);
            } else {
              showMsg('pushMessage', result.message || '구독에 실패했습니다', false);
            }
          }
          updateStatus();
        } catch (e) {
          console.error('[Push] Toggle error:', e);
          showMsg('pushMessage', e.message || '오류가 발생했습니다', false);
        } finally {
          toggleBtn.disabled = false;
        }
      });

      testBtn.addEventListener('click', async function () {
        testBtn.disabled = true;
        var msgEl = byId('pushMessage');
        msgEl.innerHTML = '';

        try {
          await api.notifications.list({ size: 1 }); // dummy call to verify auth
          // Trigger test via existing endpoint
          await fetch('/api/notifications/me/test', { method: 'POST' });
          showMsg('pushMessage', '테스트 알림이 전송되었습니다.', true);
        } catch (e) {
          console.error('[Push] Test error:', e);
          showMsg('pushMessage', e.message || '테스트 전송 실패', false);
        } finally {
          testBtn.disabled = false;
        }
      });
    }

    async function loadPushAnalytics() {
      var card = byId('pushAnalyticsCard');
      if (!card) return;

      try {
        var analytics = await api.push.analytics(7);
        if (!analytics) return;

        // Show card if we have data
        card.style.display = 'block';

        // Update stat cards
        byId('analyticsSent').textContent = analytics.sent.toString();
        byId('analyticsClicked').textContent = analytics.clicked.toString();
        byId('analyticsFailed').textContent = analytics.failed.toString();
        byId('analyticsCtr').textContent = analytics.ctr.toFixed(1) + '%';

        // Chart: daily breakdown
        if (window.Chart && analytics.byDay && analytics.byDay.length > 0) {
          var chartCanvas = byId('pushAnalyticsChart');
          if (chartCanvas) {
            // Reverse to show oldest first
            var reversed = analytics.byDay.slice().reverse();
            var labels = reversed.map(function (b) { return b.date.substring(5); });
            var sentData = reversed.map(function (b) { return b.sent; });
            var clickedData = reversed.map(function (b) { return b.clicked; });

            new Chart(chartCanvas, {
              type: 'line',
              data: {
                labels: labels,
                datasets: [
                  {
                    label: '전송',
                    data: sentData,
                    borderColor: 'var(--mk-color-brand-500)',
                    backgroundColor: 'rgb(37, 99, 235, 0.1)',
                    tension: 0.3,
                    fill: true
                  },
                  {
                    label: '클릭',
                    data: clickedData,
                    borderColor: 'var(--mk-color-success-500)',
                    backgroundColor: 'rgb(34, 197, 94, 0.1)',
                    tension: 0.3,
                    fill: false
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      font: { size: 12 },
                      color: 'var(--mk-color-text-muted)'
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      color: 'var(--mk-color-text-muted)',
                      stepSize: 1
                    },
                    grid: {
                      color: 'var(--mk-color-border)'
                    }
                  },
                  x: {
                    ticks: {
                      color: 'var(--mk-color-text-muted)'
                    },
                    grid: {
                      color: 'var(--mk-color-border)'
                    }
                  }
                }
              }
            });
          }
        }

      } catch (e) {
        console.log('[Analytics] Not available or failed (non-fatal):', e);
        // Hide card if not available
        card.style.display = 'none';
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
