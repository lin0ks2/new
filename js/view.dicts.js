/* ==========================================================
 * view.dicts.js — Экран "Словари" (выделение строки + ОК → домой)
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
      title:   uk ? 'Словники' : 'Словари',
      preview: uk ? 'Переглянути' : 'Предпросмотр',
      empty:   uk ? 'Словників не знайдено' : 'Словари не найдены',
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

  /* ---------------------- render list ---------------------- */
  function renderDictList(){
    const app = document.getElementById('app');
    if (!app) return;
    const T = t();

    const allKeys = (A.Decks?.builtinKeys?.() || []);
    if (!allKeys.length){
      app.innerHTML = `<div class="home"><section class="card"><h3>${T.title}</h3><p>${T.empty}</p></section></div>`;
      return;
    }

    // Группировка по языку
    const byLang = allKeys.reduce((acc, key)=>{
      const lang = (A.Decks.langOfKey && A.Decks.langOfKey(key)) || '';
      if (!lang) return acc;
      (acc[lang] || (acc[lang] = [])).push(key);
      return acc;
    }, {});
    const langs = Object.keys(byLang);
    if (!langs.length){
      app.innerHTML = `<div class="home"><section class="card"><h3>${T.title}</h3><p>${T.empty}</p></section></div>`;
      return;
    }

    // Активный язык для фильтра
    function loadActiveLang(){
      try {
        const s = (A.settings && A.settings.dictsLang);
        if (s && byLang[s] && byLang[s].length) return s;
      } catch(_){}
      return langs[0];
    }
    function saveActiveLang(lang){
      try { if (A.settings) A.settings.dictsLang = lang; } catch(_){}
    }
    let activeLang = loadActiveLang();

    // Выбранная строка (кандидат)
    function loadSelectedKey(){
      const saved = (A.settings && A.settings.lastDeckKey) || '';
      if (saved && byLang[activeLang]?.includes(saved)) return saved;
      return (byLang[activeLang] && byLang[activeLang][0]) || '';
    }
    let selectedKey = loadSelectedKey();

    // Надёжный переход «домой»
    function goHome(){
      // выставим активную кнопку сразу
      setFooterActive('home');
      try {
        if (window.Router && typeof Router.routeTo === 'function') { Router.routeTo('home'); return; }
        if (A.Router && typeof A.Router.routeTo === 'function')      { A.Router.routeTo('home'); return; }
      } catch(_){}
      const homeBtn = document.querySelector('footer .nav-btn[data-action="home"]');
      if (homeBtn) { homeBtn.click(); return; }
      document.body.setAttribute('data-route','home');
      try { document.dispatchEvent(new Event('lexitron:route-changed')); } catch(_){}
      try { window.dispatchEvent(new Event('lexitron:route-changed')); } catch(_){}
    }

    function renderTableForLang(lang){
      const keys = byLang[lang] || [];
      if (!keys.includes(selectedKey)) selectedKey = keys[0] || '';

      const rows = keys.map(key=>{
        const deck = A.Decks.resolveDeckByKey(key) || [];
        const flag = A.Decks.flagForKey(key);
        const name = A.Decks.resolveNameByKey(key);
        const isSel = (key === selectedKey);
        return `
          <tr class="dict-row${isSel ? ' is-selected' : ''}" data-key="${key}">
            <td class="t-center">${flag}</td>
            <td>${name}</td>
            <td class="t-center">${deck.length}</td>
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
              <tbody>${rows}</tbody>
            </table>

            <div class="dicts-actions">
              <button type="button" class="btn-primary" id="dicts-apply">${T.ok}</button>
            </div>
          </section>
        </div>`;

      // Делегирование кликов по tbody
      const tbody = app.querySelector('.dicts-table tbody');
      if (tbody){
        tbody.addEventListener('click', (e)=>{
          const eye = e.target.closest('.dicts-preview');
          if (eye){
            e.stopPropagation();
            openPreview(eye.dataset.key);
            return;
          }
          const row = e.target.closest('.dict-row');
          if (!row) return;
          const key = row.dataset.key;
          if (!key) return;

          selectedKey = key;
          app.querySelectorAll('.dict-row').forEach(r=> r.classList.remove('is-selected'));
          row.classList.add('is-selected');
        }, { passive:true });
      }

      // ОК → уходим на главную
      const ok = document.getElementById('dicts-apply');
      if (ok){
        ok.addEventListener('click', ()=>{
          try { A.settings = A.settings || {}; A.settings.lastDeckKey = selectedKey; } catch(_){}
          try { document.dispatchEvent(new CustomEvent('lexitron:deck-selected', { detail:{ key: selectedKey } })); } catch(_) {}
          goHome();
        });
      }

      renderFlagsUI();
    }

    // Панель флагов (для фильтрации)
    const FLAG = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', ru:'🇷🇺', uk:'🇺🇦', sr:'🇷🇸', pl:'🇵🇱' };
    function renderFlagsUI(){
      const box = app.querySelector('#dicts-flags');
      if (!box) return;
      box.innerHTML = '';
      langs.forEach(lang=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dict-flag' + (lang===activeLang ? ' active' : '');
        btn.dataset.lang = lang;
        btn.title = lang.toUpperCase();
        btn.textContent = FLAG[lang] || lang.toUpperCase();
        btn.addEventListener('click', ()=>{
          if (lang === activeLang) return;
          activeLang = lang;
          try { saveActiveLang(lang); } catch(_){}
          selectedKey = (byLang[activeLang] && byLang[activeLang][0]) || '';
          renderTableForLang(activeLang);
        });
        box.appendChild(btn);
      });
    }

    // Первая отрисовка
    renderTableForLang(activeLang);
  }

  /* ---------------------- modal preview ---------------------- */
  function openPreview(key){
    const T = t();
    const deck = A.Decks.resolveDeckByKey(key) || [];
    const name = A.Decks.resolveNameByKey(key);
    const flag = A.Decks.flagForKey(key);
    const lang = getUiLang();

    const rows = deck.map((w,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${w.word || w.term || ''}</td>
        <td>${lang === 'uk' ? (w.uk || w.translation_uk || '') 
                             : (w.ru || w.translation_ru || '')}</td>
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
          <table class="dict-table">
            <thead><tr><th>#</th><th>${T.word}</th><th>${T.trans}</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3" style="opacity:.6">${T.empty}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const close = ()=>wrap.remove();
    wrap.querySelector('.mmodal__overlay').onclick = close;
    wrap.querySelector('.mmodal__close').onclick = close;
  }

  /* ---------------------- export ---------------------- */
  A.ViewDicts = { mount: renderDictList };

})();
