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
            empty:'Немає обраних слів',
      ok:'Ok',
      preview:'Перегляд',
      remove:'Очистити'
    } : {
      title:'Избранное',
            empty:'Нет избранных слов',
      ok:'Ok',
      preview:'Предпросмотр',
      remove:'Очистить'
    };
  }

  function favoritesKeyFor(baseDeckKey){ return 'favorites:' + getUiLang() + ':' + baseDeckKey; }
  function resolveNameByKey(key){ try{ return (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(key) : String(key); }catch(_){ return String(key); } }
  function flagForKey(key){ try{ return (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(key) || '') : ''; }catch(_){ return '🏳️'; } }

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
      <div class="mmodal__panel" role="dialog" aria-modal="true">
        <button class="mmodal__close" aria-label="Close">×</button>
        <div class="mmodal__body">
          <div class="dicts-header">
  <h3 style="margin-top:0">${t.preview}</h3>
  <div id="favorites-flags" class="dicts-flags"></div>
</div>
          <table class="dicts-table">
            
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
    
    // Group by base language (same as mistakes)
    const byLang = all.reduce((acc, row)=>{
      const lg = row.baseLang || 'xx';
      (acc[lg] || (acc[lg]=[])).push(row);
      return acc;
    }, {});
    const langs = Object.keys(byLang);

    // Active language: load from settings, else first
    let activeLang = (function(){
      try { return (A.settings && A.settings.favoritesLang) || langs[0] || null; } catch(_) { return langs[0] || null; }
    })();
    if (!activeLang || !byLang[activeLang]) activeLang = langs[0] || null;
    const list = activeLang ? byLang[activeLang] : all;
    if (!all.length){ app.innerHTML = `<div class='home'><section class='card dicts-card'><h3 style='margin:0 0 6px;'>${t.title}</h3><p style='opacity:.7; margin:0;'>${t.empty}</p></section></div>`;
    // Render language flags (visual + filtering) identical to mistakes
    (function renderFlags(){
      try{
        const wrap = document.getElementById('favorites-flags');
        if (!wrap) return;
        wrap.innerHTML = (langs.length ? langs : []).map((lg)=>{
          const sample = (byLang[lg] && byLang[lg][0]) || null;
          if (!sample) return '';
          const f = flagForKey(sample.baseDeckKey);
          const isActive = (lg === activeLang);
          return `<button type="button" class="dict-flag${isActive?' active':''}" data-lang="${lg}" aria-pressed="${isActive?'true':'false'}">${f}</button>`;
        }).join('');
        wrap.querySelectorAll('.dict-flag').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const lg = btn.getAttribute('data-lang');
            try { (A.settings || (A.settings={})).favoritesLang = lg; } catch(_){}
            render();
          });
        });
      }catch(_){}
    })();

    // Restore last selected favorites row (and persist on click)
    (function restoreSelection(){
      try{
        const lastKey = (A.settings && A.settings.lastFavoritesKey) || null;
        const rows = Array.from(document.querySelectorAll('tr.dict-row'));
        let set = false;
        if (lastKey){
          const tr = rows.find(r => r.getAttribute('data-key') === lastKey);
          if (tr){ tr.classList.add('is-selected'); set = true; }
        }
        if (!set && rows.length){ rows[0].classList.add('is-selected'); }
      }catch(_){}
    })();
     return; }

    

    const body = list.map(item=>{
      const flag = flagForKey(item.baseDeckKey);
      const name = resolveNameByKey(item.baseDeckKey);
      const disabled = (item.count < 4) ? ' data-disabled="1" aria-disabled="true"' : '';
      return `<tr class="dict-row" data-key="${item.favoritesKey}"${disabled}>
        <td class="c-flag">${flag}</td>
        <td class="c-name">${name}</td>
        <td class="t-center">${item.count}</td>
        <td class="t-center">
          <span class="mistakes-preview" title="Предпросмотр" aria-label="Предпросмотр">👁️</span>
          <span class="mistakes-delete" title="Удалить" aria-label="Удалить" style="margin-left:10px;">🗑️</span>
        </td>
      </tr>`;
    }).join('');

    app.innerHTML = `
      <div class="home">
        <section class="card dicts-card">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0 0 6px;">${t.title}</h3>
          </div>
          <div class="dicts">
            <div class="dicts-table-wrap">
              <table class="dicts-table">
                
                <tbody>${body}</tbody>
              </table>
            </div>
            <div class="dicts-actions" style="display:flex;justify-content:center;margin-top:12px;">
              <button class="btn-primary" id="favorites-apply" disabled>${t.ok}</button>
            </div>
          </div>
        </section>
      </div>`;

    let selectedKey = null;
    function updateOk(){
      const el = document.getElementById('favorites-apply');
      if (!el) return;
      if (!selectedKey){ el.disabled = true; return; }
      const row = app.querySelector('tr.dict-row.is-selected') || app.querySelector(`tr.dict-row[data-key="${selectedKey}"]`);
      const count = row ? Number((row.querySelector('.c-count')||{}).textContent || '0') : 0;
      el.disabled = !(count >= 4);
    }

    app.querySelectorAll('tr.dict-row').forEach(tr=>{
      tr.addEventListener('click', (e)=>{
        const tgt = e.target;
        if (tgt && (tgt.closest('.mistakes-preview') || tgt.closest('.mistakes-delete'))) return;
        selectedKey = tr.getAttribute('data-key');
        app.querySelectorAll('tr.dict-row').forEach(x=>x.classList.toggle('is-selected', x===tr));
        try { (A.settings || (A.settings={})).lastFavoritesKey = selectedKey; } catch(_){}
        updateOk();
      });
    });

    app.querySelectorAll('.mistakes-preview').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const favKey = btn.closest('tr').getAttribute('data-key');
        openPreview(favKey);
      });
    });
    app.querySelectorAll('.mistakes-delete').forEach(btn=>{
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

    const ok = document.getElementById('favorites-apply');
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
