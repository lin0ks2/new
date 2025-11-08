/* ==========================================================
 * ui.favorites.js — Экран «Избранное» (по образцу «Мои ошибки»)
 *  - Группы по языку базового словаря, флаги
 *  - Строка с 👁️ предпросмотром и 🗑️ удалением
 *  - ОК: если ≥4 слов → тренировка favorites:<lang>:<baseKey>, иначе — предпросмотр
 *  - Подключение на кнопку футера [data-action="fav"] без правок других файлов
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
  }
  function getTrainLang(){ // как в mistakes — ru/uk
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

  const FLAG = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', ru:'🇷🇺', uk:'🇺🇦', pl:'🇵🇱', sr:'🇷🇸' };

  function buildFavoritesKey(trainLang, baseDeckKey){ return `favorites:${trainLang}:${baseDeckKey}`; }

  // Собрать агрегат «по словарям»: key, name, count, baseLang, flag
  function gatherFavDecks(){
    const tLang = getTrainLang();
    const keys = (A.Decks && A.Decks.builtinKeys && A.Decks.builtinKeys()) || [];
    const rows = [];

    for (const base of keys){
      const full = (A.Decks && A.Decks.resolveDeckByKey ? (A.Decks.resolveDeckByKey(base) || []) : []);
      let count = 0;
      try {
        const has = A.Favorites && typeof A.Favorites.has==='function' ? A.Favorites.has.bind(A.Favorites) : null;
        if (!has) continue;
        for (const w of full){ if (has(base, w.id)) count++; }
      } catch(_) {}

      if (count > 0){
        const fKey = buildFavoritesKey(tLang, base);
        const name = (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(fKey) : base;
        const baseLang = (A.Decks && (A.Decks.langOfFavoritesKey||A.Decks.langOfKey)) ? ((A.Decks.langOfFavoritesKey ? A.Decks.langOfFavoritesKey(fKey) : A.Decks.langOfKey(fKey)) || '') : '';
        const flag = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(fKey) || '🧩') : '🧩';
        rows.push({ key:fKey, baseKey:base, trainLang:tLang, name, count, baseLang, flag });
      }
    }
    return rows;
  }

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

  function mount(){
    const app = document.getElementById('app'); if (!app) return;
    const t = T();

    const all = gatherFavDecks();
    if (!all.length){
      app.innerHTML = `<div class="home"><section class="card"><div class="card__header"><h2>${t.title}</h2></div><div class="card__body"><p style="opacity:.7; margin:0;">${t.empty}</p></div></section></div>`;
      return;
    }

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

    let selectedKey = (typeof localStorage!=='undefined' && localStorage.getItem('fav.ui.selectedKey')) || (byLang[activeLang] && byLang[activeLang][0]?.key) || '';

    function renderLangTabs(){
      const box = document.querySelector('.dicts-lang-tabs');
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

    function renderTable(){
      const box = document.querySelector('.dict-table-wrap');
      const rows = (byLang[activeLang]||[]).map((r, idx)=>`
        <tr class="dict-row${r.key===selectedKey?' is-selected':''}" data-key="${r.key}" data-count="${r.count}">
          <td class="t-right" style="width:50px; opacity:.7">${idx+1}</td>
          <td>${r.flag} ${r.name}</td>
          <td class="t-center" style="width:100px">${r.count|0}</td>
          <td class="t-center" style="width:100px">
            <span class="fav-preview" title="${t.preview}" role="button" aria-label="${t.preview}">👁️</span>
            <span class="fav-delete" title="Delete" role="button" aria-label="Delete" style="margin-left:10px;">🗑️</span>
          </td>
        </tr>
      `).join('');
      box.innerHTML = `
        <table class="dict-table">
          <thead><tr><th>#</th><th>${t.title}</th><th>${t.count}</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      const appRoot = document.getElementById('app');
      appRoot.addEventListener('click', (e)=>{
        const prev = e.target.closest('.fav-preview');
        const del  = e.target.closest('.fav-delete');
        if (prev || del){
          const row = e.target.closest('.dict-row');
          if (!row) return;
          const key = row.getAttribute('data-key');
          if (prev){ openPreview(key); return; }
          if (del){
            // Мягкая очистка через toggle/has
            const p = String(key||'').match(/^favorites:(ru|uk):([a-z]{2}_[a-z]+)$/i);
            const base = p && p[2]; if (!base) return;
            const deck = (A.Decks && A.Decks.resolveDeckByKey ? (A.Decks.resolveDeckByKey(base) || []) : []);
            const has = A.Favorites && typeof A.Favorites.has==='function' ? A.Favorites.has.bind(A.Favorites) : null;
            const tog = A.Favorites && typeof A.Favorites.toggle==='function' ? A.Favorites.toggle.bind(A.Favorites) : null;
            if (has && tog){
              for (const w of deck){ if (has(base, w.id)) tog(base, w.id); }
            }
            mount(); // перерисовать
            return;
          }
        }
        const row = e.target.closest('.dict-row');
        if (!row) return;
        selectedKey = row.dataset.key || selectedKey;
        app.querySelectorAll('.dict-row').forEach(r=> r.classList.remove('is-selected'));
        row.classList.add('is-selected');
      }, { passive:true });
    }

    app.innerHTML = `
      <div class="home">
        <section class="card dicts-card">
          <div class="card__header"><h2>${t.title}</h2></div>
          <div class="card__body">
            <div class="dicts-lang-tabs" style="margin-bottom:10px;"></div>
            <div class="dict-table-wrap"></div>
            <div class="dicts-apply">
              <button id="favorites-apply" class="btn primary">${t.ok}</button>
            </div>
          </div>
        </section>
      </div>
    `;

    renderLangTabs();
    renderTable();

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
        // переход на главную
        try{
          if (A.Router && typeof A.Router.go==='function'){ A.Router.go('home'); }
          else { document.body.setAttribute('data-route', 'home'); window.dispatchEvent(new Event('lexitron:route-changed')); }
        }catch(_){}
      };
    }
  }

  // Экспорт
  A.ViewFavorites = { mount };

  // Подключение к кнопке футера [data-action="fav"] без правки других файлов
  document.addEventListener('click', (e)=>{
    const el = e.target.closest('[data-action="fav"]');
    if (!el) return;
    try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
    try{ A.ViewFavorites && A.ViewFavorites.mount && A.ViewFavorites.mount(); }catch(_){}
  }, { capture:true });
})();
