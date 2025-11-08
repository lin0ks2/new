// updates.js — Live update with SINGLE toast, no overlap, dynamic i18n, debounced binding
(function(){
  // ---- Language detection (dynamic) ----
  function resolveLang(){
    var l = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.lang) || '';
    l = (l||'').toLowerCase();
    try {
      if (!l && window.App) {
        if (typeof App.getUiLang === 'function') l = (App.getUiLang()||'').toLowerCase();
        else if (App.UI_LANG) l = (''+App.UI_LANG).toLowerCase();
        else if (App.uiLang) l = (''+App.uiLang).toLowerCase();
      }
    } catch(_){}
    try {
      if (!l) l = (localStorage.getItem('ui_lang') || localStorage.getItem('uiLang') || '').toLowerCase();
    } catch(_){}
    if (!l) l = ((navigator.language||'ru').slice(0,2) || 'ru').toLowerCase();
    if (l === 'ua') l = 'uk';
    if (!/^(ru|uk|en)$/.test(l)) l = 'en';
    return l;
  }
  function dict(lang){
    var T={
      ru:{checking:'Проверяю обновления…',found:'Найдена новая версия. Обновляю…',upToDate:'У вас актуальная версия',reloading:'Перезапускаю…'},
      uk:{checking:'Перевіряю оновлення…',found:'Знайдено нову версію. Оновлюю…',upToDate:'У вас актуальна версія',reloading:'Перезапускаю…'},
      en:{checking:'Checking for updates…',found:'New version found. Updating…',upToDate:'You’re on the latest version',reloading:'Reloading…'}
    }; return T[lang]||T.en;
  }
  function t(k){ return dict(resolveLang())[k]||k; }

  // ---- UI (single toast + overlay) ----
  var styleTag, toastRoot, toastEl, overlayEl, hideTimer;
  function ensureUI(){
    if (!styleTag){
      styleTag=document.createElement('style');
      styleTag.textContent=`
      .toast-root{position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:center;pointer-events:none;z-index:2147483645}
      .toast{pointer-events:auto;max-width:92vw;display:inline-flex;gap:.6rem;align-items:center;padding:.6rem .9rem;border-radius:12px;border:1px solid rgba(0,0,0,.06);background:rgba(20, 30, 50, .92);color:#fff;backdrop-filter:saturate(1.2) blur(6px);
             box-shadow:0 8px 28px rgba(0,0,0,.25); font:14px/1.25 system-ui,-apple-system,Segoe UI,Roboto,Arial; opacity:0; transform:translateY(8px); transition:opacity .18s ease, transform .18s ease}
      .toast.show{opacity:1; transform:translateY(0)}
      .update-scrim{position:fixed;inset:0;background:rgba(0,0,0,.08);opacity:0;transition:opacity .18s ease;z-index:2147483644;backdrop-filter:saturate(1.2) blur(2px)}
      .update-scrim.show{opacity:1}`;
      document.head.appendChild(styleTag);
    }
    if (!toastRoot){
      toastRoot=document.createElement('div');
      toastRoot.className='toast-root';
      document.body.appendChild(toastRoot);
    }
    if (!toastEl){
      toastEl=document.createElement('div');
      toastEl.className='toast';
      toastEl.setAttribute('role','status');
      toastEl.setAttribute('aria-live','polite');
      toastRoot.appendChild(toastEl);
    }
  }
  function setToast(text, showMs){
    ensureUI();
    if (hideTimer){ clearTimeout(hideTimer); hideTimer=null; }
    toastEl.textContent=text;
    // reveal
    requestAnimationFrame(function(){ toastEl.classList.add('show'); });
    if (showMs){
      hideTimer=setTimeout(hideToast, showMs);
    }
  }
  function hideToast(){
    if (!toastEl) return;
    toastEl.classList.remove('show');
  }
  function showOverlay(show){
    ensureUI();
    if (show && !overlayEl){
      overlayEl=document.createElement('div'); overlayEl.className='update-scrim'; document.body.appendChild(overlayEl);
      requestAnimationFrame(function(){ overlayEl.classList.add('show'); });
    } else if (!show && overlayEl){
      overlayEl.classList.remove('show');
      setTimeout(function(){ if (overlayEl){ overlayEl.remove(); overlayEl=null; } }, 200);
    }
  }

  // ---- Update flow (single in-flight) ----
  var inFlight=false;
  async function checkForUpdates() {
    if (inFlight) return; inFlight=true;
    setToast(t('checking')); // no auto-hide yet
    try{
      if (!('serviceWorker' in navigator)) { location.reload(); return; }
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { location.reload(); return; }

      await reg.update().catch(function(){});

      if (reg.waiting) {
        setToast(t('found'));
        showOverlay(true);
        try { sessionStorage.setItem('moya_upgrading','1'); } catch(_){}
        reg.waiting.postMessage({type:'SKIP_WAITING'});
        await new Promise(function(res){ navigator.serviceWorker.addEventListener('controllerchange', function(){ res(); }, {once:true}); });
        setToast(t('reloading'));
        setTimeout(function(){ location.reload(); }, 200);
        return;
      }
      if (reg.installing) {
        await new Promise(function(res){
          reg.installing.addEventListener('statechange', function onsc(){
            if (reg.waiting) { reg.installing.removeEventListener('statechange', onsc); res(); }
          });
        });
        setToast(t('found'));
        showOverlay(true);
        try { sessionStorage.setItem('moya_upgrading','1'); } catch(_){}
        if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
        await new Promise(function(res){ navigator.serviceWorker.addEventListener('controllerchange', function(){ res(); }, {once:true}); });
        setToast(t('reloading'));
        setTimeout(function(){ location.reload(); }, 200);
        return;
      }

      // No update found
      setToast(t('upToDate'), 1400);
      setTimeout(hideToast, 1400);
    } finally {
      // Hide overlay if was shown (safety)
      showOverlay(false);
      inFlight=false;
    }
  }

  // ---- Bind once
  var btn = document.getElementById('btnCheckUpdates');
  if (btn && !btn.dataset.updatesBound){
    btn.dataset.updatesBound='1';
    btn.addEventListener('click', function(){
      if (inFlight) return;
      var prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('checking');
      checkForUpdates().finally(function(){
        btn.disabled = false;
        setTimeout(function(){ btn.textContent = prev; }, 500);
      });
    }, {passive:true});
  }

  // Observe language changes (toasts pick up new lang automatically via t())
  try{
    var mo = new MutationObserver(function(){ /* no-op */ });
    mo.observe(document.documentElement, {attributes:true, attributeFilter:['data-lang']});
  }catch(_){}

  // Expose API
  window.MoyaUpdates = { check: checkForUpdates, setToast, hideToast };
})();
