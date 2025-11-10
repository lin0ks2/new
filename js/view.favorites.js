/* ==========================================================
 * view.favorites.js — Экран «Избранное» (полный клон верстки view.mistakes.js)
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
      sub:'Словники з обраними словами',
      empty:'Немає обраних слів',
      ok:'Ok',
      preview:'Перегляд',
      remove:'Очистити'
    } : {
      title:'Избранное',
      sub:'Словари с избранными словами',
      empty:'Нет избранных слов',
      ok:'Ok',
      preview:'Предпросмотр',
      remove:'Очистить'
    };
  }

  function favoritesKeyFor(baseDeckKey){ return 'favorites:' + getUiLang() + ':' + baseDeckKey; }
  function resolveNameByKey(key){ try{ return (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(key) : String(key); }catch(_){ return String(key); } }
  function flagForKey(key){ try{ return (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(key) || '🏳️') : '🏳️'; }catch(_){ return '🏳️'; } }

  function listFavoriteDecks(){
    try{
      if (A.Favorites && typeof A.Favorites.listSummary === 'function'){
        const sum = A.Favorites.listSummary() || [];
        return sum.map(x => ({ favoritesKey:favoritesKeyFor(x.baseDeckKey), baseDeckKey:x.baseDeckKey, count:x.count }));
      }
    }catch(_){}
    const built = (A.Decks && A.Decks.builtinKeys) ? (A.Decks.builtinKeys() || []) : [];
    const out = [];
    for (let i=0;i<built.length;i++){
      const base = built[i];
      const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(base) || []) : [];
      let cnt = 0;
      for (let j=0;j<deck.length;j++){
        const w = deck[j];
        try{ if (A.Favorites && A.Favorites.has && A.Favorites.has(base, w.id)) cnt++; }catch(_){}
      }
      if (cnt>0) out.push({ favoritesKey:favoritesKeyFor(base), baseDeckKey:base, count:cnt });
    }
    return out;
  }

  function openPreview(favKey){
    const t = T();
    const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(favKey) || []) : [];
    const rows = deck.slice(0,100).map((w,i)=>{
      const term = w.word || w.term || '';
      const tr = w.ru || w.uk || w.en || w.es || w.tr || '';
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

  function render(){
    const app = document.getElementById('app');
    if (!app) return;
    const t = T();

    const all = listFavoriteDecks();
    if (!all.length){
      app.innerHTML = `<div class="home"><section class="card"><h3 style="margin:0 0 6px;">${t.title}</h3><p style="opacity:.7; margin:0;">${t.empty}</p></section></div>`;
      return;
    }

    const headerFlag = flagForKey(all[0].baseDeckKey);

    const body = all.map(item=>{
      const flag = flagForKey(item.baseDeckKey);
      const name = resolveNameByKey(item.baseDeckKey);
      const disabled = (item.count < 4) ? ' data-disabled="1" aria-disabled="true"' : '';
      return `<tr class="dict-row" data-key="${item.favoritesKey}"${disabled}>
        <td class="c-flag">${flag}</td>
        <td class="c-name">${name}</td>
        <td class="c-count">${item.count}</td>
        <td class="c-actions">
          <button class="btn btn-xs js-preview" aria-label="${t.preview}">👁️</button>
          <button class="btn btn-xs js-remove" aria-label="${t.remove}">🗑️</button>
        </td>
      </tr>`;
    }).join('');

    app.innerHTML = `
      <div class="home">
        <section class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0 0 6px;">${t.title}</h3>
            <div style="border:1px solid rgba(255,255,255,.12);padding:.25rem .5rem;border-radius:.6rem;opacity:.9">${headerFlag}</div>
          </div>
          <p style="opacity:.7; margin:0;">${t.sub}</p>
          <div class="dicts">
            <div class="dicts__table-wrap">
              <table class="dict-table">
                <thead><tr><th>🏳️</th><th>Название</th><th>Кол-во</th><th></th></tr></thead>
                <tbody>${body}</tbody>
              </table>
            </div>
            <div class="dicts__actions" style="display:flex;justify-content:center;margin-top:12px;">
              <button class="btn btn-primary okBtn" id="favOk" disabled>${t.ok}</button>
            </div>
          </div>
        </section>
      </div>`;

    let selectedKey = null;
    function updateOk(){
      const el = document.getElementById('favOk');
      if (!el) return;
      if (!selectedKey){ el.disabled = true; return; }
      const row = app.querySelector('tr.dict-row.is-selected') || app.querySelector(`tr.dict-row[data-key="${selectedKey}"]`);
      const count = row ? Number((row.querySelector('.c-count')||{}).textContent || '0') : 0;
      el.disabled = !(count >= 4);
    }

    app.querySelectorAll('tr.dict-row').forEach(tr=>{
      tr.addEventListener('click', (e)=>{
        const tgt = e.target;
        if (tgt && (tgt.closest('.js-preview') || tgt.closest('.js-remove'))) return;
        selectedKey = tr.getAttribute('data-key');
        app.querySelectorAll('tr.dict-row').forEach(x=>x.classList.toggle('is-selected', x===tr));
        updateOk();
      });
    });

    app.querySelectorAll('.js-preview').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const favKey = btn.closest('tr').getAttribute('data-key');
        openPreview(favKey);
      });
    });
    app.querySelectorAll('.js-remove').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const favKey = btn.closest('tr').getAttribute('data-key');
        const m = String(favKey||'').match(/^favorites:(ru|uk):(.+)$/i);
        const base = m ? m[2] : null;
        if (base && A.Favorites && typeof A.Favorites.clearForDeck === 'function'){
          try{ A.Favorites.clearForDeck(base); }catch(_){}
          render();
        }
      });
    });

    const ok = document.getElementById('favOk');
    if (ok){
      ok.addEventListener('click', ()=>{
        if (!selectedKey) return;
        const row = app.querySelector('tr.dict-row.is-selected') || app.querySelector(`tr.dict-row[data-key="${selectedKey}"]`);
        const count = row ? Number((row.querySelector('.c-count')||{}).textContent || '0') : 0;
        if (count < 4) return;
        try{ A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(selectedKey); }catch(_){}
        try{ A.Router && A.Router.routeTo && A.Router.routeTo('home'); }catch(_){}
      });
    }
  }

  try{
    document.addEventListener('favorites:changed', function(){
      if (A.Router && A.Router.current==='fav') render();
    });
  }catch(_){}

  A.ViewFavorites = { mount: render };
})();
