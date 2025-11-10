/* ==========================================================
 * view.favorites.js — Экран «Избранное» в стиле «Мои ошибки»
 *  - Таблица словарей с избранными словами
 *  - Выбор строки + кнопка ОК/Тренироваться
 *  - 👁️ — предпросмотр, 🗑️ — удалить избранное по словарю
 *  - Старт тренировки по favorites:<uiLang>:<baseDeckKey> (>=4 слов)
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  function getUiLang(){
    try{
      const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
      return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }
  function T(){
    const uk = getUiLang()==='uk';
    return uk ? {
      title:'Обране',
      subtitle:'Словники з обраними словами',
      search:'Пошук…',
      sortName:'Назва',
      sortCount:'К-сть',
      ok:'Тренуватися',
      preview:'Перегляд',
      remove:'Очистити',
      empty:'Немає обраних слів'
    } : {
      title:'Избранное',
      subtitle:'Словари с избранными словами',
      search:'Поиск…',
      sortName:'Название',
      sortCount:'Кол-во',
      ok:'Тренироваться',
      preview:'Предпросмотр',
      remove:'Очистить',
      empty:'Нет избранных слов'
    };
  }

  function summarize(){
    try{
      if (A.Favorites && typeof A.Favorites.listSummary==='function') return A.Favorites.listSummary();
    }catch(_){}
    // Fallback: построим вручную
    const keys = (A.Decks && A.Decks.builtinKeys) ? (A.Decks.builtinKeys() || []) : [];
    const out = [];
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(k) || []) : [];
      let cnt = 0;
      for (let j=0;j<deck.length;j++){
        const w = deck[j];
        try { if (A.Favorites && A.Favorites.has && A.Favorites.has(k, w.id)) cnt++; }catch(_){}
      }
      if (cnt>0) out.push({ baseDeckKey:k, count:cnt });
    }
    return out;
  }

  function favoritesKeyFor(baseDeckKey){
    return 'favorites:' + getUiLang() + ':' + baseDeckKey;
  }

  function render(){
    try { A.Router && (A.Router.current='fav'); } catch(_){}
    const host = (A.DOM && A.DOM.app) ? A.DOM.app : document.getElementById('app');
    const Tt = T();

    const rows = summarize().map((row, idx) => {
      const base = row.baseDeckKey;
      const f = (A.Decks && A.Decks.flagForKey) ? A.Decks.flagForKey(base) : '🏷️';
      const name = (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(base) : base;
      return { idx:idx+1, baseDeckKey: base, count: row.count, flag: f, name: name };
    });

    const tableRows = rows.map(r => {
      const disabled = (r.count<4) ? ' data-disabled="1" aria-disabled="true" ' : '';
      return `<tr class="dict-row" data-key="${r.baseDeckKey}" ${disabled}>
        <td class="c-flag">${r.flag}</td>
        <td class="c-name">${r.name}</td>
        <td class="c-count">${r.count}</td>
        <td class="c-actions">
          <button class="btn btn-xs js-preview" aria-label="${Tt.preview}">👁️</button>
          <button class="btn btn-xs js-remove" aria-label="${Tt.remove}">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    host.innerHTML = `
      <section class="card">
        <header class="card__header">
          <h2 class="card__title">${Tt.title}</h2>
          <div class="card__subtitle">${Tt.subtitle}</div>
        </header>
        <div class="card__body">
          <div class="dicts__table-wrap">
            <table class="dict-table dict-table--mistakes">
              <thead>
                <tr>
                  <th>🏳️</th>
                  <th class="js-sort-name" role="button" tabindex="0">${Tt.sortName}</th>
                  <th class="js-sort-count" role="button" tabindex="0">${Tt.sortCount}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="4" style="opacity:.6">${Tt.empty}</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="dicts__actions">
            <button id="favStartBtn" class="btn btn-primary" disabled>${Tt.ok}</button>
          </div>
        </div>
      </section>
    `;

    let selectedKey = null;
    function updateStartBtn(){
      const btn = document.getElementById('favStartBtn');
      if (!btn) return;
      if (!selectedKey) { btn.disabled = true; return; }
      // find count from rows
      const row = rows.find(r=>r.baseDeckKey===selectedKey);
      btn.disabled = !(row && row.count >= 4);
    }

    function markSelection(key){
      selectedKey = key;
      const trs = host.querySelectorAll('tr.dict-row');
      trs.forEach(tr=>{
        tr.classList.toggle('is-selected', tr.getAttribute('data-key')===key);
      });
      updateStartBtn();
    }

    // Row click selects
    host.querySelectorAll('tr.dict-row').forEach(tr=>{
      tr.addEventListener('click', (ev)=>{
        const key = tr.getAttribute('data-key');
        // ignore click if came from actions
        const target = ev.target;
        if (target && (target.closest('.js-preview') || target.closest('.js-remove'))) return;
        markSelection(key);
      });
    });

    // Preview
    host.querySelectorAll('.js-preview').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const key = btn.closest('tr').getAttribute('data-key');
        openPreview(favoritesKeyFor(key));
      });
    });

    // Remove
    host.querySelectorAll('.js-remove').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const key = btn.closest('tr').getAttribute('data-key');
        try { A.Favorites && A.Favorites.clearForDeck && A.Favorites.clearForDeck(key); } catch(_){}
        render(); // re-render
      });
    });

    // Start training
    const startBtn = document.getElementById('favStartBtn');
    if (startBtn){
      startBtn.addEventListener('click', ()=>{
        if (!selectedKey) return;
        // only if >=4
        const row = rows.find(r=>r.baseDeckKey===selectedKey);
        if (!row || row.count<4) return;
        const vKey = favoritesKeyFor(selectedKey);
        try { A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(vKey); } catch(_){}
        try { A.Router && A.Router.routeTo && A.Router.routeTo('home'); } catch(_){}
      });
    }
  }

  // Preview modal similar to mistakes
  function openPreview(favKey){
    const Tt = T();
    const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(favKey) || []) : [];
    const rows = deck.slice(0, 100).map((w,i)=>{
      const term = w.word || w.term || '';
      const tr = w.ru || w.uk || w.en || w.tr || w.es || '';
      return `<tr><td>${i+1}</td><td>${term}</td><td>${tr}</td></tr>`;
    }).join('');

    const wrap = document.createElement('div');
    wrap.className = 'mmodal';
    wrap.innerHTML = `
      <div class="mmodal__overlay"></div>
      <div class="mmodal__dialog" role="dialog" aria-modal="true">
        <button class="mmodal__close" aria-label="Close">×</button>
        <div class="mmodal__content">
          <h3 style="margin-top:0">${Tt.preview}</h3>
          <table class="dict-table">
            <thead><tr><th>#</th><th>Word</th><th>Translation</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${Tt.empty}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>wrap.remove();
    wrap.querySelector('.mmodal__overlay').onclick = close;
    wrap.querySelector('.mmodal__close').onclick = close;
  }

  // Re-render on favorites changed
  function bindBus(){
    try{
      document.addEventListener('favorites:changed', function(){
        if (A.Router && A.Router.current==='fav') render();
      });
    }catch(_){}
  }

  A.ViewFavorites = { mount: render };
  bindBus();
})();
