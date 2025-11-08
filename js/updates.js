// updates.js — real update flow for PWA
(function(){
  const log = (...a)=>console.log('[updates]', ...a);

  async function checkForUpdates() {
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return; }

    // ask browser to check for a new SW
    await reg.update().catch(()=>{});

    // if a waiting SW is ready, skip waiting and reload after activation
    if (reg.waiting) {
      log('waiting SW found → activating');
      reg.waiting.postMessage({type:'SKIP_WAITING'});
      await new Promise(res => {
        navigator.serviceWorker.addEventListener('controllerchange', () => res(), {once:true});
      });
      location.reload();
      return;
    }

    // if SW is installing, wait till it becomes waiting
    if (reg.installing) {
      log('installing SW → wait');
      await new Promise(res => {
        reg.installing.addEventListener('statechange', function onsc(){
          if (reg.waiting) { reg.installing.removeEventListener('statechange', onsc); res(); }
        });
      });
      reg.waiting && reg.waiting.postMessage({type:'SKIP_WAITING'});
      await new Promise(res => {
        navigator.serviceWorker.addEventListener('controllerchange', () => res(), {once:true});
      });
      location.reload();
      return;
    }

    // No new SW. Force-refresh caches (stale-while-revalidate safety)
    try {
      const names = await caches.keys();
      await Promise.all(names.map(n => /^moyamova-cache-/.test(n) ? caches.delete(n) : Promise.resolve()));
    } catch(e){ log('cache cleanup fail', e); }
    location.reload();
  }

  // wire button
  const btn = document.getElementById('btnCheckUpdates');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = (btn.getAttribute('data-i18n')==='btnCheckUpdates') ? 'Обновляю…' : 'Updating…';
      checkForUpdates().catch(e=>{ console.warn(e); btn.disabled=false; btn.textContent='Проверить обновления'; });
    }, {passive:true});
  }

  // expose (optional)
  window.MoyaUpdates = { check: checkForUpdates };
})();
