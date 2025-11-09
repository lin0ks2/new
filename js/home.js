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
    try { return (A.settings && A.settings.lastDeckKey) || ACTIVE_KEY_FALLBACK; } catch(_){ return ACTIVE_KEY_FALLBACK; }
  }

  /* ---------------------------- Утилиты/язык --------------------------- */
  function getUiLang(){
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase() === 'uk') ? 'uk' : 'ru';
  }
  function setUiLang(code){
    const lang = (code === 'uk') ? 'uk' : 'ru';
    try { A.settings = A.settings || {}; A.settings.lang = lang; if (typeof A.saveSettings==='function') A.saveSettings(A.settings); } catch(_){}
    try { document.documentElement.dataset.lang = lang; document.documentElement.setAttribute('lang', lang); } catch(_){}
    try { const ev = new Event('lexitron:ui-lang-changed'); document.dispatchEvent(ev); window.dispatchEvent(ev); } catch(_){}
  }
  function bindLangToggle(){
    const toggle = document.getElementById('langToggle');
    if (!toggle) return;
    toggle.checked = (getUiLang() === 'uk');
    toggle.addEventListener('change', ()=>{
      setUiLang(toggle.checked ? 'uk' : 'ru');
      try {
        if (A.Router && typeof A.Router.routeTo === 'function') {
          A.Router.routeTo(A.Router.current || 'home');
        }
      } catch(_){}
    });
  }

  function tWord(w){
    const lang = getUiLang();
    if (!w) return '';
    return (lang === 'uk'
      ? (w.uk || w.translation_uk || w.trans_uk || w.ua)
      : (w.ru || w.translation_ru || w.trans_ru))
      || w.translation || w.trans || w.meaning || '';
  }
  function shuffle(arr){ for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  function uniqueById(arr){ const s=new Set(); return arr.filter(x=>{ const id=String(x.id); if(s.has(id))return false; s.add(id); return true; }); }
  const starKey = (typeof A.starKey === 'function') ? A.starKey : (id, key)=> `${key}:${id}`;

  function deckTitleByLang(key){
    const lang = getUiLang();
    try {
      if (A.Decks && typeof A.Decks.resolveNameByKeyLang==='function') return A.Decks.resolveNameByKeyLang(key, lang);
      if (A.Decks && typeof A.Decks.resolveNameByKey==='function'){
        const n = A.Decks.resolveNameByKey(key);
        if (n && typeof n === 'object'){
          return (lang === 'uk') ? (n.uk || n.name_uk || n.title_uk || n.name || n.title)
                                 : (n.ru || n.name_ru || n.title_ru || n.name || n.title);
        }
        if (typeof n === 'string') return n;
      }
      if (A.Dicts && A.Dicts[key]){
        const d = A.Dicts[key];
        return (lang === 'uk') ? (d.name_uk || d.title_uk || d.uk || d.name || d.title)
                               : (d.name_ru || d.title_ru || d.ru || d.name || d.title);
      }
    } catch(_){}
    return (lang === 'uk') ? 'Дієслова' : 'Глаголы';
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

    const key   = activeDeckKey();
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
          <p class="sets-stats" id="setStats"></p>
        </section>

        <!-- ЗОНА 2: Подсказки -->
        <section class="card home-hints">
         <!-- <h4 class="hints-title">${T.hints}</h4> -->
          <div class="hints-body" id="hintsBody"></div>
        </section>

        <!-- ЗОНА 3: Тренер -->
        <section class="card home-trainer">
          <div class="trainer-top">
            <div class="trainer-stars" aria-hidden="true"></div>
            <button class="fav-toggle" title="${T.fav}" aria-label="${T.fav}">🤍</button>
          </div>
          <h3 class="trainer-word"></h3>
          <p class="trainer-subtitle">${T.choose}</p>
          <div class="answers-grid"></div>
          <button class="btn-ghost idk-btn">${T.idk}</button>
          <p class="dict-stats" id="dictStats"></p>
        </section>
      </div>`;
  }

  /* ------------------------------- Зона 1: Сеты ------------------------------- */
  function getActiveBatchIndex(){
    try{
      return (A.Trainer && typeof A.Trainer.getBatchIndex==='function')
        ? A.Trainer.getBatchIndex(activeDeckKey())
        : 0;
    } catch(_){ return 0; }
  }

  function renderSets(){
    const key  = activeDeckKey();
    const deck = (A.Decks && typeof A.Decks.resolveDeckByKey==='function')
      ? (A.Decks.resolveDeckByKey(key) || [])
      : [];

    const grid    = document.getElementById('setsBar');
    const statsEl = document.getElementById('setStats');
    if (!grid) return;

    const totalSets = Math.ceil(deck.length / SET_SIZE);
    const activeIdx = getActiveBatchIndex();
    grid.innerHTML = '';

    const starsMax = (A.Trainer && typeof A.Trainer.starsMax==='function') ? A.Trainer.starsMax() : 5;

    for (let i=0;i<totalSets;i++){
      const from = i*SET_SIZE;
      const to   = Math.min(deck.length, (i+1)*SET_SIZE);
      const sub  = deck.slice(from,to);
      const done = sub.length>0 && sub.every(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id,key)])||0) >= starsMax);

      const btn = document.createElement('button');
      btn.className = 'set-pill' + (i===activeIdx?' is-active':'') + (done?' is-done':'');
      btn.textContent = i+1;
      btn.onclick = ()=>{
        try { if (A.Trainer && typeof A.Trainer.setBatchIndex==='function') A.Trainer.setBatchIndex(i, key); } catch(_){}
        renderSets(); renderTrainer();
        try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
      };
      grid.appendChild(btn);
    }

    const i = getActiveBatchIndex();
    const from = i*SET_SIZE, to = Math.min(deck.length,(i+1)*SET_SIZE);
    const words = deck.slice(from,to);
    const learned = words.filter(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id,key)])||0) >= starsMax).length;

    if (statsEl) {
      const uk = getUiLang()==='uk';
      statsEl.textContent = uk
        ? `Слів у наборі: ${words.length} / Вивчено: ${learned}`
        : `Слов в наборе: ${words.length} / Выучено: ${learned}`;
    }
  }

  /* --------------------------- Зона 2: Подсказки ------------------------ */
  function renderHints(text){
    const el = document.getElementById('hintsBody');
    if (!el) return;
    el.textContent = text || ' ';
  }

  /* ---------------------------- Зона 3: Тренер -------------------------- */
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

    if (A.UI && typeof A.UI.safeOptions === 'function') {
      return A.UI.safeOptions(word, { key, size: 4, t: tWord });
    }

    const deck = (A.Decks && typeof A.Decks.resolveDeckByKey==='function')
      ? (A.Decks.resolveDeckByKey(key) || [])
      : [];

    let pool = [];
    try { if (A.Mistakes && typeof A.Mistakes.getDistractors==='function') pool = A.Mistakes.getDistractors(key, word.id) || []; } catch(_){}
    if (pool.length < 3) pool = pool.concat(deck.filter(w => String(w.id)!==String(word.id)));
    const wrongs = shuffle(pool).filter(w => String(w.id)!==String(word.id)).slice(0,3);
    const opts = shuffle(uniqueById([word, ...wrongs])).slice(0,4);
    while (opts.length < 4 && deck.length) {
      const r = deck[Math.floor(Math.random()*deck.length)];
      if (String(r.id)!==String(word.id) && !opts.some(o=>String(o.id)===String(r.id))) opts.push(r);
    }
    return shuffle(opts);
  }

  function renderTrainer(){
    const key   = activeDeckKey();
    const slice = (A.Trainer && typeof A.Trainer.getDeckSlice==='function') ? (A.Trainer.getDeckSlice(key) || []) : [];
    if (!slice.length) return;

    const idx = (A.Trainer && typeof A.Trainer.sampleNextIndexWeighted==='function')
      ? A.Trainer.sampleNextIndexWeighted(slice)
      : Math.floor(Math.random()*slice.length);
    const word = slice[idx];

    const answers = document.querySelector('.answers-grid');
    const wordEl  = document.querySelector('.trainer-word');
    const favBtn  = document.querySelector('.fav-toggle');
    // set initial favorite state and click handler
    try {
      if (favBtn && window.App && typeof App.isFavorite==='function' && typeof App.toggleFavorite==='function') {
        const isFav = !!App.isFavorite(key, word.id);
        favBtn.classList.toggle('is-fav', isFav);
        favBtn.addEventListener('click', function(){
          try {
            App.toggleFavorite(key, word.id);
            const nowFav = !!App.isFavorite(key, word.id);
            favBtn.classList.toggle('is-fav', nowFav);
            if (nowFav) {
              favBtn.classList.add('pulse');
              setTimeout(()=> favBtn.classList.remove('pulse'), 320);
            }
          } catch (e) { /* noop */ }
        }, { once: true });
      }
    } catch(_) {}

    const stats   = document.getElementById('dictStats');
    const idkBtn  = document.querySelector('.idk-btn');

    wordEl.textContent = word.word || word.term || '';
    renderStarsFor(word);

    const opts = buildOptions(word);
    answers.innerHTML = '';

    // локальное состояние вопроса
    let penalized = false;
    let solved = false;
    const ADV_DELAY = 350; // ms

    function lockAll(correctId){
      const btns = answers.querySelectorAll('.answer-btn');
      btns.forEach(btn=>{
        btn.disabled = true;
        const id = btn.getAttribute('data-id');
        if (id && String(id) === String(correctId)){
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-dim');
        }
      });
    }

    opts.forEach(opt=>{
      const b = document.createElement('button');
      b.className = 'answer-btn';
      b.textContent = tWord(opt);
      b.setAttribute('data-id', String(opt.id));
      b.onclick = ()=>{
        if (solved) return;
        const ok = String(opt.id) === String(word.id);

        if (ok){
          solved = true;
          try { A.Trainer && A.Trainer.handleAnswer && A.Trainer.handleAnswer(key, word.id, true); } catch(_){}
          b.classList.add('is-correct');
          answers.querySelectorAll('.answer-btn').forEach(btn=>{
            if (btn !== b){ btn.classList.add('is-dim'); }
            btn.disabled = true;
          });
          renderStarsFor(word);
          setTimeout(()=>{
            renderSets();
            renderTrainer();
            try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
          }, ADV_DELAY);
          return;
        }

        // неверный вариант
        b.classList.add('is-wrong');
        b.disabled = true;

        // применяем штраф только один раз за вопрос
        if (!penalized){
          penalized = true;
          try { A.Trainer && A.Trainer.handleAnswer && A.Trainer.handleAnswer(key, word.id, false); } catch(_){}
          // ⬇️ не добавляем в ошибки, если тренируемся в «словаре ошибок»
          try {
            const isMistDeck = !!(A.Mistakes && A.Mistakes.isMistakesDeckKey && A.Mistakes.isMistakesDeckKey(key));
            if (!isMistDeck && A.Mistakes && typeof A.Mistakes.push==='function') {
              A.Mistakes.push(key, word.id);
            }
          } catch(_){}
          renderStarsFor(word);
          try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
        }
        // остаёмся на том же слове, пользователь может пробовать дальше
      };
      answers.appendChild(b);
    });

    if (idkBtn) {
      idkBtn.onclick = ()=>{
        if (solved) return;
        solved = true;
        // как верный: подсветить правильный, без штрафов/ошибок
        const correctBtn = answers.querySelector('.answer-btn[data-id="'+String(word.id)+'"]');
        if (correctBtn){
          correctBtn.classList.add('is-correct');
        }
        lockAll(word.id);
        setTimeout(()=>{
          renderSets();
          renderTrainer();
        }, ADV_DELAY);
      };
    }

    try {
      const has = A.Favorites && typeof A.Favorites.has==='function' && A.Favorites.has(key, word.id);
      if (favBtn) {
        const uk = getUiLang()==='uk';
        const favTitle = uk ? 'У вибране' : 'В избранное';
        favBtn.title = favTitle; favBtn.ariaLabel = favTitle;
        favBtn.classList.toggle('is-fav', !!has);
        favBtn.onclick = ()=>{
          try { A.Favorites && typeof A.Favorites.toggle==='function' && A.Favorites.toggle(key, word.id); } catch(_){}
          favBtn.classList.toggle('is-fav');
        };
      }
    } catch(_){}

    const full = (A.Decks && typeof A.Decks.resolveDeckByKey==='function') ? (A.Decks.resolveDeckByKey(key) || []) : [];
    const starsMax = (A.Trainer && typeof A.Trainer.starsMax==='function') ? A.Trainer.starsMax() : 5;
    const learned = full.filter(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id,key)])||0) >= starsMax).length;
    if (stats) {
      const uk = getUiLang()==='uk';
      stats.textContent = uk ? `Всього слів: ${full.length} / Вивчено: ${learned}`
                             : `Всего слов: ${full.length} / Выучено: ${learned}`;
    }
  }

  /* ------------------------ Маршрутизация по футеру --------------------- */
  const Router = {
    current: 'home',
    routeTo(action){
      this.current = action;
      const app = document.getElementById('app');
      if (!app) return;

      if (action === 'home'){
        mountMarkup();
        renderSets();
        renderTrainer();
        renderHints(' '); // пусто по умолчанию
        return;
      }
      if (action === 'dicts'){ A.ViewDicts.mount(); return; }
      if (action === 'mistakes'){ A.ViewMistakes && A.ViewMistakes.mount && A.ViewMistakes.mount(); return; }

      const uk = getUiLang()==='uk';
      const titles = { dicts: uk?'Словники':'Словари', fav: uk?'Вибране':'Избранное', mistakes: uk?'Мої помилки':'Мои ошибки', stats: uk?'Статистика':'Статистика' };
      const name = titles[action] || (uk ? 'Екран' : 'Экран');

      app.innerHTML = `
        <div class="home">
          <section class="card">
            <h3 style="margin:0 0 6px;">${name}</h3>
            <p style="opacity:.7; margin:0;">${uk ? 'Контент скоро з’явиться.' : 'Контент скоро появится.'}</p>
          </section>
        </div>`;
    }
  };
  A.Router = A.Router || Router;

  function bindFooterNav(){
    document.querySelectorAll('.app-footer .nav-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.getAttribute('data-action');
        if (!act) return;
        Router.routeTo(act);
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
