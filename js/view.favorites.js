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
      app.innerHTML = `<div class="home"><section class="card"><h3>${T.title}</h3><p style="opacity:.7;margin:0;">${T.empty}</p></section></div>`;
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
    if (tbody){
      tbody.addEventListener('click', (e)=>{
        const eye = e.target.closest('.dicts-preview');
        if (eye){
          e.stopPropagation();
          const tr = eye.closest('tr'); if (!tr) return;
          openPreview(tr.dataset.key);
          return;
        }
        const del = e.target.closest('.dicts-delete');
        if (del){
          e.stopPropagation();
          const tr = del.closest('tr'); if (!tr) return;
          const baseKey = tr.dataset.base;
          const TL = currentTrainLang();
          try{
            if (A.Favorites && typeof A.Favorites.clearForDeck==='function'){
              A.Favorites.clearForDeck(TL, baseKey);
            } else if (A.Favorites && typeof A.Favorites.clearActive==='function'){
              A.Favorites.clearActive();
            }
          }catch(_){}
          render();
          return;
        }

        // выбор строки
        const tr = e.target.closest('tr');
        if (tr){
          tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('is-selected'));
          tr.classList.add('is-selected');
          const cnt = parseInt(tr.children[2].textContent||'0',10) || 0;
          const ok = app.querySelector('#fav-apply');
          if (ok) ok.disabled = (cnt < 4);
        }
      });
    }

    // === кнопка ОК: как в "Моих ошибках" ===
    const btnApply = app.querySelector('#fav-apply');
    if (btnApply){
      btnApply.onclick = ()=>{
        const sel = app.querySelector('.dicts-table tbody tr.is-selected');
        if (!sel) return;
        const key = sel.dataset.key;
        const cnt = parseInt(sel.children[2]?.textContent || '0', 10) || 0;

        // если <4 слов — только предпросмотр
        if (cnt < 4){
          openPreview(key);
          return;
        }

        // сохраняем и запускаем тренировку
        try {
          A.settings = A.settings || {};
          A.settings.lastFavoritesKey = key;
          if (typeof A.saveSettings === 'function') A.saveSettings(A.settings);
        } catch(_) {}

        try { A.Trainer && A.Trainer.setDeckKey && A.Trainer.setDeckKey(key); } catch(_){}
        try { A.Router  && A.Router.routeTo    && A.Router.routeTo('home'); }   catch(_){}
      };
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
