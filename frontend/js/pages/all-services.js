// All-services page — preserves client-side filter/search, adds navigation.
(function () {
  // Map Korean service titles → service keys used by service-detail.html
  var TITLE_TO_KEY = {
    '자연어 분석': 'nlp-analyze',
    '유튜브 댓글 분석': 'youtube-comments',
    '유튜브 영향력 분석': 'youtube-influence',
    '웹사이트 URL 분석': 'url-analyze',
    '유튜브 키워드 채널 검색': 'youtube-keyword-search',
    '인스타그램 피드 생성': 'feed-generate',
    '배경 제거': 'remove-bg',
    '고객 응대 AI 챗봇': 'chatbot',
    '상품 리뷰 분석': 'review-analysis',
    '이미지 + 모델컷 생성': 'modelshot'
  };

  function init() {
    // Require login to use any service.
    if (!auth.requireLogin()) return;

    // --- Filter tabs ---
    document.querySelectorAll('.filter-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var cat = tab.dataset.category;
        document.querySelectorAll('.category-section').forEach(function (section) {
          section.style.display = (cat === 'all' || section.dataset.category === cat) ? 'block' : 'none';
        });
      });
    });

    // --- Search ---
    var searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        var term = e.target.value.toLowerCase();
        document.querySelectorAll('.service-card').forEach(function (card) {
          var titleEl = card.querySelector('.service-title');
          var descEl = card.querySelector('.service-description');
          var title = titleEl ? titleEl.textContent.toLowerCase() : '';
          var desc = descEl ? descEl.textContent.toLowerCase() : '';
          card.style.display = (title.indexOf(term) !== -1 || desc.indexOf(term) !== -1) ? 'block' : 'none';
        });
      });
    }

    // --- Service card buttons → navigate to service-detail.html?service={key} ---
    document.querySelectorAll('.service-card').forEach(function (card) {
      var titleEl = card.querySelector('.service-title');
      if (!titleEl) return;
      var title = titleEl.textContent.trim();
      var key = TITLE_TO_KEY[title];
      if (!key) return;
      var btn = card.querySelector('.service-button');
      if (btn) {
        btn.addEventListener('click', function () {
          location.href = 'service-detail.html?service=' + encodeURIComponent(key);
        });
      }
    });

    // --- Sidebar dropdown toggles (harmless if absent) ---
    document.querySelectorAll('.nav-dropdown-header').forEach(function (h) {
      h.addEventListener('click', function () {
        if (h.parentElement) h.parentElement.classList.toggle('expanded');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
