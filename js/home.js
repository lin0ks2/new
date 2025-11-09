/* ==========================================================
 * home.js — Главная
 *  - Режимы normal/hard (±0.5 в hard)
 *  - Половинные звёзды
 *  - Сердце как текст ♡/♥
 *  - Тост в Зоне 2 при переключении сложности
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});

  /* ----------------------------- Константы ----------------------------- */
  const ACTIVE_KEY_FALLBACK = 'de_verbs';
  const SET_SIZE = (A.Config && A.Config.setSizeDefault) || 40;

  /* ---------------------------- Язык/строки ---------------------------- */
  function getUiLang() {
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase() === 'uk') ? 'uk' : 'ru';
  }
  function tUI() {
    const uk = getUiLang() === 'uk';
    return uk
      ? { hints: 'Підказки', choose: 'Оберіть переклад', idk: 'Не знаю', fav: 'У вибране' }
      : { hints: 'Подсказки', choose: 'Выберите перевод', idk: 'Не знаю', fav: 'В избранное' };
  }

  /* -------------------------- РЕЖИМ: normal/hard -------------------------- */
  function getMode() {
    const s = (A.settings && A.settings.mode) || null;
    const htmlMode = (document.documentElement.dataset.level || '').toLowerCase();
    return s || (htmlMode === 'hard' ? 'hard' : 'normal');
  }
  function setMode(mode) {
    const m = (mode === 'hard') ? 'hard' : 'normal';
    // html data-атрибут
    document.documentElement.dataset.level = m;
    // состояние/сохранение
    A.settings = A.settings || {};
    A.settings.mode = m;
    if (typeof A.saveSettings === 'function') { try { A.saveSettings(A.settings); } catch(_){} }
    // гарантируем раздельные карты звёзд
    ensureStarsByMode();
    // показать тост при следующем рендере тренера
    A.__pendingModeToast = true;
  }

  // Раздельные карты звёзд для двух режимов + "виртуальное" свойство state.stars
  function ensureStarsByMode() {
    A.state = A.state || {};
    if (!A.state._stars_normal && A.state.stars && typeof A.state.stars === 'object') {
      // первичная миграция: скопируем старое состояние в обе карты
      A.state._stars_normal = Object.assign({}, A.state.stars);
      A.state._stars_hard   = Object.assign({}, A.state.stars);
    }
    A.state._stars_normal = A.state._stars_normal || {};
    A.state._stars_hard   = A.state._stars_hard   || {};

    const desc = Object.getOwnPropertyDescriptor(A.state, 'stars');
    if (!desc || !desc.get) {
      try {
        Object.defineProperty(A.state, 'stars', {
          configurable: true,
          enumerable: false,
          get() { return (getMode() === 'hard') ? A.state._stars_hard : A.state._stars_normal; },
          set(v) { (getMode() === 'hard') ? (A.state._stars_hard = v || {}) : (A.state._stars_normal = v || {}); }
        });
      } catch(_) {}
    }
    return (getMode() === 'hard') ? A.state._stars_hard : A.state._stars_normal;
  }

  // Привязка тогла сложности в бургер-меню
  function bindLevelToggle() {
    const t = document.getElementById('levelToggle');
    if (!t) return;
    t.checked = (getMode() === 'hard');
    t.addEventListener('change', () => {
      setMode(t.checked ? 'hard' : 'normal');
      try {
        renderSets(); renderTrainer();
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

  /* ------------------------ Подсказки / тост зоны 2 ------------------------ */
  function renderHints(text) {
    const el = document.getElementById('hintsBody');
    if (!el) return;
    el.textContent = text || ' ';
  }

  // Центр-тост в секции .home-hints (Зона 2)
  function showHintToast(mode, extra){
    const sec = document.querySelector('.home-hints');
    if (!sec) return;
    let t = sec.querySelector('.hints-toast');
    if (t) t.remove();

    t = document.createElement('div');
    t.className = 'hints-toast ' + (mode === 'hard' ? 'hard' : 'normal');

    const uk = getUiLang() === 'uk';
    const title = uk
      ? (mode === 'hard' ? 'Складний режим' : 'Звичайний режим')
      : (mode === 'hard' ? 'Сложный режим' : 'Обычный режим');

    const sub = uk
      ? (mode === 'hard' ? '±0.5 зірки за відповідь' : 'цілі зірки за відповідь')
      : (mode === 'hard' ? '±0.5 звезды за ответ' : 'целые звезды за ответ');

    t.innerHTML = `<div class="mode">${title}</div><div class="sub">${sub}${extra ? ` · ${extra}` : ''}</div>`;
    sec.appendChild(t);

    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220); }, 1600);
  }

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
    return Number(v) || 0; // допускаем 0.5, 1.5, ...
  }

  function renderStarsFor(word) {
    const box = document.querySelector('.trainer-stars');
    if (!box || !word) return;
    const max  = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
    const have = getStars(word.id); // допускаем .5

    let html = '';
    for (let i = 1; i <= max; i++) {
      if (have >= i) html += `<span class="star full" aria-hidden="true">★</span>`;
      else if (have >= (i - 0.5)) html += `<span class="star half" aria-hidden="true">★</span>`;
      else html += `<span class="star" aria-hidden="true">★</span>`;
    }
    box.innerHTML = html;
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

    const answers = document.querySelector('.answers-grid');
    const wordEl  = document.querySelector('.trainer-word');
    const favBtn  = document.getElementById('favBtn');
    const idkBtn  = document.querySelector('.idk-btn');
    const stats   = document.getElementById('dictStats');

    // Сердце (текст ♡/♥)
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
    wordEl.textContent = word.word || word.term || '';
    renderStarsFor(word);

    // Если нужно — показать тост с режимом и текущим значением звёзд
    if (A.__pendingModeToast) {
      const m = getMode();
      const starsMax = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
      const haveNow = getStars(word.id);
      const uk = getUiLang() === 'uk';
      const extra = uk ? `зірок: ${haveNow}/${starsMax}` : `звёзд: ${haveNow}/${starsMax}`;
      showHintToast(m, extra);
      A.__pendingModeToast = false;
    }

    // Ответы
    const opts = buildOptions(word);
    answers.innerHTML = '';

    let penalized = false;
    let solved = false;
    const ADV_DELAY = 350;

    function afterAnswer(correct) {
      // В normal — оставляем как у движка.
      // В hard — принудительно шаг ±0.5.
      if (getMode() === 'hard') {
        try {
          const starsMax = (A.Trainer && typeof A.Trainer.starsMax === 'function') ? A.Trainer.starsMax() : 5;
          const map = ensureStarsByMode();
          const k = starKey(word.id, key);
          const prev = Number((map && map[k]) || 0);
          let next = prev + (correct ? 0.5 : -0.5);
          if (next < 0) next = 0;
          if (next > starsMax) next = starsMax;
          map[k] = next;
          if (typeof A.saveState === 'function') { try { A.saveState(A.state); } catch(_){ } }
        } catch(_){}
      }
      renderStarsFor(word);
      try { A.Stats && A.Stats.recomputeAndRender && A.Stats.recomputeAndRender(); } catch(_){}
    }

    function lockAll(correctId) {
      const btns = answers.querySelectorAll('.answer-btn');
      btns.forEach(btn => {
        btn.disabled = true;
        const id = btn.getAttribute('data-id');
        if (id && String(id) === String(correctId)) {
          btn.classList.add('is-correct');
        } else {
          btn.classList.add('is-dim');
        }
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
        renderHints(' ');
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
    ensureStarsByMode();
    setMode(getMode());          // синхронизируем режим с html/settings
    bindLevelToggle();
    bindFooterNav();
    Router.routeTo('home');
    // Показать текущий режим при первом входе
    A.__pendingModeToast = true;
  }

  A.Home = { mount: mountApp };

  if (document.readyState !== 'loading') mountApp();
  else document.addEventListener('DOMContentLoaded', mountApp);
})();
