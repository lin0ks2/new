/* ==========================================================
 * view.favorites.js — Экран «Избранное» в стиле «Мои ошибки»
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /* ---------------- i18n ---------------- */
  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
  }
  function t(){
    const uk = getUiLang()==='uk';
    return {
      title   : uk ? 'Обране' : 'Избранное',
      ok      : 'OK',
      preview : uk ? 'Перегляд' : 'Предпросмотр',
      empty   : uk ? 'Поки що нічого немає.' : 'Пока ничего нет.',
      cnt     : uk ? 'К-сть' : 'Кол-во',
      act     : uk ? 'Дії' : 'Действия'
    };
  }

  /* ---------------- helpers ---------------- */
  const FLAG = { de:'🇩🇪', en:'🇬🇧', es:'🇪🇸', fr:'🇫🇷', sr:'🇷🇸' };

  function currentTrainLang(){
    try{
      const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
      return (String(s).toLowerCase()==='uk') ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }

  // Собираем «виртуальные» деки избранного по всем базовым словарям
  function gatherFavoriteDecks(){
    const TL = currentTrainLang();
    const out = [];
    try{
      const decks = (window.decks && typeof window.decks==='object') ? window.decks : {};
      const baseKeys = Object.keys(decks)
        .filter(k => Array.isArray(decks[k]) && !/^favorites:|^mistakes:/i.test(k));

      for (const baseKey of baseKeys){
        const favKey = `favorites:${TL}:${baseKey}`;
        const name = (A.Decks && A.Decks.resolveNameByKey) ? A.Decks.resolveNameByKey(favKey) : favKey;
        const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(favKey) || []) : [];
        if (!deck.length) continue;

        const baseLang = (A.Decks && (A.Decks.langOfFavoritesKey||A.Decks.langOfKey))
          ? (A.Decks.langOfFavoritesKey ? A.Decks.langOfFavoritesKey(favKey) : A.Decks.langOfKey(favKey))
          : '';
        const flag = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(favKey) || '🧩') : '🧩';
        out.push({ key:favKey, baseKey, trainLang:TL, name, count:deck.length, baseLang, flag });
      }
    }catch(_){}
    return out;
  }

  function render(){
    const app = document.getElementById('app');
    if (!app) return;
    const T = t();

    const all = gatherFavoriteDecks();
    if (!all.length){
      app.innerHTML = `<div class="home"><section class="card"><h3 style="margin:0 0 6px;">${T.title}</h3><p style="opacity:.7;margin:0;">${T.empty}</p></section></div>`;
      return;
    }

    // группировка по языку базового словаря
    const byLang = all.reduce((acc,row)=>{
      const lg = row.baseLang || 'xx';
      (acc[lg]||(acc[lg]=[])).push(row);
      return acc;
    }, {});
    const langs = Object.keys(byLang);

    // фильтр флажками
    let activeLang = (A.settings && A.settings.dictsLangFilter) || null;
    if (activeLang && !byLang[activeLang]) activeLang = null;

    function saveFilter(){
      try{
        A.settings = A.settings || {};
        A.settings.dictsLangFilter = activeLang;
        if (typeof A.saveSettings==='function') A.saveSettings(A.settings);
      }catch(_){}
    }

    function renderFlags(){
      const box = app.querySelector('#fav-flags');
      if (!box) return;
      box.innerHTML = '';
      langs.forEach(lang=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dict-flag' + (lang===activeLang ? ' active' : '');
        btn.dataset.lang = lang;
        btn.title = String(lang).toUpperCase();
        btn.textContent = FLAG[lang] || lang.toUpperCase();
        btn.onclick = ()=>{
          activeLang = (activeLang===lang) ? null : lang;
          saveFilter(); render();
        };
        box.appendChild(btn);
      });
    }

    const rows = (activeLang ? byLang[activeLang] : all).map(r=>`
      <tr data-key="${r.key}" data-base="${r.baseKey}">
        <td class="t-center">${r.flag}</td>
        <td>${r.name}</td>
        <td class="t-center">${r.count|0}</td>
        <td class="t-center">
          <span class="dicts-preview" title="${T.preview}" role="button">👁️</span>
          <span class="dicts-delete" title="Delete" role="button" style="margin-left:10px;">🗑️</span>
        </td>
      </tr>`).join('');

    app.innerHTML = `
      <div class="home">
        <section class="card dicts-card">
          <div class="dicts-header">
            <h3>${T.title}</h3>
            <div id="fav-flags" class="dicts-flags"></div>
          </div>
          <table class="dicts-table"><tbody>${rows}</tbody></table>
          <div class="dicts-actions">
            <button type="button" class="btn-primary" id="fav-apply" disabled>${T.ok}</button>
          </div>
        </section>
      </div>`;

    renderFlags();

    const tbody = app.querySelector('.dicts-table tbody');

    // ---- делегаты таблицы
    if (tbody){
      tbody.addEventListener('click', (e)=>{
        // 👁️ предпросмотр
        const eye = e.target.closest('.dicts-preview');
        if (eye){
          e.stopPropagation();
          const tr = eye.closest('tr'); if (!tr) return;
          openPreview(tr.dataset.key);
          return;
        }

        // 🗑️ удаление набора избранного ТОЛЬКО для этой базы
        const del = e.target.closest('.dicts-delete');
        if (del){
          e.stopPropagation();
          const tr = del.closest('tr'); if (!tr) return;
          const baseKey = tr.dataset.base;       // напр. "de_verbs"
          const favKey  = tr.dataset.key;        // "favorites:<TL>:<baseKey>"
          const TL      = currentTrainLang();

          // 1) Получаем id избранных слов в этой базе
          let ids = [];
          try {
            if (A.Favorites && typeof A.Favorites.getIds === 'function'){
              ids = A.Favorites.getIds(TL, baseKey) || [];
            }
          } catch(_){}

          // 2) Снимаем «избранное» для каждого слова этой базы
          try {
            if (A.Favorites && typeof A.Favorites.toggle === 'function'){
              for (const id of ids){
                // проверка нужна, чтобы не лишний раз дёргать toggle
                if (A.Favorites.has && A.Favorites.has(baseKey, id)){
                  A.Favorites.toggle(baseKey, id);
                }
              }
            } else if (typeof App.toggleFavorite === 'function'){
              for (const id of ids){
                App.toggleFavorite(baseKey, id);
              }
            }
          } catch(_){}

          // 3) Сбросим сохранённый выбор, если удалили текущий
          try {
            if ((A.settings && A.settings.lastFavoritesKey) === favKey){
              A.settings.lastFavoritesKey = null;
              if (typeof A.saveSettings === 'function') A.saveSettings(A.settings);
            }
          } catch(_){}

          // 4) Перерисуем экран (автоселект сам восстановится)
          render();
          return;
        }

        // выбор строки
        const tr = e.target.closest('tr');
        if (tr){
          selectRow(tr);
        }
      });
    }

    // ---- автоселект как в "Моих ошибках"
    autoSelectInitialRow();

    // === кнопка ОК: как в "Моих ошибках" ===
    const btnApply = app.querySelector('#fav-apply');
    if (btnApply){
      btnApply.onclick = ()=>{
        // если почему-то нет выделенной — берём первую
        let sel = app.querySelector('.dicts-table tbody tr.is-selected');
        if (!sel) sel = app.querySelector('.dicts-table tbody tr');
        if (!sel) return;

        const key = sel.dataset.key;
        const cnt = parseInt(sel.children[2]?.textContent || '0', 10) || 0;

        // <4 — только предпросмотр
        if (cnt < 4){
          openPreview(key);
          return;
        }

        // запомним и универсально запустим тренировку
        try {
          A.settings = A.settings || {};
          A.settings.lastFavoritesKey = key;
          if (typeof A.saveSettings === 'function') A.saveSettings(A.settings);
        } catch(_){}

        launchTraining(key);
      };
    }

    // ---------- helpers (внутри render) ----------
    function setOkEnabled(enabled){
      const ok = app.querySelector('#fav-apply');
      if (ok) ok.disabled = !enabled;
    }

    function selectRow(tr){
      const cnt = parseInt(tr.children[2]?.textContent || '0', 10) || 0;
      tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('is-selected'));
      tr.classList.add('is-selected');
      // кнопка активна только если >=4 (как в "Ошибках")
      setOkEnabled(cnt >= 4);
    }

    function autoSelectInitialRow(){
      // 1) если есть сохранённый ключ и он присутствует в таблице — выбираем его
      let key = null;
      try { key = A.settings && A.settings.lastFavoritesKey; } catch(_){}
      let tr = key ? tbody.querySelector(`tr[data-key="${CSS.escape(key)}"]`) : null;

      // 2) иначе — первая строка
      if (!tr) tr = tbody.querySelector('tr');
      if (!tr) return;

      selectRow(tr);
    }

    function launchTraining(key){
      // 1) как в других вью: общий стартер, если есть
      if (A.UI && typeof A.UI.startTrainingWithKey === 'function'){
        A.UI.startTrainingWithKey(key);
        return;
      }
      if (A.Home && typeof A.Home.startTrainingWithKey === 'function'){
        A.Home.startTrainingWithKey(key);
        return;
      }
      // 2) фоллбэк: проставить ключ тренеру и уйти на home
      if (A.Trainer && typeof A.Trainer.setDeckKey === 'function'){
        A.Trainer.setDeckKey(key);
      }
      if (A.Router && typeof A.Router.routeTo === 'function'){
        A.Router.routeTo('home');
      } else if (A.UI && typeof A.UI.goHome === 'function'){
        A.UI.goHome();
      } else {
        location.hash = '';
      }
    }
  }

  /* -------- модальное превью -------- */
  function openPreview(favKey){
    const T = t();
    const deck = (A.Decks && A.Decks.resolveDeckByKey)
      ? (A.Decks.resolveDeckByKey(favKey) || [])
      : [];
    const ui = getUiLang();
    const rows = deck.slice(0,150).map((w,i)=>{
      const tr = (ui==='uk') ? (w.uk || w.ru || '') : (w.ru || w.uk || '');
      return `<tr><td class="t-center">${i+1}</td><td>${w.word||''}</td><td>${tr}</td></tr>`;
    }).join('');

    const wrap = document.createElement('div');
    wrap.className = 'mmodal is-open';
    wrap.innerHTML = `
      <div class="mmodal__overlay" role="button" aria-label="Close"></div>
      <div class="mmodal__panel" role="dialog" aria-modal="true" aria-labelledby="mmodalTitle">
        <div class="mmodal__header">
          <h3 id="mmodalTitle" class="mmodal__title">👁️ ${T.title}</h3>
          <button class="mmodal__close" aria-label="Close">×</button>
        </div>
        <div class="mmodal__body">
          <table class="dict-table">
            <thead><tr><th>#</th><th>Word</th><th>Translation</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${T.empty}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = ()=>wrap.remove();
    wrap.querySelector('.mmodal__overlay').onclick = close;
    wrap.querySelector('.mmodal__close').onclick = close;
  }

  // Публичный mount
  A.ViewFavorites = { mount: render };
})();
