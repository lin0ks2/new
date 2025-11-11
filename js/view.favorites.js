/* ==========================================================
 * view.favorites.js — Экран "Избранное" (1 в 1 как dicts)
 *  - Та же разметка, классы и поведение, что и в view.dicts.js
 *  - Отличия только в источнике данных (Favorites) и ключах
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /* ---------------------- helpers ---------------------- */
  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase() === 'uk') ? 'uk' : 'ru';
  }

  function t(){
    const uk = getUiLang() === 'uk';
    return {
      title:   uk ? 'Вибране' : 'Избранное',
      subtitle: uk ? 'Оберіть набір з вибраних слів' : 'Выберите набор из избранных слов',
      preview: uk ? 'Попередній перегляд' : 'Предпросмотр',
      empty:   uk ? 'Наборів не знайдено' : 'Наборы не найдены',
      word:    uk ? 'Слово' : 'Слово',
      trans:   uk ? 'Переклад' : 'Перевод',
      close:   uk ? 'Закрити' : 'Закрыть',
      ok:      'Ок'
    };
  }

  // подсветка активной кнопки в футере
  function setFooterActive(name){
    try{
      const footer = document.querySelector('footer.app-footer');
      if (!footer) return;
      footer.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const btn = footer.querySelector(`.nav-btn[data-action="${name}"]`);
      if (btn) btn.classList.add('active');
    }catch(_){}
  }

  /* ---------------------- data: favorites buckets ---------------------- */
  // Ключ избранного: favorites:<uiLang>:<baseDeckKey>
  function makeFavKey(baseDeckKey){
    const ui = getUiLang();
    return `favorites:${ui}:${baseDeckKey}`;
  }
  function parseFavKey(key){
    const m = String(key||'').match(/^favorites:(ru|uk):(.+)$/i);
    return m ? { uiLang: m[1].toLowerCase(), baseDeckKey: m[2] } : null;
  }
  function langOfKey(deckKey){
    try{ return A.Decks.langOfKey(deckKey); }catch(_){ return 'xx'; }
  }
  function flagForKey(deckKey){
    try{ return A.Decks.flagForKey(deckKey); }catch(_){ return '🏳️'; }
  }
  function resolveNameByKey(deckKey){
    try{ return A.Decks.resolveNameByKey(deckKey); }catch(_){ return String(deckKey||'').split(':').pop(); }
  }

  // Список бакетов избранного по базовым словарям
  function listFavoriteBuckets(){
    const ui = getUiLang();
    // 1) Нативный список из A.Favorites.list()
    if (A.Favorites && typeof A.Favorites.list === 'function'){
      try{
        const arr = A.Favorites.list() || [];
        return arr.map(row => {
          const baseDeckKey = row.baseDeckKey || row.key || row.deckKey || row.baseKey;
          const count = Number(row.count || row.size || 0);
          return { baseDeckKey, favoritesKey: `favorites:${ui}:${baseDeckKey}`, count };
        }).filter(x => x.count > 0);
      }catch(_){}
    }
    // 2) Фолбэк: пробегаемся по всем словарям и считаем has()
    let keys = [];
    try{ keys = (A.Decks?.builtinKeys?.() || []); }catch(_){ keys = []; }
    const out = [];
    for (const baseDeckKey of keys){
      let count = 0;
      try{
        const deck = (A.Decks?.resolveDeckByKey?.(baseDeckKey) || []);
        for (const w of deck){
          try{ if (A.Favorites?.has?.(baseDeckKey, w.id)) count++; }catch(_){}
        }
      }catch(_){}
      if (count>0) out.push({ baseDeckKey, favoritesKey: `favorites:${ui}:${baseDeckKey}`, count });
    }
    return out;
  }

  // Получить МАССИВ слов только из избранного для данного favKey
  function resolveFavoritesDeckByKey(favKey){
    try{
      if (A.Favorites && typeof A.Favorites.resolveDeckForFavoritesKey === 'function'){
        const r = A.Favorites.resolveDeckForFavoritesKey(favKey);
        if (Array.isArray(r)) return r;
      }
    }catch(_){}
    const parsed = parseFavKey(favKey);
    if (!parsed) return [];
    let full = [];
    try{ full = (A.Decks?.resolveDeckByKey?.(parsed.baseDeckKey) || []); }catch(_){ full = []; }
    return full.filter(w => {
      try{ return !!A.Favorites?.has?.(parsed.baseDeckKey, w.id); }catch(_){ return false; }
    });
  }

  /* ---------------------- render (как в dicts) ---------------------- */
  function renderFavoritesList(){
    const app = document.getElementById('app');
    if (!app) return;
    const T = t();

    const buckets = listFavoriteBuckets();
    if (!buckets.length){
      app.innerHTML = `<div class="home"><section class="card"><h3>${T.title}</h3><p>${T.empty}</p></section></div>`;
      // выставим активную кнопку сразу
      setFooterActive('fav');
      return;
    }

    // Группируем по языку базового словаря
    const byLang = buckets.reduce((acc, row)=>{
      const lang = langOfKey(row.baseDeckKey);
      (acc[lang] || (acc[lang]=[])).push(row);
      return acc;
    }, {});
    const langs = Object.keys(byLang).sort(); // как в dicts — алфавитно

    // Активный язык для фильтра (как в dicts, но отдельный ключ settings)
    function loadActiveLang(){
      try {
        const s = (A.settings && A.settings.favoritesLang);
        if (s && byLang[s] && byLang[s].length) return s;
      } catch(_){}
      return langs[0];
    }
    function saveActiveLang(lang){
      try { if (A.settings) A.settings.favoritesLang = lang; } catch(_){}
    }
    let activeLang = loadActiveLang();

    // Выбранная строка (кандидат)
    function loadSelectedKey(){
      const saved = (A.settings && A.settings.lastFavoritesKey) || '';
      if (saved && byLang[activeLang]?.some(x=>x.favoritesKey===saved)) return saved;
      const first = byLang[activeLang] && byLang[activeLang][0];
      return first ? first.favoritesKey : '';
    }
    let selectedKey = loadSelectedKey();

    // Надёжный переход «домой» — 1 в 1 с dicts
    function goHome(){
      setFooterActive('home');
      try {
        if (window.Router && typeof Router.routeTo === 'function') { Router.routeTo('home'); return; }
        if (A.Router && typeof A.Router.routeTo === 'function')      { A.Router.routeTo('home'); return; }
      } catch(_){}
      const homeBtn = document.querySelector('footer .nav-btn[data-action="home"]');
      if (homeBtn) { homeBtn.click(); return; }
      document.body.setAttribute('data-route','home');
      try { document.dispatchEvent(new Event('route:changed')); } catch(_){}
      try { window.dispatchEvent(new Event('route:changed')); } catch(_){}
    }

    // Составляем список для активного языка
    function rowsOf(lang){
      const arr = (byLang[lang]||[]).slice().sort((a,b)=>{
        return resolveNameByKey(a.baseDeckKey).localeCompare(resolveNameByKey(b.baseDeckKey));
      });
      return arr.map(row=>{
        const key   = row.favoritesKey;
        const name  = resolveNameByKey(row.baseDeckKey);
        const flag  = flagForKey(row.baseDeckKey);
        const count = Number(row.count||0);
        return { key, name, flag, count };
      });
    }
    let rows = rowsOf(activeLang);

    // HTML (1 в 1 как dicts — те же классы/структура)
    const tbody = rows.map(({key,name,flag,count})=>{
      const selected = (key === selectedKey) ? ' is-selected' : '';
      const disabled = (count < 4) ? ' data-disabled="1"' : '';
      return `<tr class="dicts-row${selected}" data-key="${key}"${disabled}>
            <td class="t-center">${flag}</td>
            <td>${name}</td>
            <td class="t-center">${count}</td>
            <td class="t-center">
              <span class="dicts-preview" title="${T.preview}" data-key="${key}" role="button" aria-label="${T.preview}">👁‍🗨</span>
            </td>
          </tr>`;
    }).join('');

    app.innerHTML = `
      <div class="home">
        <section class="card dicts-card">
          <div class="dicts-header">
            <h3>${T.title}</h3>
            <div id="dicts-flags" class="dicts-flags"></div>
          </div>

          <table class="dicts-table">
            <thead>
              <tr>
                <th class="t-center" style="width:56px">🌐</th>
                <th>Название</th>
                <th class="t-center" style="width:84px">#</th>
                <th class="t-center" style="width:96px">${T.preview}</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>

          <div class="dicts-actions">
            <button type="button" class="btn-primary" id="dicts-apply">${T.ok}</button>
          </div>
        </section>
      </div>`;

    // Рендер флагов (как в dicts)
    const flagsBox = document.getElementById('dicts-flags');
    if (flagsBox){
      flagsBox.innerHTML = langs.map(l=>{
        const is = (l===activeLang) ? ' is-active' : '';
        const sample = byLang[l] && byLang[l][0];
        const flag = sample ? flagForKey(sample.baseDeckKey) : '🌐';
        return `<button type="button" class="flag-btn${is}" data-lang="${l}" aria-pressed="${is?'true':'false'}" title="${l.toUpperCase()}">${flag}</button>`;
      }).join('');
      flagsBox.addEventListener('click', (e)=>{
        const b = e.target.closest('.flag-btn');
        if (!b) return;
        const lang = b.getAttribute('data-lang');
        if (lang === activeLang) return;
        activeLang = lang;
        saveActiveLang(lang);
        selectedKey = ''; // сбрасываем, пересчитаем
        // перерисуем только tbody и флаги активного состояния
        const body = document.querySelector('.dicts-table tbody');
        rows = rowsOf(activeLang);
        body.innerHTML = rows.map(({key,name,flag,count})=>{
          const disabled = (count < 4) ? ' data-disabled="1"' : '';
          return `<tr class="dicts-row" data-key="${key}"${disabled}>
            <td class="t-center">${flag}</td>
            <td>${name}</td>
            <td class="t-center">${count}</td>
            <td class="t-center">
              <span class="dicts-preview" title="${T.preview}" data-key="${key}" role="button" aria-label="${T.preview}">👁‍🗨</span>
            </td>
          </tr>`;
        }).join('');
        flagsBox.querySelectorAll('.flag-btn').forEach(x=>x.classList.remove('is-active'));
        b.classList.add('is-active');
      });
    }

    // Делегирование кликов по tbody (как в dicts)
    const tbodyEl = app.querySelector('.dicts-table tbody');
    if (tbodyEl){
      tbodyEl.addEventListener('click', (e)=>{
        const eye = e.target.closest('.dicts-preview');
        if (eye){
          const key = eye.getAttribute('data-key');
          openPreview(key);
          return;
        }
        const tr = e.target.closest('tr.dicts-row');
        if (!tr) return;
        if (tr.hasAttribute('data-disabled')) return;
        tbodyEl.querySelectorAll('tr.dicts-row').forEach(x=>x.classList.remove('is-selected'));
        tr.classList.add('is-selected');
        selectedKey = tr.getAttribute('data-key') || '';
        try { if (A.settings) A.settings.lastFavoritesKey = selectedKey; } catch(_){}
      });
    }

    // Кнопка ОК (как в dicts)
    const btnApply = document.getElementById('dicts-apply');
    if (btnApply){
      btnApply.addEventListener('click', ()=>{
        if (!selectedKey) return;
        // Строго как в dicts: сохраняем выбранный ключ для тренажёра и идём домой
        try{ A.Trainer?.setDeckKey?.(selectedKey); }catch(_){}
        goHome();
      });
    }

    // активируем кнопку в футере
    setFooterActive('fav');

    /* -------- preview modal (структура как в dicts) -------- */
    function openPreview(favKey){
      const parsed = parseFavKey(favKey);
      const baseKey = parsed ? parsed.baseDeckKey : '';
      const flag  = flagForKey(baseKey);
      const name  = resolveNameByKey(baseKey);
      const lang  = getUiLang();
      const deck  = resolveFavoritesDeckByKey(favKey) || [];

      const rows = deck.map((w,i)=>`
        <tr>
          <td class="t-center" style="opacity:.6">${String(i+1).padStart(2,'0')}</td>
          <td>${w.word || w.term || ''}</td>
          <td>${lang === 'uk' ? (w.uk || w.translation_uk || '') : (w.ru || w.translation_ru || '')}</td>
        </tr>`).join('');

      const wrap = document.createElement('div');
      wrap.className = 'mmodal is-open';
      wrap.innerHTML = `
        <div class="mmodal__overlay"></div>
        <div class="mmodal__panel" role="dialog" aria-modal="true">
          <div class="mmodal__header">
            <h3>${flag} ${name}</h3>
            <button class="mmodal__close" aria-label="${T.close}">✕</button>
          </div>
          <div class="mmodal__body">
            <table class="dicts-table is-compact">
              <thead>
                <tr>
                  <th class="t-center" style="width:56px">#</th>
                  <th>${T.word}</th>
                  <th>${T.trans}</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${T.empty}</td></tr>`}</tbody>
            </table>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = ()=>wrap.remove();
      wrap.querySelector('.mmodal__overlay').onclick = close;
      wrap.querySelector('.mmodal__close').onclick = close;
    }
  }

  /* ---------------------- export ---------------------- */
  A.ViewFavorites = { mount: renderFavoritesList };

})();