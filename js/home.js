/* ==========================================================
 * home.js — Главная страница MOYAMOVA (визуал старой базы + новая логика)
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  /* ----------------------------- Константы ----------------------------- */
  const ACTIVE_KEY_FALLBACK = 'de_verbs';
  const SET_SIZE = (A.Config && A.Config.setSizeDefault) || 40;

  function activeDeckKey(){
    try{
      if (A.Trainer && typeof A.Trainer.getDeckKey==='function'){
        return A.Trainer.getDeckKey() || (A.settings && A.settings.lastDeckKey) || ACTIVE_KEY_FALLBACK;
      }
    }catch(_){}
    try{
      return (A.settings && A.settings.lastDeckKey) || ACTIVE_KEY_FALLBACK;
    }catch(_){}
    return ACTIVE_KEY_FALLBACK;
  }

  function deckTitleByLang(key){
    try{
      if (A.Decks && A.Decks.resolveNameByKey) return A.Decks.resolveNameByKey(key) || key;
    }catch(_){}
    return key;
  }

  function getUiLang(){
    try{
      return (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    }catch(_){ return 'ru'; }
  }

  function tUI(){
    const uk = getUiLang() === 'uk';
    return uk
      ? { hints:'Підказки', choose:'Оберіть переклад', idk:'Не знаю', fav:'У вибране' }
      : { hints:'Подсказки', choose:'Выберите перевод', idk:'Не знаю', fav:'В избранное' };
  }

  /* --------------------------- DOM-шаблон Home -------------------------- */
  function mountMarkup(){
    const app = document.getElementById('app');
    if (!app) return;

    const key  = activeDeckKey();
    const flag  = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(key) || '🇩🇪') : '🇩🇪';
    const title = deckTitleByLang(key);
    const T = tUI();

    app.innerHTML = `
      <div class="home">
        <!-- ЗОНА 1: Сеты -->
        <section class="card home-sets">
          <header class="sets-header">
            <span class="flag" aria-hidden="true">${flag}</span>
            <h2 class="sets-title">${title}</h2>
          </header>
          <div class="sets-viewport" id="setsViewport">
  <div class="sets-grid" id="setsBar"></div>
</div>

        </section>

        <!-- ЗОНА 2: Подсказки -->
        <section class="card home-hints">
          <header class="hints-header">
            <h3 class="hints-title">${T.hints}</h3>
          </header>
          <div class="hints-body" id="hintsBody"> </div>
        </section>

        <!-- ЗОНА 3: Тренер -->
        <section class="card home-trainer">
          <div class="trainer-row" id="trainerRow">
            <div class="trainer-stars" aria-hidden="true"></div>
            <div class="trainer-word" id="trainerWord">—</div>
          </div>
          <div class="answers" id="answers"></div>

          <div class="trainer-actions">
            <button class="btn idk-btn" data-action="idk">${T.idk}</button>
            <button class="btn fav-btn" data-action="fav">${T.fav}</button>
          </div>

          <div class="trainer-stats" id="trainerStats"></div>
        </section>
      </div>
    `;
  }

  /* ---------------------------- Рендер set'ов --------------------------- */
  function renderSets(){
    const key = activeDeckKey();
    const vp  = document.getElementById('setsViewport');
    const bar = document.getElementById('setsBar');
    if (!vp || !bar) return;

    // ... существующий код renderSets() ...
  }

  /* --------------------------- Зона 2: Подсказки ------------------------ */
  function renderHints(text){
    const el = document.getElementById('hintsBody');
    if (!el) return;
    el.textContent = text || ' ';
  }

  /* ---------------------------- Зона 3: Тренер -------------------------- */
  function starKey(wordId, deckKey){
    return String(deckKey||'') + '::' + String(wordId||'');
  }

  function getStars(wordId){
    const key = activeDeckKey();
    const val = (A.state && A.state.stars && A.state.stars[starKey(wordId, key)]) || 0;
    return Number(val) || 0;
  }

  function renderStarsFor(word){
    const box = document.querySelector('.trainer-stars');
    if (!box || !word) return;
    const max  = (A.Trainer && typeof A.Trainer.starsMax==='function') ? A.Trainer.starsMax() : 5;
    const have = getStars(word.id);
    let html = '';
    for (let i = 1; i <= max; i++) html += `<span class="star ${i <= have ? 'on' : ''}" aria-hidden="true">★</span>`;
    box.innerHTML = html;
  }

  function buildOptions(word){
    const key = activeDeckKey();
    const fullDeck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(key) || []) : [];
    const opts = (A.Trainer && typeof A.Trainer.buildOptions==='function')
      ? A.Trainer.buildOptions(word, fullDeck)
      : [];
    return opts;
  }

  function bindTrainer(){
    const answers = document.getElementById('answers');
    const statsBox = document.getElementById('trainerStats');
    if (!answers) return;

    function renderQuestion(){
      const cur = (A.Trainer && typeof A.Trainer.current==='function') ? A.Trainer.current() : null;
      if (!cur){ answers.innerHTML = ''; return; }

      renderStarsFor(cur.word);

      const options = buildOptions(cur.word);
      const T = tUI();
      let html = '';
      for (let i=0;i<options.length;i++){
        const o = options[i];
        html += `<button class="answer-btn" data-id="${o.id}">${o.t || o.translation || ''}</button>`;
      }
      answers.innerHTML = html;

      if (statsBox){
        try{
          const s = (A.Trainer && typeof A.Trainer.stats==='function') ? A.Trainer.stats() : null;
          if (s){
            statsBox.innerHTML = `<div class="stats-row">#${s.index+1} / ${s.total}</div>`;
          }
        }catch(_){}
      }
    }

    answers.addEventListener('click', (e)=>{
      const btn = e.target.closest('.answer-btn');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      try{
        if (A.Trainer && typeof A.Trainer.answer==='function'){
          A.Trainer.answer(id);
          renderQuestion();
        }
      }catch(_){}
    });

    // «Не знаю» и «В избранное»
    document.querySelector('.idk-btn')?.addEventListener('click', ()=>{
      try{
        if (A.Trainer && typeof A.Trainer.idk==='function'){ A.Trainer.idk(); renderQuestion(); }
      }catch(_){}
    });

    document.querySelector('.fav-btn')?.addEventListener('click', ()=>{
      try{
        if (!A.Trainer || !A.Trainer.current) return;
        const cur = A.Trainer.current();
        if (!cur || !cur.word) return;
        const baseKey = (A.Trainer.getBaseKey && A.Trainer.getBaseKey()) || (A.Trainer.getDeckKey && A.Trainer.getDeckKey());
        if (A.Favorites && typeof A.Favorites.toggle==='function' && baseKey){
          A.Favorites.toggle(baseKey, cur.word.id);
        }
      }catch(_){}
    });

    // первый рендер
    renderQuestion();
  }

  /* ------------------------------ ЯЗЫК/ТЕМА ----------------------------- */
  function bindLangToggle(){
    const toggle = document.getElementById('langToggle');
    if (!toggle) return;
    toggle.addEventListener('change', ()=>{
      try{
        const setUiLang = (A.UI && A.UI.setUiLang) ? A.UI.setUiLang : (lang=>{ document.documentElement.dataset.lang = lang; });
        setUiLang(toggle.checked ? 'uk' : 'ru');
        if (A.Router && typeof A.Router.routeTo === 'function'){
          A.Router.routeTo(A.Router.current || 'home');
        }
      }catch(e){ console.warn(e); }
    });
  }

  /* ---------------------------- Футер-навигация ------------------------- */
  function bindFooterNav(){
    document.querySelectorAll('.app-footer .nav-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.getAttribute('data-action');
        if (!act) return;

        // --- Избранное: фиксируем текущий роут и не дергаем Router ---
        if (act === 'fav') {
          try { window.A = window.A || {}; A.Router = A.Router || {}; A.Router.current = 'fav'; } catch(_) {}
          try { document.body.setAttribute('data-route','fav'); } catch(_) {}
          return;
        }

        // Остальные — как было
        try { Router.routeTo(act); } catch(e){ console.warn(e); }
      });
    });
  }

  /* ------------------------------- Экспорт ------------------------------ */
  function mountApp(){
    bindLangToggle();
    bindFooterNav();
    Router.routeTo('home');
  }

  A.Home = {
    mount: mountApp,
    renderSetStats: renderSets,
    updateStats: function(){ /* обновляется в renderTrainer() */ }
  };

  if (document.readyState !== 'loading') mountApp();
  else document.addEventListener('DOMContentLoaded', mountApp);
})();
