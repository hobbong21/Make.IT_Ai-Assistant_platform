// Marketing Hub — 캠페인 CRUD 모달 (event delegation으로 보드 카드 클릭 처리)
// marketing-hub.js와 분리 — 같은 페이지에서 함께 로드.
(function () {
  if (!/marketing-hub\.html$/i.test(location.pathname)) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      // YYYY-MM-DDTHH:mm
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (_) { return ''; }
  }

  var STATUS_OPTIONS = [
    { value: 'DRAFT', label: '초안' },
    { value: 'SCHEDULED', label: '예약됨' },
    { value: 'ACTIVE', label: '진행 중' },
    { value: 'PAUSED', label: '일시 중지' },
    { value: 'COMPLETED', label: '완료' }
  ];
  var CHANNEL_OPTIONS = [
    { value: 'INSTAGRAM', label: '인스타그램' },
    { value: 'YOUTUBE', label: '유튜브' },
    { value: 'SEO', label: 'SEO' },
    { value: 'ADS', label: '광고' },
    { value: 'MULTI', label: '복수 채널' }
  ];

  function statusLabel(s) {
    var o = STATUS_OPTIONS.find(function (x) { return x.value === s; });
    return o ? o.label : s;
  }

  function buildFormHtml(c) {
    c = c || {};
    var statusOpts = STATUS_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (c.status === o.value ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
    }).join('');
    var channelOpts = CHANNEL_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (c.channel === o.value ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
    }).join('');
    return '' +
      '<label for="cmpName">캠페인 이름</label>' +
      '<input id="cmpName" type="text" maxlength="120" required value="' + escapeHtml(c.name || '') + '">' +
      '<label for="cmpChannel">채널</label>' +
      '<select id="cmpChannel" required>' + channelOpts + '</select>' +
      '<label for="cmpDesc">설명 (선택)</label>' +
      '<textarea id="cmpDesc" maxlength="500" placeholder="이 캠페인의 목적·타깃·KPI 등">' + escapeHtml(c.description || '') + '</textarea>' +
      '<label for="cmpStart">시작일</label>' +
      '<input id="cmpStart" type="datetime-local" value="' + toLocalInput(c.startDate) + '">' +
      '<label for="cmpEnd">종료일</label>' +
      '<input id="cmpEnd" type="datetime-local" value="' + toLocalInput(c.endDate) + '">' +
      (c.status ? '<label for="cmpStatus">상태</label><select id="cmpStatus">' + statusOpts + '</select>' : '');
  }

  function collectForm(body) {
    var get = function (id) { var el = body.querySelector('#' + id); return el ? el.value : ''; };
    var startStr = get('cmpStart');
    var endStr = get('cmpEnd');
    return {
      name: get('cmpName').trim(),
      channel: get('cmpChannel'),
      description: get('cmpDesc').trim() || null,
      startDate: startStr ? new Date(startStr).toISOString() : null,
      endDate: endStr ? new Date(endStr).toISOString() : null
    };
  }

  function refreshBoardSafe() {
    if (window.makitMarketingHub && typeof makitMarketingHub.refreshCampaigns === 'function') {
      makitMarketingHub.refreshCampaigns();
    } else {
      location.reload();
    }
  }

  function openCreateModal() {
    if (!window.makitModal) { alert('모달 컴포넌트 로드 실패'); return; }
    makitModal.open({
      title: '신규 캠페인 만들기',
      body: buildFormHtml({}),
      actions: [
        { label: '취소', type: 'secondary' },
        { label: '만들기', type: 'primary', onClick: function (ctx) {
          var payload = collectForm(ctx.body);
          if (!payload.name) { alert('캠페인 이름을 입력해주세요.'); return false; }
          if (!payload.channel) { alert('채널을 선택해주세요.'); return false; }
          api.marketing.campaignCreate(payload).then(function () {
            if (window.ui && ui.toast) ui.toast('캠페인이 생성되었습니다.', 'success');
            refreshBoardSafe();
          }).catch(function (err) {
            alert('생성 실패: ' + (err && err.message || ''));
          });
        }}
      ]
    });
  }

  function openEditModal(campaign) {
    makitModal.open({
      title: '캠페인 편집 — ' + (campaign.name || ''),
      body: buildFormHtml(campaign),
      actions: [
        { label: '삭제', type: 'danger', onClick: async function () {
          var ok = await makitModal.confirm({
            title: '삭제 확인',
            message: '"' + (campaign.name || '캠페인') + '"을 정말 삭제할까요? 되돌릴 수 없습니다.',
            confirmLabel: '삭제',
            danger: true
          });
          if (!ok) {
            // confirm 모달이 닫히면서 원래 모달도 닫혔으므로 다시 열지 않음
            return;
          }
          api.marketing.campaignDelete(campaign.id).then(function () {
            if (window.ui && ui.toast) ui.toast('삭제되었습니다.', 'success');
            refreshBoardSafe();
          }).catch(function (err) {
            alert('삭제 실패: ' + (err && err.message || ''));
          });
          return; // close confirm only; main close also fired
        }},
        { label: '취소', type: 'secondary' },
        { label: '저장', type: 'primary', onClick: function (ctx) {
          var payload = collectForm(ctx.body);
          var statusEl = ctx.body.querySelector('#cmpStatus');
          var newStatus = statusEl ? statusEl.value : null;
          var updatePromise = api.marketing.campaignUpdate(campaign.id, payload);
          updatePromise.then(function () {
            if (newStatus && newStatus !== campaign.status) {
              return api.marketing.campaignChangeStatus(campaign.id, newStatus);
            }
          }).then(function () {
            if (window.ui && ui.toast) ui.toast('저장되었습니다.', 'success');
            refreshBoardSafe();
          }).catch(function (err) {
            alert('저장 실패: ' + (err && err.message || ''));
          });
        }}
      ]
    });
  }

  // 캠페인 보드 카드 클릭 (event delegation)
  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-campaign-id]');
    if (!card) return;
    var id = card.dataset.campaignId;
    if (!id) return;
    api.marketing.campaignGet(id).then(openEditModal).catch(function (err) {
      alert('캠페인을 불러올 수 없습니다: ' + (err && err.message || ''));
    });
  });

  // 신규 캠페인 버튼 (페이지에 동적으로 mount)
  function mountCreateButton() {
    var board = document.getElementById('campaignBoard');
    if (!board) return;
    if (document.getElementById('mkNewCampaignBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'mkNewCampaignBtn';
    btn.type = 'button';
    btn.className = 'mk-modal-btn mk-modal-btn--primary';
    btn.style.cssText = 'position:absolute;top:16px;right:16px;z-index:5;padding:8px 14px;font-size:13px;';
    btn.innerHTML = '+ 신규 캠페인';
    btn.addEventListener('click', openCreateModal);
    var section = board.closest('section') || board.parentElement;
    if (section && getComputedStyle(section).position === 'static') section.style.position = 'relative';
    if (section) section.appendChild(btn);
  }

  // 캘린더 일자 클릭 (data-date 속성을 가진 요소)
  document.addEventListener('click', function (e) {
    var dayCell = e.target.closest('[data-calendar-date]');
    if (!dayCell) return;
    var date = dayCell.dataset.calendarDate;
    if (!date) return;
    makitModal.open({
      title: date + ' 일정',
      body:
        '<p>이 날의 캠페인 / 콘텐츠 발행 예정을 보여줍니다.</p>' +
        '<div style="background:var(--mk-color-bg-muted);padding:12px;border-radius:10px;">' +
        '<small>일자별 상세 뷰는 다음 라운드에서 보강됩니다 (오늘 확정된 캠페인 ' + (dayCell.dataset.campaignCount || 0) + '건, 콘텐츠 ' + (dayCell.dataset.contentCount || 0) + '건).</small>' +
        '</div>',
      actions: [{ label: '닫기', type: 'secondary' }]
    });
  });

  // marketing-hub.js init() 이후 실행되도록 약간 지연
  function init() {
    setTimeout(mountCreateButton, 500);
    // 보드 갱신 이후에도 다시 마운트 (refreshCampaigns가 boardEl.innerHTML로 다시 그릴 가능성 대비)
    setInterval(mountCreateButton, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
