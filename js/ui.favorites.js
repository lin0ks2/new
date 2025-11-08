/* ==========================================================
 * ui.favorites.js — Экран «Избранное» (как «Мои ошибки»)
 *  - Навигация и разметка 1-в-1 со «Моими ошибками»
 *  - ОК: <4 — предпросмотр; ≥4 — в тренер (home)
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /* --------------------------- i18n --------------------------- */
  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
  }
  function getTrainLang(){
    try{
      const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
      return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }
  function T(){
    const uk = getUiLang()==='uk';
    return uk
      ? { title:'Вибране', empty:'Наразі вибраних слів немає', ok:'Ок', preview:'Попередній перегляд', count:'К-сть' }
      : { title:'Избранное', empty:'В данный момент избранных слов нет', ok:'Ок', preview:'Предпросмотр', count:'Кол-во' };
  }

  /* --------------------------- Навигация --------------------------- */
  function setRouteFavorites(){
    // точь-в-точь как у «Ошибок»: пробуем официальный роутер/утилиту, потом fallback
    try {
      if (A.Router && typeof A.Router.go === 'function') { A.Router.go('favorites'); return; }
    } catch(_) {}
    try {
      if (A.UI && typeof A.UI.setRoute === 'function') { A.UI.setRoute('favorites'); return; }
    } catch(_) {}
    try {
      document.body.setAttribute('data-route', 'favorites');
      window.dispatchEvent(new Event('lexitron:route-changed'));
    } catch(_) {}
  }
  function highlightFooterFav(){
    try{
      document.querySelectorAll('.app-footer .nav-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('.app-footer .nav-btn[data-action="fav"]');
      if (btn) btn.classList.add('active');
    }catch(_){}
  }

  /* --------------------------- Утилиты --------------------------- */
  const FLAG = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', ru:'🇷🇺', uk:'🇺🇦', pl:'🇵🇱', sr:'🇷🇸' };
  const FAVORITES_KEY_RE = /^favorites:(ru|uk):([a-z]{2}_[a-z]+)$/i;
  function buildFavoritesKey(trainLang, baseDeckKey){ return `favorites:${trainLang}:${baseDeckKey}`; }

  function gatherFavDecks(){
    const tLang = getTrainLang();
    const keys = (A.Decks && A.Decks.builtinKeys && A.Decks.builtinKeys()) || [];
    const rows = [];

    for (const base of keys){
      const full = (A.Decks && A.Decks.resolveDeckByKey ? (A.Decks.resolveDeckByKey(base) || []) : []);
      let count = 0;
      try{
        const has = A.Favorites && typeof A.Favorites.has==='function' ? A.Favorites.has.bind(A.Favorites) : null;
        if (!has) continue;
        for (const w of full){ if (has(base, w.id)) count++; }
      }catch(_){}

      if (count > 0){
        const fKey = buildFavoritesKey(tLang, base);
        const name = (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(fKey) : base;
        const baseLang = (A.Decks && (A.Decks.langOfFavoritesKey||A.Decks.langOfKey))
          ? ((A.Decks.langOfFavoritesKey ? A.Decks.langOfFavoritesKey(fKey) : A.Decks.langOfKey(fKey)) || '')
          : '';
        const flag = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(fKey) || '🧩') : '🧩';
        rows.push({ key:fKey, baseKey:base, trainLang:tLang, name, count, baseLang, flag });
      }
    }
    return rows;
  }

  /* ------------------------ Предпросмотр ------------------------ */
  function openPreview(fKey){
    const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(fKey) || []) : [];
    const t = T();
    const rows = deck.slice(0, 500).map((w, i)=>`
      <tr>
        <td class="t-right" style="width:50px; opacity:.7">${i+1}</td>
        <td>${w.word||w.w||''}</td>
        <td>${w.translation||w.t||''}</td>
      </tr>
    `).join('');

    const flag = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(fKey) || '🧩') : '🧩';
    const name = (A.Decks && A.Decks.resolveNameByKey) ? (A.Decks.resolveNameByKey(fKey) || '') : String(fKey||'');

    const wrap = document.createElement('div');
    wrap.className = 'mmodal is-open';
    wrap.innerHTML = `
      <div class="mmodal__overlay"></div>
      <div class="mmodal__panel" role="dialog" aria-modal="true">
        <div class="mmodal__header">
          <h3>${flag} ${name}</h3>
          <button class="mmodal__close" aria-label="×">✕</button>
        </div>
        <div class="mmodal__body">
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

  /* --------------------------- Рендер --------------------------- */
  function mount(){
    const app = document.getElementById('app'); if (!app) return;
    const t = T();

    // выставляем маршрут и активную кнопку — как у «Ошибок»
    setRouteFavorites();
    highlightFooterFav();

    const all = gatherFavDecks();

    // ПУСТОЕ СОСТОЯНИЕ — тот же скелет, что в «Моих ошибках»
    if (!all.length){
      app.innerHTML = `
        <div class="home">
          <section class="card dicts-card">
            <div class="dicts-header">
              <h3>${t.title}</h3>
              <div class="dicts-flags"></div>
            </div>
            <div class="dicts-empty">
              <p class="muted">${t.empty}</p>
            </div>
          </section>
        </div>`;
      return;
    }

    // Группируем по языку базового словаря
    const byLang = all.reduce((acc, row)=>{
      const k = row.baseLang || 'xx';
      (acc[k] = acc[k] || []).push(row);
      return acc;
    }, {});

    const ACTIVE_KEY = 'fav.ui.activeLang';
    const savedActive = (typeof localStorage!=='undefined' && localStorage.getItem(ACTIVE_KEY)) || '';
    let activeLang = savedActive && byLang[savedActive] ? savedActive : Object.keys(byLang)[0];

    function saveActive(v){ try{ localStorage.setItem(ACTIVE_KEY, v); }catch(_){} }
    function saveSelected(v){ try{ localStorage.setItem('fav.ui.selectedKey', v); }catch(_){ } }

    let selectedKey = (typeof localStorage!=='undefined' && localStorage.getItem('fav.ui.selectedKey'))
      || (byLang[activeLang] && byLang[activeLang][0]?.key)
      || '';

    // Корпус — те же классы, что у «Моих ошибок»
    app.innerHTML = `
      <div class="home">
        <section class="card dicts-card">
          <div class="dicts-header">
            <h3>${t.title}</h3>
            <div id="favorites-flags" class="dicts-flags"></div>
          </div>

          <table class="dicts-table">
            <tbody><!-- rows here --></tbody>
          </table>

          <div class="dicts-actions">
            <button type="button" class="btn-primary" id="favorites-apply">${t.ok}</button>
          </div>
        </section>
      </div>
    `;

    // Флаги (табы)
    function renderFlags(){
      const box = app.querySelector('#favorites-flags');
      if (!box) return;
      box.innerHTML = '';
      Object.keys(byLang).forEach(lang=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dict-flag' + (lang===activeLang ? ' active' : '');
        btn.dataset.lang = lang;
        btn.title = String(lang).toUpperCase();
        btn.textContent = FLAG[lang] || lang.toUpperCase();
        btn.onclick = ()=>{
          if (lang===activeLang) return;
          activeLang = lang; saveActive(lang);
          selectedKey = (byLang[activeLang] && byLang[activeLang][0]?.key) || '';
          renderTable();
        };
        box.appendChild(btn);
      });
    }

    // Таблица и делегирование
    function renderTable(){
      const data = byLang[activeLang] || [];
      const tbody = app.querySelector('.dicts-table tbody');
      if (!tbody) return;

      const rows = data.map(r=>{
        const sel = (r.key === selectedKey) ? ' is-selected' : '';
        return `
          <tr class="dict-row${sel}" data-key="${r.key}" data-count="${r.count|0}">
            <td class="t-center" style="width:64px">${r.flag}</td>
            <td>${r.name}</td>
            <td class="t-center" style="width:100px">${r.count|0}</td>
            <td class="t-center" style="width:100px">
              <span class="fav-preview" title="${t.preview}" role="button" aria-label="${t.preview}">👁️</span>
              <span class="fav-delete"  title="Delete" role="button" aria-label="Delete" style="margin-left:10px;">🗑️</span>
            </td>
          </tr>`;
      }).join('');

      tbody.innerHTML = rows;

      tbody.onclick = (e)=>{
        const eye = e.target.closest('.fav-preview');
        if (eye){
          const tr = eye.closest('tr'); if (!tr) return;
          openPreview(tr.dataset.key);
          return;
        }
        const del = e.target.closest('.fav-delete');
        if (del){
          const tr = del.closest('tr'); if (!tr) return;
          const m = (tr.dataset.key||'').match(FAVORITES_KEY_RE);
          const base = m && m[2];
          if (base){
            const deck = (A.Decks && A.Decks.resolveDeckByKey ? (A.Decks.resolveDeckByKey(base) || []) : []);
            const has = A.Favorites && typeof A.Favorites.has==='function' ? A.Favorites.has.bind(A.Favorites) : null;
            const tog = A.Favorites && typeof A.Favorites.toggle==='function' ? A.Favorites.toggle.bind(A.Favorites) : null;
            if (has && tog){
              for (const w of deck){ if (has(base, w.id)) tog(base, w.id); }
            }
            mount(); // пересчёт и перерисовка
          }
          return;
        }
        // выбор строки
        const row = e.target.closest('.dict-row'); if (!row) return;
        selectedKey = row.dataset.key || selectedKey;
        app.querySelectorAll('.dict-row').forEach(r=> r.classList.remove('is-selected'));
        row.classList.add('is-selected');
      };
    }

    renderFlags();
    renderTable();

    // Кнопка «ОК»: <4 — предпросмотр; ≥4 — в тренер и на home
    const ok = document.getElementById('favorites-apply');
    if (ok){
      ok.onclick = ()=>{
        const row = app.querySelector('.dict-row.is-selected');
        if (!row) return;
        const key = row.getAttribute('data-key');
        const count = row.getAttribute('data-count')|0;
        if (count < 4) { openPreview(key); return; }
        try{ localStorage.setItem('fav.ui.selectedKey', key); }catch(_){}
        try{ A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(key); }catch(_){}
        try{
          if (A.Router && typeof A.Router.go==='function'){ A.Router.go('home'); }
          else { document.body.setAttribute('data-route', 'home'); window.dispatchEvent(new Event('lexitron:route-changed')); }
        }catch(_){}
      };
    }
  }

  /* --------------------------- Экспорт/хук --------------------------- */
  A.ViewFavorites = { mount };

  // Привязка к кнопке футера
  document.addEventListener('click', (e)=>{
    const el = e.target && e.target.closest && e.target.closest('[data-action="fav"]');
    if (!el) return;
    try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
    try{ A.ViewFavorites && A.ViewFavorites.mount && A.ViewFavorites.mount(); }catch(_){}
  }, { capture:true });

})();
