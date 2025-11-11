/* ==========================================================
 * view.favorites.js — Экран «Избранное» (как в эталонах)
 *  - Без самодельной регистрации маршрута
 *  - Экспорт: App.ViewFavorites.mount(root?) — по умолчанию рендер в #app
 *  - Автопатч роутера из home.js: добавляем кейс 'fav'/'favorites'
 *  - Кнопка ОК → App.Trainer.setDeckKey(key) → App.Router.routeTo('home')
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /* ---------------------- helpers ---------------------- */
  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return String(s).toLowerCase() === 'uk' ? 'uk' : 'ru';
  }
  function T(){
    const uk = getUiLang() === 'uk';
    return uk ? {
      title: 'Вибране',
      preview: 'Попередній перегляд',
      remove: 'Видалити',
      ok: 'ОК',
      close: 'Закрити',
      empty: 'Порожньо'
    } : {
      title: 'Избранное',
      preview: 'Предпросмотр',
      remove: 'Удалить',
      ok: 'ОК',
      close: 'Закрыть',
      empty: 'Пусто'
    };
  }
  function resolveNameByKey(key){
    try{ return A.Decks.resolveNameByKey(key); }catch(_){}
    return String(key||'').split(':').pop();
  }
  function flagForKey(key){
    try{ return A.Decks.flagForKey(key); }catch(_){ return '🏳️'; }
  }
  function langOfKey(key){
    try{ return A.Decks.langOfKey(key); }catch(_){ return 'xx'; }
  }
  function setFooterActive(action){
    try{
      document.querySelectorAll('.app-footer .nav-btn').forEach(b=>b.classList.remove('active'));
      const btn = document.querySelector(`.app-footer .nav-btn[data-action="${action}"]`);
      if (btn) btn.classList.add('active');
    }catch(_){}
  }

  /* ---------------------- favorites key ---------------------- */
  function makeFavKey(baseDeckKey){
    const ui = getUiLang();
    return `favorites:${ui}:${baseDeckKey}`;
  }
  function parseFavKey(key){
    const m = String(key||'').match(/^favorites:(ru|uk):(.+)$/i);
    return m ? { uiLang: m[1].toLowerCase(), baseDeckKey: m[2] } : null;
  }

  /* ---------------------- data: buckets & preview ---------------------- */
  function listFavoriteBuckets(){
    if (A.Favorites && typeof A.Favorites.list === 'function'){
      try{
        const ui = getUiLang();
        const arr = A.Favorites.list() || [];
        return arr.map(row=>{
          const baseDeckKey = row.baseDeckKey || row.key || row.deckKey || row.baseKey;
          return {
            baseDeckKey,
            favoritesKey: `favorites:${ui}:${baseDeckKey}`,
            count: Number(row.count || row.size || 0),
            baseLang: langOfKey(baseDeckKey)
          };
        }).filter(x=>x.count>0);
      }catch(_){}
    }
    // Fallback
    let keys = [];
    try{ keys = (A.Decks && A.Decks.keys && A.Decks.keys()) || []; }catch(_){ keys = []; }
    const ui = getUiLang();
    const out = [];
    for (const baseDeckKey of keys){
      let count = 0;
      try{
        const deck = (A.Decks && A.Decks.resolveDeckByKey && A.Decks.resolveDeckByKey(baseDeckKey)) || [];
        for (const w of deck){
          try{
            if (A.Favorites && A.Favorites.has && A.Favorites.has(baseDeckKey, w.id)) count++;
          }catch(_){}
        }
      }catch(_){}
      if (count>0) out.push({
        baseDeckKey,
        favoritesKey: `favorites:${ui}:${baseDeckKey}`,
        count,
        baseLang: langOfKey(baseDeckKey)
      });
    }
    return out;
  }

  function resolveFavoritesDeckByKey(favKey){
    try{
      if (A.Favorites && typeof A.Favorites.resolveDeckForFavoritesKey === 'function'){
        const deck = A.Favorites.resolveDeckForFavoritesKey(favKey);
        if (Array.isArray(deck)) return deck;
      }
    }catch(_){}
    const parsed = parseFavKey(favKey);
    if (!parsed) return [];
    let full = [];
    try{ full = (A.Decks && A.Decks.resolveDeckByKey && A.Decks.resolveDeckByKey(parsed.baseDeckKey)) || []; }catch(_){ full = []; }
    return full.filter(w=>{
      try{ return !!(A.Favorites && A.Favorites.has && A.Favorites.has(parsed.baseDeckKey, w.id)); }catch(_){ return false; }
    });
  }

  /* ---------------------- view core ---------------------- */
  function mount(root){
    const t = T();
    const host = root || document.getElementById('app') || document.body;

    // buckets → byLang
    const buckets = listFavoriteBuckets();
    const byLang = buckets.reduce((acc,row)=>{
      (acc[row.baseLang] || (acc[row.baseLang]=[])).push(row);
      return acc;
    }, {});
    const langs = Object.keys(byLang).sort(); // как в эталоне
    const savedLang = (A.settings && A.settings.favoritesLang) || null;
    let activeLang = (savedLang && langs.includes(savedLang)) ? savedLang : (langs[0] || 'xx');

    host.innerHTML = `
      <section class="panel panel--favorites">
        <header class="panel__header">
          <h2 class="panel__title">${t.title}</h2>
          <div id="favorites-flags" class="dicts-flags"></div>
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

    const tbody = host.querySelector('#favorites-table tbody');
    const okBtn = host.querySelector('#favorites-apply');
    const flagsBox = host.querySelector('#favorites-flags');

    let selectedKey = (A.settings && A.settings.lastFavoritesKey) || '';

    function renderFlags(){
      flagsBox.innerHTML = '';
      langs.forEach(lang=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dict-flag' + (lang===activeLang ? ' active' : '');
        btn.dataset.lang = lang;
        btn.title = lang.toUpperCase();
        const first = (byLang[lang] && byLang[lang][0]) || null;
        btn.textContent = first ? flagForKey(first.baseDeckKey) : lang.toUpperCase();
        btn.addEventListener('click', ()=>{
          if (lang===activeLang) return;
          activeLang = lang;
          try{ A.settings.favoritesLang = lang; }catch(_){}
          renderList();
          restoreSelection();
          updateOk();
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
        const disabled = (count < 4);
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
      tbody.innerHTML = html || `<tr><td colspan="4" style="opacity:.6">${t.empty}</td></tr>`;

      // selection
      tbody.querySelectorAll('tr.dict-row').forEach(tr=>{
        tr.addEventListener('click', (e)=>{
          if (tr.classList.contains('is-disabled')) return;
          if (e.target.closest('.favorites-preview') || e.target.closest('.favorites-delete')) return;
          tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
          tr.classList.add('is-selected');
          selectedKey = tr.getAttribute('data-key');
          try{ A.settings.lastFavoritesKey = selectedKey; }catch(_){}
          updateOk();
        });
      });
      // preview
      tbody.querySelectorAll('.favorites-preview').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const tr = btn.closest('tr');
          if (!tr) return;
          openPreview(tr.getAttribute('data-key'));
        });
      });
      // delete
      tbody.querySelectorAll('.favorites-delete').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const tr = btn.closest('tr');
          if (!tr) return;
          const favKey = tr.getAttribute('data-key');
          const parsed = parseFavKey(favKey);
          if (parsed && A.Favorites && typeof A.Favorites.clearForDeck === 'function'){
            try{ A.Favorites.clearForDeck(parsed.baseDeckKey); }catch(_){}
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
      const esc = (window.CSS && CSS.escape) ? CSS.escape(selectedKey) : selectedKey.replace(/"/g, '\\"');
      const row = tbody.querySelector(`tr.dict-row[data-key="${esc}"]`);
      if (!row || row.classList.contains('is-disabled')){
        selectedKey = '';
        tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
        return;
      }
      tbody.querySelectorAll('tr.dict-row').forEach(x=>x.classList.remove('is-selected'));
      row.classList.add('is-selected');
    }

    function updateOk(){
      if (!okBtn){ return; }
      if (!selectedKey){ okBtn.disabled = true; return; }
      const row = tbody.querySelector('tr.dict-row.is-selected') || tbody.querySelector(`tr.dict-row[data-key="${selectedKey}"]`);
      const count = row ? Number(row.getAttribute('data-count')||'0') : 0;
      okBtn.disabled = !(count >= 4);
    }

    function openPreview(favKey){
      const tt = T();
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
            <h3>${tt.preview}</h3>
            <button class="mmodal__close" aria-label="${tt.close}">✕</button>
          </div>
          <div class="mmodal__body">
            <table class="dict-table">
              <thead>
                <tr><th>#</th><th>${ui==='uk'?'Слово':'Слово'}</th><th>${ui==='uk'?'Переклад':'Перевод'}</th></tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${tt.empty}</td></tr>`}</tbody>
            </table>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=>wrap.remove();
      wrap.querySelector('.mmodal__overlay').onclick = close;
      wrap.querySelector('.mmodal__close').onclick = close;
    }

    // OK
    if (okBtn){
      okBtn.addEventListener('click', ()=>{
        if (!selectedKey) return;
        const row = tbody.querySelector('tr.dict-row.is-selected') || tbody.querySelector(`tr.dict-row[data-key="${selectedKey}"]`);
        const count = row ? Number(row.getAttribute('data-count')||'0') : 0;
        if (count < 4) return;
        try{ A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(selectedKey); }catch(_){}
        try{ A.Router && A.Router.routeTo && A.Router.routeTo('home'); }catch(_){}
      });
    }

    // header flags + table
    renderFlags();
    renderList();
    restoreSelection();
    updateOk();
  }

  /* ---------------------- export ---------------------- */
  A.ViewFavorites = { mount };

  /* ---------------------- Router patch (как в home.js) ---------------------- */
  function patchRouter(){
    const R = A.Router;
    if (!R || R.__favPatched) return;
    const old = typeof R.routeTo === 'function' ? R.routeTo.bind(R) : null;

    R.routeTo = function(action){
      if (action === 'fav' || action === 'favorites'){
        this.current = 'fav';
        setFooterActive('fav');
        const app = document.getElementById('app') || document.body;
        mount(app);
        return;
      }
      if (old) return old(action);
    };
    R.__favPatched = true;
  }

  if (document.readyState !== 'loading'){
    patchRouter();
  } else {
    document.addEventListener('DOMContentLoaded', patchRouter);
  }

})();