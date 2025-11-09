// ga.consent.js — GA4 + Consent Mode + i18n-баннер (RU/UK/EN), без сетевых запросов до согласия
(function () {
  'use strict';

  var GA_ID = (window.GA_ID || 'G-DZL66KME4H'); // ← поменяй при необходимости
  var __gaLoaded = false;
  var bannerEl = null, styleEl = null;

  // ----- gtag bootstrap (без загрузки сети) -----
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // По умолчанию — отказ (EU/CH-friendly)
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function loadGA(){
    if (__gaLoaded) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    __gaLoaded = true;
  }

  // ----- i18n -----
  function resolveLang(){
    var l = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.lang) || '';
    l = (l || '').toLowerCase();
    try {
      if (!l && window.App) {
        if (typeof App.getUiLang === 'function') l = (App.getUiLang()||'').toLowerCase();
        else if (App.UI_LANG) l = (''+App.UI_LANG).toLowerCase();
        else if (App.uiLang)  l = (''+App.uiLang).toLowerCase();
      }
    } catch(_) {}
    try { if (!l) l = (localStorage.getItem('ui_lang') || localStorage.getItem('uiLang') || '').toLowerCase(); } catch(_) {}
    if (!l) l = ((navigator.language||'en').slice(0,2) || 'en').toLowerCase();
    if (l === 'ua') l = 'uk';
    return /^(ru|uk|en)$/.test(l) ? l : 'en';
  }
  function dict(){
    var L = resolveLang();
    var T = {
      ru: {
        text: 'Мы используем Google Analytics 4, чтобы понимать, как улучшать MOYAMOVA. Никакой рекламы и подписок — только анонимная аналитика.',
        ok:   'Согласен',
        no:   'Нет, спасибо'
      },
      uk: {
        text: 'Ми використовуємо Google Analytics 4, щоб розуміти, як покращувати MOYAMOVA. Жодної реклами чи підписок — лише анонімна аналітика.',
        ok:   'Погоджуюсь',
        no:   'Ні, дякую'
      },
      en: {
        text: 'We use Google Analytics 4 to improve MOYAMOVA. No ads or subscriptions — anonymous analytics only.',
        ok:   'Agree',
        no:   'No, thanks'
      }
    };
    return T[L] || T.en;
  }

  // ----- баннер -----
  function ensureStyles(){
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'ga-consent-style';
    styleEl.textContent =
`.ga-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483646;display:flex;gap:.75rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:.8rem 1rem;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:rgba(20,30,50,.92);color:#fff;backdrop-filter:saturate(1.2) blur(6px)}
.ga-banner .txt{max-width:72ch;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial}
.ga-banner .btns{display:flex;gap:.5rem}
.ga-banner button{cursor:pointer;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:10px;padding:.45rem .7rem;font:14px system-ui}
.ga-banner button.primary{background:#fff;color:#111; border-color:#fff}
.ga-banner.hide{opacity:0;transition:opacity .18s ease}
@media (prefers-color-scheme: light){
  .ga-banner{background:rgba(255,255,255,.98); color:#111; border-color:#e5e8ef}
  .ga-banner button{border-color:#c7cfdb;color:#111}
  .ga-banner button.primary{background:#111;color:#fff;border-color:#111}
}`;

styleEl.textContent += `
.ga-banner{ text-align:center; }
.ga-banner .txt{ margin-left:auto; margin-right:auto; }
.ga-banner .btns{ justify-content:center; align-items:center; }

@media (max-width:480px){
  .ga-banner .btns{ width:100%; flex-direction:column; gap:8px; }
  .ga-banner button{ width:100%; }
}
`;
    
    document.head.appendChild(styleEl);
  }

  function buildBanner(){
    if (bannerEl || document.getElementById('ga-banner')) return;
    ensureStyles();
    var D = dict();

    bannerEl = document.createElement('div');
    bannerEl.id = 'ga-banner';
    bannerEl.className = 'ga-banner';

    var txt = document.createElement('div');
    txt.className = 'txt';
    txt.textContent = D.text;

    var btns = document.createElement('div');
    btns.className = 'btns';

    var bNo = document.createElement('button');
    bNo.id = 'ga-decline'; bNo.textContent = D.no;

    var bOk = document.createElement('button');
    bOk.id = 'ga-accept'; bOk.className = 'primary'; bOk.textContent = D.ok;

    btns.appendChild(bNo); btns.appendChild(bOk);
    bannerEl.appendChild(txt); bannerEl.appendChild(btns);
    document.body.appendChild(bannerEl);

    // handlers
    bOk.addEventListener('click', accept, {passive:true});
    bNo.addEventListener('click', decline, {passive:true});
  }

  function i18nBanner(){
    if (!bannerEl) return;
    var D = dict();
    var txt = bannerEl.querySelector('.txt');
    var ok  = bannerEl.querySelector('#ga-accept');
    var no  = bannerEl.querySelector('#ga-decline');
    if (txt) txt.textContent = D.text;
    if (ok)  ok.textContent  = D.ok;
    if (no)  no.textContent  = D.no;
  }

  function showBanner(){
    if (bannerEl) { bannerEl.classList.remove('hide'); return; }
    buildBanner();
    requestAnimationFrame(function(){ bannerEl.classList.remove('hide'); });
  }
  function hideBanner(){
    if (!bannerEl) return;
    bannerEl.classList.add('hide');
    setTimeout(function(){ if (bannerEl){ bannerEl.remove(); bannerEl=null; } }, 220);
  }

  function accept(){
    try { localStorage.setItem('ga_consent','yes'); } catch(_) {}
    gtag('consent', 'update', {
      ad_storage:'granted',
      analytics_storage:'granted',
      functionality_storage:'granted',
      ad_user_data:'granted',
      ad_personalization:'granted'
    });
    loadGA();
    hideBanner();
  }
  function decline(){
    try { localStorage.setItem('ga_consent','no'); } catch(_) {}
    gtag('consent', 'update', {
      ad_storage:'denied',
      analytics_storage:'denied',
      functionality_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    });
    hideBanner();
  }

  // ----- инициализация -----
  function init(){
    // если пользователь уже выбрал — применяем и грузим GA (только при согласии)
    var v = null;
    try { v = localStorage.getItem('ga_consent'); } catch(_) {}
    if (v === 'yes') {
      gtag('consent','update', {
        ad_storage:'granted',
        analytics_storage:'granted',
        functionality_storage:'granted',
        ad_user_data:'granted',
        ad_personalization:'granted'
      });
      loadGA();
    } else if (v === 'no') {
      // явно отказан — ничего не делаем
    } else {
      // запроса не было — показываем баннер
      showBanner();
    }

    // обновлять тексты при смене языка (data-lang)
    try {
      var mo = new MutationObserver(i18nBanner);
      mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-lang'] });
    } catch(_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }

  // Экспорт (настройки/юридическая страница)
  window.GAConsent = {
    accept: accept,
    decline: decline,
    revoke: function(){
      try { localStorage.removeItem('ga_consent'); } catch(_) {}
      gtag('consent','update', {
        ad_storage:'denied',
        analytics_storage:'denied',
        functionality_storage:'denied',
        ad_user_data:'denied',
        ad_personalization:'denied'
      });
      showBanner();
    }
  };
})();
