// Marketing Hub — 콘텐츠 라이브러리 CRUD 모달 (event delegation)
(function () {
  if (!/marketing-hub\.html$/i.test(location.pathname)) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  var TYPE_OPTIONS = [
    { value: 'TEXT', label: '텍스트' },
    { value: 'IMAGE', label: '이미지' },
    { value: 'VIDEO', label: '비디오' },
    { value: 'FEED', label: '피드' },
    { value: 'CAMPAIGN_ASSET', label: '캠페인 자산' }
  ];

  function buildFormHtml(c) {
    c = c || {};
    var typeOpts = TYPE_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (c.type === o.value ? ' selected' : '') + '>' + escapeHtml(o.label) + '</option>';
    }).join('');
    return '' +
      '<label for="ctTitle">제목</label>' +
      '<input id="ctTitle" type="text" maxlength="200" required value="' + escapeHtml(c.title || '') + '">' +
      '<label for="ctType">유형</label>' +
      '<select id="ctType" required>' + typeOpts + '</select>' +
      '<label for="ctService">관련 서비스 (선택)</label>' +
      '<input id="ctService" type="text" maxlength="60" value="' + escapeHtml(c.serviceKey || '') + '" placeholder="예: nlp-analyze, feed-generate">' +
      '<label for="ctThumb">썸네일 URL (선택)</label>' +
      '<input id="ctThumb" type="text" maxlength="500" value="' + escapeHtml(c.thumbnailUrl || '') + '" placeholder="https://...">' +
      '<label for="ctBody">본문/설명 (선택)</label>' +
      '<textarea id="ctBody" maxlength="2000" rows="4">' + escapeHtml(c.body || '') + '</textarea>';
  }

  function collectForm(body) {
    var get = function (id) { var el = body.querySelector('#' + id); return el ? el.value.trim() : ''; };
    return {
      title: get('ctTitle'),
      type: get('ctType'),
      serviceKey: get('ctService') || null,
      thumbnailUrl: get('ctThumb') || null,
      body: get('ctBody') || null
    };
  }

  function refresh() {
    if (window.makitMarketingHub && typeof makitMarketingHub.refreshContents === 'function') {
      makitMarketingHub.refreshContents();
    } else { location.reload(); }
  }

  function openCreate() {
    if (!window.makitModal) return;
    makitModal.open({
      title: '신규 콘텐츠 등록',
      body: buildFormHtml({}),
      actions: [
        { label: '취소', type: 'secondary' },
        { label: '등록', type: 'primary', onClick: function (ctx) {
          var payload = collectForm(ctx.body);
          if (!payload.title) { alert('제목을 입력해주세요.'); return false; }
          api.marketing.contentCreate(payload).then(function () {
            if (window.ui && ui.toast) ui.toast('콘텐츠가 등록되었습니다.', 'success');
            refresh();
          }).catch(function (err) { alert('등록 실패: ' + (err && err.message || '')); });
        }}
      ]
    });
  }

  function openEdit(content) {
    makitModal.open({
      title: '콘텐츠 편집 — ' + (content.title || ''),
      body: buildFormHtml(content),
      actions: [
        { label: '삭제', type: 'danger', onClick: async function () {
          var ok = await makitModal.confirm({
            title: '삭제 확인', message: '"' + (content.title || '콘텐츠') + '"를 삭제할까요?',
            confirmLabel: '삭제', danger: true
          });
          if (!ok) return;
          api.marketing.contentDelete(content.id).then(function () {
            if (window.ui && ui.toast) ui.toast('삭제되었습니다.', 'success');
            refresh();
          }).catch(function (err) { alert('삭제 실패: ' + (err && err.message || '')); });
        }},
        { label: '취소', type: 'secondary' },
        { label: '저장', type: 'primary', onClick: function (ctx) {
          var payload = collectForm(ctx.body);
          api.marketing.contentUpdate(content.id, payload).then(function () {
            if (window.ui && ui.toast) ui.toast('저장되었습니다.', 'success');
            refresh();
          }).catch(function (err) { alert('저장 실패: ' + (err && err.message || '')); });
        }}
      ]
    });
  }

  // event delegation — 콘텐츠 카드 클릭
  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-content-id]');
    if (!card) return;
    var id = card.dataset.contentId;
    api.marketing.contentGet(id).then(openEdit).catch(function (err) {
      alert('콘텐츠를 불러올 수 없습니다: ' + (err && err.message || ''));
    });
  });

  // "신규 콘텐츠" 버튼 자동 mount
  function mountCreateButton() {
    var grid = document.getElementById('contentGrid') || document.querySelector('.content-library, .contents-grid');
    if (!grid) return;
    if (document.getElementById('mkNewContentBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'mkNewContentBtn';
    btn.type = 'button';
    btn.className = 'mk-modal-btn mk-modal-btn--primary';
    btn.style.cssText = 'position:absolute;top:16px;right:16px;z-index:5;padding:8px 14px;font-size:13px;';
    btn.innerHTML = '+ 신규 콘텐츠';
    btn.addEventListener('click', openCreate);
    var section = grid.closest('section') || grid.parentElement;
    if (section && getComputedStyle(section).position === 'static') section.style.position = 'relative';
    if (section) section.appendChild(btn);
  }

  function init() {
    setTimeout(mountCreateButton, 600);
    setInterval(mountCreateButton, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
