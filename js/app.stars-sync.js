/* app.stars-sync.js — мост синхронизации звёзд между legacy и Progress */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /**
   * Синхронизирует звёзды между A.state.stars (legacy) и A.Progress.store.stars (новый прогресс).
   * mode:
   *  - 'merge'              — объединяет, беря максимум по каждому ключу (без потерь)
   *  - 'state->progress'    — перезаписывает Progress из legacy
   *  - 'progress->state'    — перезаписывает legacy из Progress
   */
  A.syncStars = function(mode = 'merge'){
    try{
      A.state = A.state || {};
      A.state.stars = A.state.stars || {};
      const stA = A.state.stars;

      const hasP = !!(A.Progress && A.Progress.store);
      const stP = hasP ? (A.Progress.store.stars || (A.Progress.store.stars = {})) : null;

      if (!hasP) {
        A.saveState && A.saveState(A.state);
        return;
      }

      if (mode === 'state->progress'){
        A.Progress.store.stars = { ...stA };
      } else if (mode === 'progress->state'){
        A.state.stars = { ...(stP || {}) };
        A.saveState && A.saveState(A.state);
      } else {
        // merge: максимум по ключам
        const out = { ...(stP || {}) };
        for (const k in stA) {
          const a = Number(stA[k] || 0);
          const p = Number(out[k] || 0);
          if (a > p) out[k] = a;
        }
        A.Progress.store.stars = out;
        A.state.stars = { ...out };
        A.saveState && A.saveState(A.state);
      }

      // Пересчитать агрегаты и сохранить
      if (A.Progress && typeof A.Progress.recomputeFrom === 'function') {
        A.Progress.recomputeFrom(A.state.stars);
        A.Progress._save && A.Progress._save();
      }

      try { document.dispatchEvent(new Event('lexi:stars-changed')); } catch(_){}
    }catch(_){}
  };
})();
