// MaKIT 국제화(i18n) 시스템
// 언어 전환, 메시지 번역, DOM 동적 업데이트를 담당합니다.
// window.makitI18n API 제공

(function () {
  // 사전 데이터를 window.makitI18nDict에서 읽음
  if (!window.makitI18nDict) {
    console.error('makitI18nDict not found. Load i18n-dict.js before i18n.js');
    return;
  }

  const dictionaries = window.makitI18nDict;
  const DEFAULT_LOCALE = 'ko';
  const STORAGE_KEY = 'makit_locale';

  // ============ 상태 관리 ============
  let currentLocale = localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;

  // HTML lang 속성 즉시 동기화
  function syncHtmlLang(locale) {
    document.documentElement.lang = locale;
    document.documentElement.setAttribute('lang', locale);
  }
  syncHtmlLang(currentLocale);

  // ============ 번역 함수 ============
  // key: '네임스페이스.키' 형식 (예: 'nav.home', 'auth.email')
  // params: {name: '값'} 형식의 플레이스홀더 치환용 객체
  function t(key, params) {
    // 현재 언어의 사전에서 찾기
    if (dictionaries[currentLocale] && dictionaries[currentLocale][key]) {
      let text = dictionaries[currentLocale][key];
      // 플레이스홀더 치환 (예: {name} → 전달된 값)
      if (params && typeof params === 'object') {
        Object.keys(params).forEach((k) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), params[k]);
        });
      }
      return text;
    }
    // 현재 언어에 없으면 한국어로 fallback
    if (currentLocale !== 'ko' && dictionaries.ko && dictionaries.ko[key]) {
      let text = dictionaries.ko[key];
      if (params && typeof params === 'object') {
        Object.keys(params).forEach((k) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), params[k]);
        });
      }
      return text;
    }
    // 한국어도 없으면 영어로 fallback
    if (dictionaries.en && dictionaries.en[key]) {
      let text = dictionaries.en[key];
      if (params && typeof params === 'object') {
        Object.keys(params).forEach((k) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), params[k]);
        });
      }
      return text;
    }
    // 모든 언어에 없으면 키 자체를 반환 (원본 키)
    return key;
  }

  // ============ 현지화 적용 함수 ============
  // data-i18n 속성이 있는 요소들을 번역함
  function i18nApply() {
    // data-i18n="key" → textContent 번역
    const textElements = document.querySelectorAll('[data-i18n]');
    textElements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    // data-i18n-attr="attr1:key1,attr2:key2" → 속성값 번역
    const attrElements = document.querySelectorAll('[data-i18n-attr]');
    attrElements.forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr');
      if (spec) {
        const pairs = spec.split(',');
        pairs.forEach((pair) => {
          const [attr, key] = pair.trim().split(':');
          if (attr && key) {
            el.setAttribute(attr, t(key));
          }
        });
      }
    });

    // data-i18n-html="key" → innerHTML 번역 (마크다운/HTML 포함 가능)
    const htmlElements = document.querySelectorAll('[data-i18n-html]');
    htmlElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        el.innerHTML = t(key);
      }
    });
  }

  // ============ 언어 설정 함수 ============
  function setLocale(locale) {
    // 지원하는 언어만 설정 가능
    if (!dictionaries[locale]) {
      console.warn(`Unsupported locale: ${locale}`);
      return;
    }

    currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    syncHtmlLang(locale);

    // 모든 data-i18n 요소 업데이트
    i18nApply();

    // 커스텀 이벤트 발생 (다른 스크립트가 언어 변경에 반응할 수 있음)
    document.dispatchEvent(new CustomEvent('makit:localechange', {
      detail: { locale },
    }));
  }

  // ============ 언어 조회 함수 ============
  function getLocale() {
    return currentLocale;
  }

  // ============ 지원 언어 ============
  const languages = {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
  };

  // ============ 공개 API ============
  window.makitI18n = {
    t,              // 번역 함수
    setLocale,      // 언어 설정
    getLocale,      // 현재 언어 조회
    languages,      // 지원 언어 목록
  };

  // ============ DOMContentLoaded 초기화 ============
  // 페이지 로드 시 data-i18n 요소들 자동 번역
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      i18nApply();
    });
  } else {
    // 이미 로드됨
    i18nApply();
  }

  console.log('[i18n] Initialized. Current locale:', currentLocale);
})();
