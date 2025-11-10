/* ==========================================================
 * home.js — Главная (двухфазная отрисовка звёзд + переключатель сложности с подтверждением)
 *  - setUiLang(): dataset.lang + html@lang + save + event
 *  - bindLevelToggle(): нативное подтверждение → сброс прогресса текущего словаря → запись режима → мягкая перерисовка
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

  // ✅ Упрощённый и безопасный переключатель сложности
  function bindLevelToggle() {
    const t = document.getElementById('levelToggle');
    if (!t) return;

    t.checked = (getMode() === 'hard'); // checked => hard

    t.addEventListener('change', () => {
      const before = getMode();
      const want   = t.checked ? 'hard' : 'normal';
      if (before === want) return;

      // Проверяем прогресс в активном словаре
      let hasProgress = false;
      try {
        const key  = activeDeckKey();
        const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(key) || []) : [];
        const st   = (A.state && A.state.stars) ? A.state.stars : {};
        for (let i = 0; i < deck.length; i++) {
          const id = deck[i] && deck[i].id;
          if (!id) continue;
          const v = Number(st[`${key}:${id}`] || 0);
          if (v > 0) { hasProgress = true; break; }
        }
      } catch (_) {}

      // Если есть прогресс — подтверждение и при согласии чистим только текущий словарь
      if (hasProgress) {
        const uk  = (getUiLang() === 'uk');
        const msg = uk
          ? 'Перемикання режиму очистить прогрес цього словника. Продовжити?'
          : 'Переключение режима очистит прогресс этого словаря. Продолжить?';
        if (!window.confirm(msg)) {
          t.checked = (before === 'hard'); // откат тумблера
          return;
        }
        try {
          const key  = activeDeckKey();
          const deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(key) || []) : [];
          if (A.state && A.state.stars) {
            for (let i = 0; i < deck.length; i++) {
              const id = deck[i] && deck[i].id;
              if (!id) continue;
              delete A.state.stars[`${key}:${id}`];
            }
          }
          A.saveState && A.saveState(A.state);
        } catch (_) {}
      }

      // Переключаем режим
      A.settings = A.settings || {};
      A.settings.level = want;
      try { A.saveSettings && A.saveSettings(A.settings); } catch (_) {}
      document.documentElement.dataset.level = want;

      // Мягкая перерисовка (без полного ремаунта)
      try {
        repaintStarsOnly();
        renderSets();
        A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender();
      } catch (_) {}
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

  // Двухфазная отрисовка: сначала целые, потом "половинка" наложением
  function drawStarsTwoPhase(box, score, max) {
    if (!box) return;
    const EPS = 1e-6;
    // Подготовим нужное число элементов
    const kids = box.querySelectorAll('.star');
    if (kids.length !== max) {
      let html = '';
      for (let i = 0; i < max; i++) html += '<span class="star" aria-hidden="true">★</span>';
      box.innerHTML = html;
    }
    const stars = box.querySelectorAll('.star');
    // Сброс классов
    stars.forEach(el => { el.classList.remove('full','half'); });

    const filled = Math.floor(score + EPS);
    for (let i = 0; i < Math.min(filled, max); i++) {
      stars[i].classList.add('full');
    }
    // половинка на следующей звезде, если есть дробная часть >= 0.5
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

    // запомним текущую карточку для мягкой перерисовки звёзд при смене режима
    A.__currentWord = word;

    const answers = document.querySelector('.answers-grid');
    const wordEl  = document.querySelector('.trainer-word');
    const favBtn  = document.getElementById('favBtn');
    const idkBtn  = document.querySelector('.idk-btn');
    const stats   = document.getElementById('dictStats');

    // Сердце
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

    // Слово + звёзды
    const term = word.word || word.term || '';
    wordEl.textContent = term;
    renderStarsFor(word);

    // Ответы
    const opts = buildOptions(word);
    answers.innerHTML = '';

    let penalized = false;
    let solved = false;
    const ADV_DELAY = 500;

    function afterAnswer() {
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

        // неверно
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

  // Мягкая перерисовка звёзд при смене режима (без смены слова/ответов)
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
    // Синхронизация стартовых атрибутов
    document.documentElement.dataset.level = getMode();
    setUiLang(getUiLang());   // синхронизируем атрибуты и событие языка

    bindLangToggle();
    bindLevelToggle();
    bindFooterNav();
    Router.routeTo('home');
  }

  A.Home = { mount: mountApp };

  if (document.readyState !== 'loading') mountApp();
  else document.addEventListener('DOMContentLoaded', mountApp);
})();
