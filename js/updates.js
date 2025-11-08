// updates.js — Live update with i18n toast + smooth reload
(function(){
  const lang = (document.documentElement.dataset.lang || (navigator.language||'ru').slice(0,2) || 'ru').toLowerCase();
  const T = {
    ru: {
      checking: 'Проверяю обновления…',
      found:    'Найдена новая версия. Обновляю…',
      upToDate: 'У вас актуальная версия',
      reloading:'Перезапускаю…'
    },
    uk: {
      checking: 'Перевіряю оновлення…',
      found:    'Знайдено нову версію. Оновлюю…',
      upToDate: 'У вас актуальна версія',
      reloading:'Перезапускаю…'
    },
    en: {
      checking: 'Checking for updates…',
      found:    'New version found. Updating…',
      upToDate: 'You’re on the latest version',
      reloading:'Reloading…'
    }
  };
  function t(k){ return (T[lang] && T[lang][k]) || (T.ru && T.ru[k]) || k; }

  // ---- Toast UI ----
  let toastRoot, styleTag, overlayEl;
  function ensureUI(){
    if (!styleTag){
      styleTag = document.createElement('style');
      styleTag.textContent = `
      .toast-root{position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:center;pointer-events:none;z-index:2147483645}
      .toast{pointer-events:auto;max-width:92vw;display:inline-flex;gap:.6rem;align-items:center;padding:.6rem .9rem;border-radius:12px;border:1px solid rgba(0,0,0,.06);background:rgba(20, 30, 50, .92);color:#fff;backdrop-filter:saturate(1.2) blur(6px);
             box-shadow:0 8px 28px rgba(0,0,0,.25); font:14px/1.25 system-ui,-apple-system,Segoe UI,Roboto,Arial}
      .toast.show{animation:toast-in .18s ease both}
      @keyframes toast-in{from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)}}
      .update-scrim{position:fixed;inset:0;background:rgba(0,0,0,.08);opacity:0;transition:opacity .18s ease;z-index:2147483644;backdrop-filter:saturate(1.2) blur(2px)}
      .update-scrim.show{opacity:1}
      `;
      document.head.appendChild(styleTag);
    }
    if (!toastRoot){
      toastRoot = document.createElement('div');
      toastRoot.className = 'toast-root';
      document.body.appendChild(toastRoot);
    }
  }
  function showToast(text, ms=1400){
    ensureUI();
    const el = document.createElement('div');
    el.className = 'toast show';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.textContent = text;
    toastRoot.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .18s ease'; setTimeout(()=>el.remove(), 220); }, ms);
  }
  function showOverlay(show){
    ensureUI();
    if (show && !overlayEl){
      overlayEl = document.createElement('div');
      overlayEl.className = 'update-scrim';
      document.body.appendChild(overlayEl);
      // async to allow paint
      requestAnimationFrame(()=> overlayEl.classList.add('show'));
    } else if (!show && overlayEl){
      overlayEl.classList.remove('show');
      setTimeout(()=>{ overlayEl && overlayEl.remove(); overlayEl=null; }, 200);
    }
  }

  async function checkForUpdates() {
    showToast(t('checking'), 1200);
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return; }

    // Ask browser to check for an updated SW
    await reg.update().catch(()=>{});

    if (reg.waiting) {
      // Smooth upgrade
      showToast(t('found'), 1200);
      showOverlay(true);
      try { sessionStorage.setItem('moya_upgrading','1'); } catch(_){}
      reg.waiting.postMessage({type:'SKIP_WAITING'});
      await new Promise(res => navigator.serviceWorker.addEventListener('controllerchange', ()=>res(), {once:true}));
      showToast(t('reloading'), 800);
      setTimeout(()=> location.reload(), 200);
      return;
    }

    if (reg.installing) {
      // Wait till it becomes waiting
      await new Promise(res => {
        reg.installing.addEventListener('statechange', function onsc(){
          if (reg.waiting) { reg.installing.removeEventListener('statechange', onsc); res(); }
        });
      });
      showToast(t('found'), 1200);
      showOverlay(true);
      try { sessionStorage.setItem('moya_upgrading','1'); } catch(_){}
      reg.waiting && reg.waiting.postMessage({type:'SKIP_WAITING'});
      await new Promise(res => navigator.serviceWorker.addEventListener('controllerchange', ()=>res(), {once:true}));
      showToast(t('reloading'), 800);
      setTimeout(()=> location.reload(), 200);
      return;
    }

    // No update available
    showToast(t('upToDate'), 1600);
  }

  const btn = document.getElementById('btnCheckUpdates');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = t('checking');
      checkForUpdates().finally(()=>{
        btn.disabled = false;
        setTimeout(()=>{ btn.textContent = prev; }, 1000);
      });
    }, {passive:true});
  }

  // Expose API
  window.MoyaUpdates = { check: checkForUpdates, showToast };
})();
