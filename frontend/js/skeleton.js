// MaKIT Skeleton Loading 헬퍼 (D7 — 인식 성능 개선)
//
// 사용법:
//   window.makitSkeleton.row({heading: true, width: 50}) — 텍스트 skeleton 줄
//   window.makitSkeleton.card() — 전형적인 카드 skeleton
//   window.makitSkeleton.fillContainer(el, 5) — 컨테이너 N개 skeleton으로 채우기
//   window.makitSkeleton.clear(el) — skeleton 제거
//
// CSS 의존성: app-shell.css의 .mk-skeleton, @keyframes mk-skeletonShimmer
(function() {
  'use strict';

  // 텍스트 skeleton 줄 생성
  function row(opts) {
    opts = opts || {};
    var div = document.createElement('div');
    var className = 'mk-skeleton mk-skeleton--text';
    if (opts.heading) className += ' mk-skeleton--heading';
    if (opts.width) className += ' mk-skeleton--w-' + opts.width;
    div.className = className;
    return div;
  }

  // 전형적인 카드 skeleton: 제목 + 3줄 + 하단 액션
  function card(opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'mk-skeleton-stack';
    wrap.style.padding = 'var(--mk-space-4)';
    wrap.style.background = 'var(--mk-color-bg)';
    wrap.style.borderRadius = 'var(--mk-radius-lg)';
    wrap.style.border = '1px solid var(--mk-color-border)';

    // 제목
    wrap.appendChild(row({heading: true, width: 50}));
    // 본문 3줄
    wrap.appendChild(row({width: 75}));
    wrap.appendChild(row({width: 100}));
    wrap.appendChild(row({width: 50}));

    return wrap;
  }

  // 컨테이너를 N개 skeleton으로 채우기
  function fillContainer(container, count, builderFn) {
    if (!container) return;
    container.innerHTML = '';
    count = count || 3;
    builderFn = builderFn || card;
    for (var i = 0; i < count; i++) {
      container.appendChild(builderFn(i));
    }
  }

  // 컨테이너 skeleton 제거
  function clear(container) {
    if (container) container.innerHTML = '';
  }

  // 리스트 skeleton (역사/감사 로그용)
  function listRow() {
    var wrap = document.createElement('div');
    wrap.className = 'mk-skeleton-stack';
    wrap.style.display = 'flex';
    wrap.style.gap = 'var(--mk-space-3)';
    wrap.style.padding = 'var(--mk-space-3)';
    wrap.style.alignItems = 'center';

    var avatar = document.createElement('div');
    avatar.className = 'mk-skeleton mk-skeleton--avatar-sm';
    wrap.appendChild(avatar);

    var textWrap = document.createElement('div');
    textWrap.className = 'mk-skeleton-stack';
    textWrap.style.flex = '1';
    textWrap.appendChild(row({width: 40}));
    textWrap.appendChild(row({width: 60}));
    wrap.appendChild(textWrap);

    return wrap;
  }

  // 일반 skeleton 요소를 여러 개 빠르게 만들기
  function textRows(count) {
    count = count || 5;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      fragment.appendChild(row({width: 100}));
    }
    return fragment;
  }

  // 공개 API
  window.makitSkeleton = {
    row: row,
    card: card,
    fillContainer: fillContainer,
    clear: clear,
    listRow: listRow,
    textRows: textRows
  };
})();
