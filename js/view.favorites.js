/* ==========================================================
 * view.favorites.js — Экран «Избранное» (визуал 1:1 с «Мои ошибки»)
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
      sortName:'Назва',
      sortCount:'К-сть',
      ok:'Ok',
      preview:'Перегляд',
      remove:'Очистити',
      empty:'Немає обраних слів'
    } : {
      title:'Избранное',
      subtitle:'Словари с избранными словами',
      sortName:'Название',
      sortCount:'Кол-во',
      ok:'Ok',
      preview:'Предпросмотр',
      remove:'Очистить',
      empty:'Нет избранных слов'
    };
  }

  function summarize(){
    const keys = (A.Decks && A.Decks.builtinKeys) ? (A.Decks.builtinKeys() || []) : [];
    const out = [];
    for (let i=0;i<keys.length;i++){
      const k = keys[i];
      const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(k) || []) : [];
      let cnt = 0;
      for (let j=0;j<deck.length;j++){
        const w = deck[j];
        try { if (A.Favorites && A.Favorites.has && A.Favorites.has(k, w.id)) cnt++; } catch(_){}
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
    const t = T();

    const rows = summarize().map((row) => {
      const base = row.baseDeckKey;
      const f = (A.Decks && A.Decks.flagForKey) ? A.Decks.flagForKey(base) : '🏷️';
      const name = (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(base) : base;
      return { baseDeckKey: base, count: row.count, flag: f, name: name };
    });

    const body = rows.map(r=>{
      const disabled = r.count<4 ? ' data-disabled="1" aria-disabled="true"' : '';
      return `<tr class="dict-row" data-key="${r.baseDeckKey}"${disabled}>
        <td class="c-flag">${r.flag}</td>
        <td class="c-name">${r.name}</td>
        <td class="c-count">${r.count}</td>
        <td class="c-actions">
          <button class="btn btn-xs js-preview" aria-label="${t.preview}">👁️</button>
          <button class="btn btn-xs js-remove" aria-label="${t.remove}">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    const badgeFlag = rows.length ? rows[0].flag : '🇩🇪';

    host.innerHTML = `
      <div class="home">
        <section class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0 0 6px;">${t.title}</h3>
            <div style="border:1px solid rgba(255,255,255,.12);padding:.25rem .5rem;border-radius:.6rem;opacity:.9">${badgeFlag}</div>
          </div>
          <div style="opacity:.7;margin:0 0 .75rem">${t.subtitle}</div>

          <div class="dicts">
            <div class="dicts__table-wrap">
              <table class="dict-table">
                <thead>
                  <tr>
                    <th>🏳️</th>
                    <th>${t.sortName}</th>
                    <th>${t.sortCount}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${body || `<tr><td colspan="4" style="opacity:.6">${t.empty}</td></tr>`}
                </tbody>
              </table>
            </div>

            <div style="display:flex;justify-content:center;margin-top:12px">
              <button id="favStartBtn" class="btn btn-primary" disabled>${t.ok}</button>
            </div>
          </div>
        </section>
      </div>
    `;

    let selectedKey = null;
    function updateStartBtn(){
      const btn = document.getElementById('favStartBtn');
      if (!btn) return;
      const row = rows.find(r=>r.baseDeckKey===selectedKey);
      btn.disabled = !(row && row.count >= 4);
    }
    function markSelection(key){
      selectedKey = key;
      host.querySelectorAll('tr.dict-row').forEach(tr=>{
        tr.classList.toggle('is-selected', tr.getAttribute('data-key')===key);
      });
      updateStartBtn();
    }

    host.querySelectorAll('tr.dict-row').forEach(tr=>{
      tr.addEventListener('click', (ev)=>{
        const key = tr.getAttribute('data-key');
        const t = ev.target;
        if (t && (t.closest('.js-preview') || t.closest('.js-remove'))) return;
        markSelection(key);
      });
    });

    host.querySelectorAll('.js-preview').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const key = btn.closest('tr').getAttribute('data-key');
        openPreview(favoritesKeyFor(key));
      });
    });

    host.querySelectorAll('.js-remove').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const key = btn.closest('tr').getAttribute('data-key');
        try { A.Favorites && A.Favorites.clearForDeck && A.Favorites.clearForDeck(key); } catch(_){}
        render();
      });
    });

    const startBtn = document.getElementById('favStartBtn');
    if (startBtn){
      startBtn.addEventListener('click', ()=>{
        const row = rows.find(r=>r.baseDeckKey===selectedKey);
        if (!row || row.count<4) return;
        const vKey = favoritesKeyFor(selectedKey);
        try { A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(vKey); } catch(_){}
        try { A.Router && A.Router.routeTo && A.Router.routeTo('home'); } catch(_){}
      });
    }
  }

  function openPreview(favKey){
    const t = T();
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
          <h3 style="margin-top:0">${t.preview}</h3>
          <table class="dict-table">
            <thead><tr><th>#</th><th>Word</th><th>Translation</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${t.empty}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>wrap.remove();
    wrap.querySelector('.mmodal__overlay').onclick = close;
    wrap.querySelector('.mmodal__close').onclick = close;
  }

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
