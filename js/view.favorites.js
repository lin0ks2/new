/* view.favorites.js — aligned with 'dicts' and 'mistakes' ethalon views.
   Features:
   - Group favorites by base deck language; render flag buttons (alphabetical order).
   - Sort rows by deck name; show flag, name, count, actions.
   - Selection with .is-selected, persist last selection in A.settings.lastFavoritesKey.
   - OK enabled only when selected row has count >= 4 (can be adjusted).
   - Preview modal shows ONLY favorited words for the selected favorites bucket.
   - Delete clears favorites for that deck.
   - Robust goHome() similar to ethalon: tries Router, footer nav, then fallback.
*/

(function(){
  'use strict';

  // ---- Guards & shorthands
  const A = (window.A || (window.A = {}));
  const Views = (A.Views || (A.Views = {}));
  const settings = (A.settings || (A.settings = {}));
  const T = (window.T || function(){ return {
    title: 'Избранное',
    preview: 'Предпросмотр',
    remove: 'Удалить',
    ok: 'ОК',
    close: 'Закрыть',
    empty: 'Пусто',
  };});

  // ---- Utils that may exist in app; safe-fallbacks
  function getUiLang(){
    try{ return (A.ui && A.ui.lang) || settings.uiLang || 'ru'; } catch(_){ return 'ru'; }
  }
  function resolveNameByKey(deckKey){
    try{
      if (A.Decks && typeof A.Decks.nameOfKey === 'function') return A.Decks.nameOfKey(deckKey);
    }catch(_){}
    return String(deckKey||'').split(':').pop();
  }
  function flagForKey(deckKey){
    try{
      if (A.Decks && typeof A.Decks.flagForKey === 'function') return A.Decks.flagForKey(deckKey);
    }catch(_){}
    // fallback: emoji by lang code suffix
    const k = String(deckKey||'');
    if (/:(ru)\b/i.test(k)) return '🇷🇺';
    if (/:(uk)\b/i.test(k)) return '🇺🇦';
    return '🏳️';
  }
  function langOfKey(deckKey){
    try{
      if (A.Decks && typeof A.Decks.langOfKey === 'function') return A.Decks.langOfKey(deckKey);
    }catch(_){}
    // fallback: try parse "...:ru" or "...:uk"
    const m = String(deckKey||'').match(/:(ru|uk)\b/i);
    return m ? m[1].toLowerCase() : 'xx';
  }

  // ---- Favorites key helpers
  function parseFavoritesKey(key){
    // Expected pattern: favorites:<uiLang>:<baseDeckKey>
    const m = String(key||'').match(/^favorites:(ru|uk):(.+)$/i);
    return m ? { uiLang: m[1].toLowerCase(), baseDeckKey: m[2] } : null;
  }

  // Return array of word objects for the given favorites key (favorited items only)
  function resolveFavoritesDeckByKey(favKey){
    // If app provides a proper resolver, prefer it
    try{
      if (A.Favorites && typeof A.Favorites.resolveDeckForFavoritesKey === 'function'){
        const r = A.Favorites.resolveDeckForFavoritesKey(favKey);
        if (Array.isArray(r)) return r;
      }
    }catch(_){}
    // Fallback: assemble from base deck, filter by Favorites.has(base, id)
    const parsed = parseFavoritesKey(favKey);
    if (!parsed) return [];
    let full = [];
    try{
      if (A.Decks && typeof A.Decks.resolveDeckByKey === 'function'){
        full = A.Decks.resolveDeckByKey(parsed.baseDeckKey) || [];
      }
    }catch(_){ full = []; }
    return full.filter(w => {
      try{
        return !!(A.Favorites && typeof A.Favorites.has === 'function' && A.Favorites.has(parsed.baseDeckKey, w.id));
      }catch(_){ return false; }
    });
  }

  // ---- Data acquisition: list of favorites "buckets" (per base deck)
  function listFavoriteBuckets(){
    // Expect A.Favorites.list() -> [{ baseDeckKey, count }, ...] OR build from available decks
    if (A.Favorites && typeof A.Favorites.list === 'function'){
      try{
        const arr = A.Favorites.list() || [];
        return arr.map(row => {
          const baseDeckKey = row.baseDeckKey || row.key || row.deckKey || row.baseKey;
          const uiLang = getUiLang();
          return {
            baseDeckKey,
            favoritesKey: `favorites:${uiLang}:${baseDeckKey}`,
            count: Number(row.count || row.size || 0),
          };
        });
      }catch(_){}
    }
    // Fallback: scan all decks and count with Favorites.has
    let allDeckKeys = [];
    try{
      if (A.Decks && typeof A.Decks.keys === 'function') allDeckKeys = A.Decks.keys() || [];
    }catch(_){ allDeckKeys = []; }
    const uiLang = getUiLang();
    return allDeckKeys.map(baseDeckKey => {
      let count = 0;
      try{
        if (A.Decks && typeof A.Decks.resolveDeckByKey === 'function'){
          const deck = A.Decks.resolveDeckByKey(baseDeckKey) || [];
          for (const w of deck){
            try{ if (A.Favorites && typeof A.Favorites.has === 'function' && A.Favorites.has(baseDeckKey, w.id)) count++; }catch(_){}
          }
        }
      }catch(_){ count = 0; }
      return { baseDeckKey, favoritesKey: `favorites:${uiLang}:${baseDeckKey}`, count };
    }).filter(x => x.count > 0);
  }

  // ---- Modal (preview) renderer
  function openPreview(favKey){
    const t = T();
    const deck = resolveFavoritesDeckByKey(favKey) || [];
    const ui = getUiLang();
    const rows = deck.map((w,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${w.word || w.term || ''}</td>
        <td>${ui==='uk' ? (w.uk || w.translation_uk || '') : (w.ru || w.translation_ru || '')}</td>
      </tr>`).join('');

    const wrap = document.createElement('div');
    wrap.className = 'mmodal is-open';
    wrap.innerHTML = `
      <div class="mmodal__overlay"></div>
      <div class="mmodal__panel" role="dialog" aria-modal="true">
        <div class="mmodal__header">
          <h3>${t.preview}</h3>
          <button class="mmodal__close" aria-label="${t.close}">✕</button>
        </div>
        <div class="mmodal__body">
          <table class="dict-table">
            <thead>
              <tr><th>#</th><th>${ui==='uk'?'Слово':'Слово'}</th><th>${ui==='uk'?'Переклад':'Перевод'}</th></tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${t.empty}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const close = ()=>wrap.remove();
    wrap.querySelector('.mmodal__overlay').onclick = close;
    wrap.querySelector('.mmodal__close').onclick = close;
  }

  // ---- Navigation helpers
  function setFooterActive(name){
    try{
      const footer = document.querySelector('footer.app-footer');
      if (!footer) return;
      footer.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const btn = footer.querySelector(`.nav-btn[data-action="${name}"]`);
      if (btn) btn.classList.add('active');
    }catch(_){}
  }
  function goHome(){
    setFooterActive('home');
    try {
      if (window.Router && typeof window.Router.routeTo === 'function') { window.Router.routeTo('home'); return; }
      if (A.Router && typeof A.Router.routeTo === 'function')         { A.Router.routeTo('home'); return; }
    } catch(_){}
    const homeBtn = document.querySelector('footer .nav-btn[data-action="home"]');
    if (homeBtn) { homeBtn.click(); return; }
    document.body.setAttribute('data-route','home');
    try { document.dispatchEvent(new Event('lexitron:route-changed')); } catch(_){}
    try { window.dispatchEvent(new Event('lexitron:route-changed')); } catch(_){}
  }

  // ---- View boot
  Views.Favorites = function mountFavoritesView(root){
    const t = T();
    const app = (root || document);
    const container = app.querySelector('#favorites-view') || app;

    // gather buckets
    const bucketsRaw = listFavoriteBuckets().map(row => {
      const baseLang = langOfKey(row.baseDeckKey);
      return Object.assign({}, row, { baseLang });
    });

    // group by language
    const byLang = bucketsRaw.reduce((acc, row)=>{
      (acc[row.baseLang] || (acc[row.baseLang]=[])).push(row);
      return acc;
    }, {});

    // languages order — alphabetical (as in ethalon)
    const langs = Object.keys(byLang).sort();

    // active language
    let activeLang = settings.favoritesLang && langs.includes(settings.favoritesLang)
      ? settings.favoritesLang
      : (langs[0] || 'xx');

    // DOM skeleton
    container.innerHTML = `
      <section class="panel panel--favorites">
        <header class="panel__header">
          <h2 class="panel__title">${t.title}</h2>
          <div id="favorites-flags" class="dict-flags"></div>
        </header>
        <div class="panel__body">
          <table class="dict-table" id="favorites-table">
            <thead>
              <tr>
                <th style="width:48px"></th>
                <th>${'Название'}</th>
                <th class="t-right" style="width:88px">#</th>
                <th class="t-center" style="width:110px">${t.preview}</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <footer class="panel__footer">
          <button id="favorites-apply" class="btn btn--primary" disabled>${t.ok}</button>
        </footer>
      </section>
    `;

    const tbody = container.querySelector('#favorites-table tbody');
    const okBtn = container.querySelector('#favorites-apply');
    const flagsBox = container.querySelector('#favorites-flags');

    let selectedKey = settings.lastFavoritesKey || null;

    function renderFlagsUI(){
      if (!flagsBox) return;
      flagsBox.innerHTML = '';
      langs.forEach(lang=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dict-flag' + (lang===activeLang ? ' active' : '');
        btn.dataset.lang = lang;
        btn.title = lang.toUpperCase();
        // try to show a flag derived from the first deck of that lang
        let label = lang.toUpperCase();
        try{
          const first = byLang[lang] && byLang[lang][0];
          if (first) label = flagForKey(first.baseDeckKey);
        }catch(_){}
        btn.textContent = label;
        btn.addEventListener('click', ()=>{
          if (lang === activeLang) return;
          activeLang = lang;
          try{ settings.favoritesLang = lang; }catch(_){}
          renderList();
          restoreSelection();
          updateOk();
          // re-highlight
          flagsBox.querySelectorAll('.dict-flag').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
        });
        flagsBox.appendChild(btn);
      });
    }

    function renderList(){
      const list = (byLang[activeLang] || []).slice()
        .sort((a,b)=> resolveNameByKey(a.baseDeckKey).localeCompare(resolveNameByKey(b.baseDeckKey)));

      const html = list.map(item=>{
        const name = resolveNameByKey(item.baseDeckKey);
        const count = Number(item.count||0);
        const disabled = (count < 4); // keep parity with ethalon threshold
        return `<tr class="dict-row${disabled?' is-disabled':''}" data-key="${item.favoritesKey}" data-count="${count}">
          <td class="c-flag">${flagForKey(item.baseDeckKey)}</td>
          <td class="c-name">${name}</td>
          <td class="c-count t-right">${count}</td>
          <td class="t-center">
            <button type="button" class="link-btn favorites-preview" title="${t.preview}">👁️</button>
            <button type="button" class="link-btn favorites-delete" title="${t.remove}" style="margin-left:10px;">🗑️</button>
          </td>
        </tr>`;
      }).join('');

      tbody.innerHTML = html || `<tr><td colspan="4" style="opacity:.6">${T().empty}</td></tr>`;

      // attach handlers
      tbody.querySelectorAll('tr.dict-row').forEach(tr=>{
        tr.addEventListener('click', (e)=>{
          if (tr.classList.contains('is-disabled')) return;
          const tgt = e.target;
          if (tgt && (tgt.closest('.favorites-preview') || tgt.closest('.favorites-delete'))) return;
          tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
          tr.classList.add('is-selected');
          selectedKey = tr.getAttribute('data-key');
          try{ settings.lastFavoritesKey = selectedKey; }catch(_){}
          updateOk();
        });
      });
      tbody.querySelectorAll('.favorites-preview').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const tr = btn.closest('tr');
          if (!tr) return;
          openPreview(tr.getAttribute('data-key'));
        });
      });
      tbody.querySelectorAll('.favorites-delete').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const tr = btn.closest('tr');
          if (!tr) return;
          const favKey = tr.getAttribute('data-key');
          const parsed = parseFavoritesKey(favKey);
          if (parsed && A.Favorites && typeof A.Favorites.clearForDeck === 'function'){
            try{ A.Favorites.clearForDeck(parsed.baseDeckKey); }catch(_){}
            // Update counts locally
            const arr = byLang[activeLang] || [];
            const row = arr.find(x=>x.favoritesKey===favKey);
            if (row) row.count = 0;
            renderList();
            restoreSelection();
            updateOk();
          }
        });
      });
    }

    function restoreSelection(){
      if (!selectedKey) return;
      const row = tbody.querySelector(`tr.dict-row[data-key="${CSS.escape(selectedKey)}"]`);
      if (!row || row.classList.contains('is-disabled')){
        selectedKey = null;
        tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
        return;
      }
      tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
      row.classList.add('is-selected');
    }

    function updateOk(){
      if (!okBtn) return;
      if (!selectedKey){ okBtn.disabled = true; return; }
      const row = tbody.querySelector(`tr.dict-row.is-selected`);
      const count = row ? Number(row.getAttribute('data-count')||'0') : 0;
      okBtn.disabled = !(count >= 4);
    }

    if (okBtn){
      okBtn.addEventListener('click', ()=>{
        if (!selectedKey) return;
        const row = tbody.querySelector(`tr.dict-row.is-selected`);
        if (!row) return;
        const count = Number(row.getAttribute('data-count')||'0');
        if (count < 4) return;
        try{ A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(selectedKey); }catch(_){}
        try{ document.dispatchEvent(new CustomEvent('lexitron:deck-selected', { detail:{ key: selectedKey } })); }catch(_){}
        goHome();
      });
    }

    // Initial paint
    renderFlagsUI();
    renderList();
    restoreSelection();
    updateOk();

    return {
      dispose(){
        // no-op; add cleanup if needed
      }
    };
  };

  // Auto-mount if element is present
  document.addEventListener('DOMContentLoaded', function(){
    const el = document.getElementById('favorites-view');
    if (el) Views.Favorites(el);
  });

})();
