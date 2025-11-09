/* ==========================================================
 * home.js — Главная (двухфазная отрисовка звёзд + мягкий переключатель сложности)
 *  - setUiLang(): dataset.lang + html@lang + save + event
 *  - bindLevelToggle(): пишет App.settings.level, не ремоунтит экран; мягко перерисовывает звёзды/статы
 *  - Звёзды: двухфазный рендер (сначала целые, потом половинка наложением)
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});

  /* ----------------------------- Константы ----------------------------- */
  const ACTIVE_KEY_FALLBACK = 'de_verbs';
  const SET_SIZE = (A.Config && A.Config.setSizeDefault) || 40;

  /* ---------------------------- Язык/строки ---------------------------- */
  function getUiLang() {
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || null;
    const attr = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const v = (s || attr || 'ru').toLowerCase();
    return (v === 'uk') ? 'uk' : 'ru';
  }

  function setUiLang(code){
    const lang = (code === 'uk') ? 'uk' : 'ru';
    A.settings = A.settings || {};
    A.settings.lang = lang;
    if (typeof A.saveSettings === 'function') { try { A.saveSettings(A.settings); } catch(_){} }
    document.documentElement.dataset.lang = lang;
    document.documentElement.setAttribute('lang', lang);
    const ev = new Event('lexitron:ui-lang-changed');
    try { document.dispatchEvent(ev); } catch(_){}
    try { window.dispatchEvent(ev); } catch(_){}
  }

  function tUI() {
    const uk = getUiLang() === 'uk';
    return uk
      ? { hints: 'Підказки', choose: 'Оберіть переклад', idk: 'Не знаю', fav: 'У вибране' }
      : { hints: 'Подсказки', choose: 'Выберите перевод', idk: 'Не знаю', fav: 'В избранное' };
  }

  function bindLangToggle() {
    const t = document.getElementById('langToggle');
    if (!t) return;
    t.checked = (getUiLang() === 'uk');
    t.addEventListener('change', () => {
      setUiLang(t.checked ? 'uk' : 'ru');
      try {
        if (A.Router && typeof A.Router.routeTo === 'function') {
          A.Router.routeTo(A.Router.current || 'home');
        } else {
          mountMarkup(); renderSets(); renderTrainer();
        }
      } catch(_){}
    });
  }

  /* ---------------------------- Сложность ---------------------------- */
  function getMode() {
    try {
      const fromSettings = (A.settings && (A.settings.level || A.settings.mode));
      if (fromSettings) return String(fromSettings).toLowerCase() === 'hard' ? 'hard' : 'normal';
    } catch(_) {}
    const dl = (document.documentElement.dataset.level || '').toLowerCase();
    return dl === 'hard' ? 'hard' : 'normal';
  }
  if (typeof A.getMode !== 'function') {
    A.getMode = function(){ return getMode(); };
  }
  if (typeof A.getStarStep !== 'function') {
    A.getStarStep = function(){ return (getMode() === 'normal') ? 1 : 0.5; };
  }

  // 👇 мини-тост в "нашем" стиле (пытается использовать существующие, иначе фолбэк)
  function showModeBlockedToast(){
    const uk = getUiLang() === 'uk';
    const msg = uk
      ? 'Завершіть поточний сет, щоб змінити режим.'
      : 'Завершите текущий сет, чтобы сменить режим.';
    try {
      if (A.UI && typeof A.UI.toast === 'function') { A.UI.toast(msg, { ttl: 3000, center: true }); return; }
      if (A.Toast && typeof A.Toast.show === 'function') { A.Toast.show(msg, { ttl: 3000 }); return; }
      if (typeof window.miniToast === 'function') { window.miniToast(msg, 3000); return; }
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    } catch(_) {}
    // Фолбэк: компактный баннер по центру
    try {
      const el = document.createElement('div');
      el.className = 'mini-toast';
      el.textContent = msg;
      Object.assign(el.style, {
        position:'fixed', left:'50%', bottom:'14dvh', transform:'translateX(-50%)',
        maxWidth:'min(86vw, 540px)', padding:'.6rem .9rem', borderRadius:'12px',
        border:'1px solid rgba(0,0,0,.08)', backdropFilter:'saturate(1.2) blur(6px)',
        background:'rgba(20,30,50,.92)', color:'#fff', zIndex:'2147483646',
        font:'13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial',
        opacity:'0', transition:'opacity .18s ease'
      });
      // light-mode корректировки
      if (matchMedia && matchMedia('(prefers-color-scheme: light)').matches) {
        el.style.background = 'rgba(255,255,255,.98)';
        el.style.color = '#111';
        el.style.border = '1px solid #e5e8ef';
      }
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.opacity='1'; });
      setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>{ el.remove(); }, 220); }, 2600);
    } catch(_) {}
  }

  function bindLevelToggle() {
    const t = document.getElementById('levelToggle');
    if (!t) return;
    t.checked = (getMode() === 'hard'); // checked => hard
    t.addEventListener('change', () => {
      const before = getMode();
      const want   = t.checked ? 'hard' : 'normal';

      // Блокировка: если в текущем сете есть прогресс и сет не выучен — запрещаем переключение
      if (before !== want) {
        const key = activeDeckKey();
        const ids = getCurrentSetWordIds(key);
        const anyProgress = hasProgressInSet(key, ids);
        const allDone     = isSetDone(key, ids);
        if (anyProgress && !allDone) {
          t.checked = (before === 'hard'); // откат тумблера
          showModeBlockedToast();
          return; // ничего не меняем
        }
      }

      // Переключение разрешено
      const mode = want;
      A.settings = A.settings || {};
      A.settings.level = mode;
      try { A.saveSettings && A.saveSettings(A.settings); } catch(_){}
      document.documentElement.dataset.level = mode;

      try {
        repaintStarsOnly();
        A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender();
      } catch(_){}
    });
  }

  /* ------------------------------ Утилиты ------------------------------ */
  const starKey = (typeof A.starKey === 'function') ? A.starKey : (id, key) => `${key}:${id}`;

  function activeDeckKey() {
    try {
      if (A.Trainer && typeof A.Trainer.getDeckKey === 'function') {
        return A.Trainer.getDeckKey() || (A.settings && A.settings.lastDeckKey) || ACTIVE_KEY_FALLBACK;
      }
    } catch (_) {}
    try { return (A.settings && A.settings.lastDeckKey) || ACTIVE_KEY_FALLBACK; }
    catch (_) { return ACTIVE_KEY_FALLBACK; }
  }

  function tWord(w) {
    const lang = getUiLang();
    if (!w) return '';
    return (lang === 'uk'
      ? (w.uk || w.translation_uk || w.trans_uk || w.ua)
      : (w.ru || w.translation_ru || w.trans_ru))
      || w.translation || w.trans || w.meaning || '';
  }
  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function uniqueById(arr) { const s = new Set(); return arr.filter(x => { const id = String(x.id); if (s.has(id)) return false; s.add(id); return true; }); }

  /* --------------------------- Избранное (сердце) --------------------------- */
  function isFav(key, id) {
    try { if (typeof App.isFavorite === 'function') return !!App.isFavorite(key, id); } catch(_) {}
    try { if (A.Favorites && typeof A.Favorites.has === 'function') return !!A.Favorites.has(key, id); } catch(_) {}
    return false;
  }
  function toggleFav(key, id) {
    try { if (typeof App.toggleFavorite === 'function') return App.toggleFavorite(key, id); } catch(_) {}
    try { if (A.Favorites && typeof A.Favorites.toggle === 'function') return A.Favorites.toggle(key, id); } catch(_) {}
  }

  /* ------------------------- DOM-шаблон главной ------------------------- */
  function resolveDeckTitle(key) {
    const lang = getUiLang();
    try {
      if (A.Decks && typeof A.Decks.resolveNameByKeyLang === 'function') return A.Decks.resolveNameByKeyLang(key, lang);
      if (A.Decks && typeof A.Decks.resolveNameByKey === 'function') {
        const n = A.Decks.resolveNameByKey(key);
        if (n && typeof n === 'object') {
          return (lang === 'uk') ? (n.uk || n.name_uk || n.title_uk || n.name || n.title)
                                 : (n.ru || n.name_ru || n.title_ru || n.name || n.title);
        }
        if (typeof n === 'string') return n;
      }
      if (A.Dicts && A.Dicts[key]) {
        const d = A.Dicts[key];
        return (lang === 'uk') ? (d.name_uk || d.title_uk || d.uk || d.name || d.title)
                               : (d.name_ru || d.title_ru || d.ru || d.name || d.title);
      }
    } catch (_) {}
    return (lang === 'uk') ? 'Дієслова' : 'Глаголы';
  }

  function mountMarkup() {
    const app = document.getElementById('app');
    if (!app) return;

    const key   = activeDeckKey();
    const flag  = (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(key) || '🇩🇪') : '🇩🇪';
    const title = resolveDeckTitle(key);
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
          <div class="hints-body" id="hintsBody"></div>
        </section>

        <!-- ЗОНА 3: Тренер -->
        <section class="card home-trainer">
          <div class="trainer-top">
            <div class="trainer-stars" aria-hidden="true"></div>
            <button aria-label="${T.fav}" class="heart" data-title-key="tt_favorites" id="favBtn">♡</button>
          </div>
          <h3 class="trainer-word"></h3>
          <p class="trainer-subtitle">${T.choose}</p>
          <div class="answers-grid"></div>
          <button class="btn-ghost idk-btn">${T.idk}</button>
          <p class="dict-stats" id="dictStats"></p>
        </section>
      </div>`;
  }

  /* ------------------------------- Сеты ------------------------------- */
  function getActiveBatchIndex() {
    try { return (A.Trainer && typeof A.Trainer.getBatchIndex === 'function') ? A.Trainer.getBatchIndex(activeDeckKey()) : 0; }
    catch (_) { return 0; }
  }

  // IDs слов текущего сета активного словаря
  function getCurrentSetWordIds(key){
    const deck = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function')
      ? (A.Decks.resolveDeckByKey(key) || [])
      : [];
    const idx = getActiveBatchIndex();
    const from = idx * SET_SIZE;
    const to   = Math.min(deck.length, (idx + 1) * SET_SIZE);
    return deck.slice(from, to).map(w => w && w.id).filter(Boolean);
  }
  // Есть ли в сете ненулевой прогресс
  function hasProgressInSet(key, ids){
    if (!ids || !ids.length) return false;
    const stars = (A.state && A.state.stars) || {};
    for (let i=0;i<ids.length;i++){
      const val = Number(stars[starKey(ids[i], key)] || 0);
      if (val > 0) return true;
    }
    return false;
  }
  // Выучен ли сет (все слова >= starsMax)
  function isSetDone(key, ids){
    if (!ids || !ids.length) return false;
    const stars = (A.state && A.state.stars) || {};
    const max = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
    for (let i=0;i<ids.length;i++){
      const val = Number(stars[starKey(ids[i], key)] || 0);
      if (val < max) return false;
    }
    return true;
  }

  function renderSets() {
    const key  = activeDeckKey();
    const deck = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function')
      ? (A.Decks.resolveDeckByKey(key) || [])
      : [];

    const grid    = document.getElementById('setsBar');
    const statsEl = document.getElementById('setStats');
    if (!grid) return;

    const totalSets = Math.ceil(deck.length / SET_SIZE);
    const activeIdx = getActiveBatchIndex();
    grid.innerHTML = '';

    const starsMax = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;

    for (let i = 0; i < totalSets; i++) {
      const from = i * SET_SIZE;
      const to   = Math.min(deck.length, (i + 1) * SET_SIZE);
      const sub  = deck.slice(from, to);
      const done = sub.length > 0 && sub.every(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id, key)]) || 0) >= starsMax);

      const btn = document.createElement('button');
      btn.className = 'set-pill' + (i === activeIdx ? ' is-active' : '') + (done ? ' is-done' : '');
      btn.textContent = i + 1;
      btn.onclick = () => {
        try { if (A.Trainer && typeof A.Trainer.setBatchIndex === 'function') A.Trainer.setBatchIndex(i, key); } catch (_){}
        renderSets(); renderTrainer();
        try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
      };
      grid.appendChild(btn);
    }

    const i = getActiveBatchIndex();
    const from = i * SET_SIZE, to = Math.min(deck.length, (i + 1) * SET_SIZE);
    const words = deck.slice(from, to);

    const starsMax2 = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
    const learned = words.filter(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id, key)]) || 0) >= starsMax2).length;

    if (statsEl) {
      const uk = getUiLang() === 'uk';
      statsEl.textContent = uk
        ? `Слів у наборі: ${words.length} / Вивчено: ${learned}`
        : `Слов в наборе: ${words.length} / Выучено: ${learned}`;
    }
  }

  /* ------------------------------ Звёзды ------------------------------- */
  function getStars(wordId) {
    const key = activeDeckKey();
    const v = (A.state && A.state.stars && A.state.stars[starKey(wordId, key)]) || 0;
    return Number(v) || 0;
  }

  function drawStarsTwoPhase(box, score, max) {
    if (!box) return;
    const EPS = 1e-6;
    const kids = box.querySelectorAll('.star');
    if (kids.length !== max) {
      let html = '';
      for (let i = 0; i < max; i++) html += '<span class="star" aria-hidden="true">★</span>';
      box.innerHTML = html;
    }
    const stars = box.querySelectorAll('.star');
    stars.forEach(el => { el.classList.remove('full','half'); });

    const filled = Math.floor(score + EPS);
    for (let i = 0; i < Math.min(filled, max); i++) {
      stars[i].classList.add('full');
    }
    const frac = score - filled;
    if (frac + EPS >= 0.5 && filled < max) {
      stars[filled].classList.add('half');
    }
  }

  function renderStarsFor(word) {
    const box = document.querySelector('.trainer-stars');
    if (!box || !word) return;
    const max  = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
    const have = getStars(word.id);
    drawStarsTwoPhase(box, have, max);
  }

  /* ------------------------------ Варианты ------------------------------ */
  function buildOptions(word) {
    const key = activeDeckKey();

    if (A.UI && typeof A.UI.safeOptions === 'function') {
      return A.UI.safeOptions(word, { key, size: 4, t: tWord });
    }

    const deck = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function')
      ? (A.Decks.resolveDeckByKey(key) || [])
      : [];

    let pool = [];
    try { if (A.Mistakes && typeof A.Mistakes.getDistractors === 'function') pool = A.Mistakes.getDistractors(key, word.id) || []; } catch (_){}
    if (pool.length < 3) pool = pool.concat(deck.filter(w => String(w.id) !== String(word.id)));
    const wrongs = shuffle(pool).filter(w => String(w.id) !== String(word.id)).slice(0, 3);
    const opts = shuffle(uniqueById([word, ...wrongs])).slice(0, 4);
    while (opts.length < 4 && deck.length) {
      const r = deck[Math.floor(Math.random() * deck.length)];
      if (String(r.id) !== String(word.id) && !opts.some(o => String(o.id) === String(r.id))) opts.push(r);
    }
    return shuffle(opts);
  }

  /* ------------------------------- Тренер ------------------------------- */
  function renderTrainer() {
    const key   = activeDeckKey();
    const slice = (A.Trainer && typeof A.Trainer.getDeckSlice === 'function') ? (A.Trainer.getDeckSlice(key) || []) : [];
    if (!slice.length) return;

    const idx = (A.Trainer && typeof A.Trainer.sampleNextIndexWeighted === 'function')
      ? A.Trainer.sampleNextIndexWeighted(slice)
      : Math.floor(Math.random() * slice.length);
    const word = slice[idx];

    A.__currentWord = word;

    const answers = document.querySelector('.answers-grid');
    const wordEl  = document.querySelector('.trainer-word');
    const favBtn  = document.getElementById('favBtn');
    const idkBtn  = document.querySelector('.idk-btn');
    const stats   = document.getElementById('dictStats');

    if (favBtn) {
      const favNow = isFav(key, word.id);
      favBtn.textContent = favNow ? '♥' : '♡';
      favBtn.classList.toggle('is-fav', favNow);
      favBtn.setAttribute('aria-pressed', String(favNow));
      try {
        const uk = getUiLang() === 'uk';
        const title = uk ? 'У вибране' : 'В избранное';
        favBtn.title = title; favBtn.ariaLabel = title;
      } catch (_){}
      favBtn.onclick = function () {
        try { toggleFav(key, word.id); } catch (_){}
        const now = isFav(key, word.id);
        favBtn.textContent = now ? '♥' : '♡';
        favBtn.classList.toggle('is-fav', now);
        favBtn.setAttribute('aria-pressed', String(now));
        favBtn.style.transform = 'scale(1.2)';
        setTimeout(() => { favBtn.style.transform = 'scale(1)'; }, 140);
      };
    }

    wordEl.textContent = word.word || word.term || '';
    renderStarsFor(word);

    const opts = buildOptions(word);
    answers.innerHTML = '';

    let penalized = false;
    let solved = false;
    const ADV_DELAY = 350;

    function afterAnswer(correct) {
      try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
    }

    function lockAll(correctId) {
      const btns = answers.querySelectorAll('.answer-btn');
      btns.forEach(btn => {
        btn.disabled = true;
        const id = btn.getAttribute('data-id');
        if (id && String(id) === String(correctId)) btn.classList.add('is-correct');
        else btn.classList.add('is-dim');
      });
    }

    opts.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'answer-btn';
      b.textContent = tWord(opt);
      b.setAttribute('data-id', String(opt.id));
      b.onclick = () => {
        if (solved) return;
        const ok = String(opt.id) === String(word.id);

        if (ok) {
          solved = true;
          try { A.Trainer && A.Trainer.handleAnswer && A.Trainer.handleAnswer(key, word.id, true); } catch (_){}
          try { renderStarsFor(word); } catch(_){}
          b.classList.add('is-correct');
          answers.querySelectorAll('.answer-btn').forEach(btn => {
            if (btn !== b) btn.classList.add('is-dim');
            btn.disabled = true;
          });
          afterAnswer(true);
          setTimeout(() => { renderSets(); renderTrainer(); }, ADV_DELAY);
          return;
        }

        b.classList.add('is-wrong');
        b.disabled = true;

        if (!penalized) {
          penalized = true;
          try { A.Trainer && A.Trainer.handleAnswer && A.Trainer.handleAnswer(key, word.id, false); } catch (_){}
          try { renderStarsFor(word); } catch(_){}
          try {
            const isMistDeck = !!(A.Mistakes && A.Mistakes.isMistakesDeckKey && A.Mistakes.isMistakesDeckKey(key));
            if (!isMistDeck && A.Mistakes && typeof A.Mistakes.push === 'function') {
              A.Mistakes.push(key, word.id);
            }
          } catch (_){}
          afterAnswer(false);
        }
      };
      answers.appendChild(b);
    });

    if (idkBtn) {
      idkBtn.onclick = () => {
        if (solved) return;
        solved = true;
        const correctBtn = answers.querySelector('.answer-btn[data-id="' + String(word.id) + '"]');
        if (correctBtn) correctBtn.classList.add('is-correct');
        lockAll(word.id);
        setTimeout(() => { renderSets(); renderTrainer(); }, ADV_DELAY);
      };
    }

    const full = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function') ? (A.Decks.resolveDeckByKey(key) || []) : [];
    const starsMax = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
    const learned = full.filter(w => ((A.state && A.state.stars && A.state.stars[starKey(w.id, key)]) || 0) >= starsMax).length;
    if (stats) {
      const uk = getUiLang() === 'uk';
      stats.textContent = uk ? `Всього слів: ${full.length} / Вивчено: ${learned}`
                             : `Всего слов: ${full.length} / Выучено: ${learned}`;
    }
  }

  function repaintStarsOnly(){
    try {
      const word = A.__currentWord;
      if (!word) return;
      const box = document.querySelector('.trainer-stars');
      if (!box) return;
      const max  = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
      const have = getStars(word.id);
      drawStarsTwoPhase(box, have, max);
    } catch(_){}
  }

  /* ------------------------ Роутер и старт ------------------------ */
  const Router = {
    current: 'home',
    routeTo(action) {
      this.current = action;
      const app = document.getElementById('app');
      if (!app) return;

      if (action === 'home') {
        mountMarkup();
        renderSets();
        renderTrainer();
        const hb = document.getElementById('hintsBody');
        if (hb) hb.textContent = ' ';
        return;
      }
      if (action === 'dicts') { A.ViewDicts && A.ViewDicts.mount && A.ViewDicts.mount(); return; }
      if (action === 'mistakes') { A.ViewMistakes && A.ViewMistakes.mount && A.ViewMistakes.mount(); return; }

      const uk = getUiLang() === 'uk';
      const titles = { dicts: uk ? 'Словники' : 'Словари', fav: uk ? 'Вибране' : 'Избранное', mistakes: uk ? 'Мої помилки' : 'Мои ошибки', stats: uk ? 'Статистика' : 'Статистика' };
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

  function bindFooterNav() {
    document.querySelectorAll('.app-footer .nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-action');
        if (!act) return;
        Router.routeTo(act);
      });
    });
  }

  function mountApp() {
    document.documentElement.dataset.level = getMode();
    setUiLang(getUiLang());

    bindLangToggle();
    bindLevelToggle();
    bindFooterNav();
    Router.routeTo('home');
  }

  A.Home = { mount: mountApp };

  if (document.readyState !== 'loading') mountApp();
  else document.addEventListener('DOMContentLoaded', mountApp);
})();
