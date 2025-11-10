/* ==========================================================
 * view.favorites.js — Виртуальный словарь «Избранное»
 *  - Хранилище A.Favorites (если нет) на базе App.state.favorites
 *  - Патч A.Decks: fav:<deckKey> как виртуальная колода
 *  - Экран: группировка по словарям, предпросмотр, запуск тренера
 *  - Локализация RU/UK, реагирует на смену языка
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});
  const STORE_KEY = 'favorites';
  const VKEY_PREFIX = 'fav:'; // виртуальный ключ колоды

  /* ------------------------ Хранилище избранного ------------------------ */
  function ensureState() {
    A.state = A.state || {};
    if (!A.state[STORE_KEY]) A.state[STORE_KEY] = {};
    return A.state[STORE_KEY];
  }
  function favKey(deckKey, id) { return `${deckKey}:${id}`; }

  const Store = {
    has(deckKey, id) {
      try { return !!ensureState()[favKey(deckKey, id)]; } catch (_) { return false; }
    },
    toggle(deckKey, id) {
      const s = ensureState();
      const k = favKey(deckKey, id);
      if (s[k]) delete s[k];
      else s[k] = 1;
      try { A.saveState && A.saveState(A.state); } catch (_) {}
      return !!s[k];
    },
    entries() {
      const s = ensureState();
      return Object.keys(s).map(k => {
        const idx = k.lastIndexOf(':');
        return { key: k.slice(0, idx), id: k.slice(idx + 1) };
      });
    },
    idsByDeck(deckKey) {
      const s = ensureState();
      const ids = [];
      for (const k in s) {
        if (k.startsWith(deckKey + ':')) ids.push(k.split(':')[1]);
      }
      return ids;
    },
    clearDeck(deckKey) {
      const s = ensureState();
      Object.keys(s).forEach(k => { if (k.startsWith(deckKey + ':')) delete s[k]; });
      try { A.saveState && A.saveState(A.state); } catch (_) {}
    }
  };

  if (!A.Favorites) A.Favorites = Store;

  /* ------------------------------ Утилиты ------------------------------ */
  function getUiLang() {
    try {
      const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || null;
      const attr = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      const v = (s || attr || 'ru').toLowerCase();
      return (v === 'uk') ? 'uk' : 'ru';
    } catch (_) { return 'ru'; }
  }
  function tWord(w) {
    const lang = getUiLang();
    if (!w) return '';
    return (lang === 'uk'
      ? (w.uk || w.translation_uk || w.trans_uk || w.ua)
      : (w.ru || w.translation_ru || w.trans_ru))
      || w.translation || w.trans || w.meaning || '';
  }
  function resolveDeckTitle(deckKey) {
    const lang = getUiLang();
    try {
      if (A.Decks && typeof A.Decks.resolveNameByKeyLang === 'function')
        return A.Decks.resolveNameByKeyLang(deckKey, lang);
      if (A.Decks && typeof A.Decks.resolveNameByKey === 'function') {
        const n = A.Decks.resolveNameByKey(deckKey);
        if (n && typeof n === 'object') {
          return (lang === 'uk') ? (n.uk || n.name_uk || n.title_uk || n.name || n.title)
                                 : (n.ru || n.name_ru || n.title_ru || n.name || n.title);
        }
        if (typeof n === 'string') return n;
      }
      if (A.Dicts && A.Dicts[deckKey]) {
        const d = A.Dicts[deckKey];
        return (lang === 'uk') ? (d.name_uk || d.title_uk || d.uk || d.name || d.title)
                               : (d.name_ru || d.title_ru || d.ru || d.name || d.title);
      }
    } catch (_) {}
    return (getUiLang() === 'uk') ? 'Словник' : 'Словарь';
  }
  function flagForKey(deckKey) {
    try { return (A.Decks && A.Decks.flagForKey) ? (A.Decks.flagForKey(deckKey) || '★') : '★'; }
    catch(_) { return '★'; }
  }

  /* -------------------- Мост виртуальной колоды fav:* ------------------- */
  (function patchDecksForFavorites(){
    if (!A.Decks) A.Decks = {};
    if (A.__favPatched) return; // патчим один раз

    const origResolve = A.Decks.resolveDeckByKey ? A.Decks.resolveDeckByKey.bind(A.Decks) : null;
    const origName    = A.Decks.resolveNameByKey ? A.Decks.resolveNameByKey.bind(A.Decks) : null;
    const origFlag    = A.Decks.flagForKey ? A.Decks.flagForKey.bind(A.Decks) : null;

    function isFavKey(key){ return typeof key === 'string' && key.startsWith(VKEY_PREFIX); }
    function baseKey(key){ return key.slice(VKEY_PREFIX.length); }

    A.Decks.resolveDeckByKey = function(key){
      if (isFavKey(key)) {
        const base = baseKey(key);
        const baseDeck = origResolve ? (origResolve(base) || []) : ((A.Dicts && A.Dicts[base]) || []);
        const ids = A.Favorites.idsByDeck(base).map(String);
        if (!ids.length) return [];
        return baseDeck.filter(w => ids.includes(String(w && w.id)));
      }
      return origResolve ? origResolve(key) : [];
    };

    A.Decks.resolveNameByKey = function(key){
      if (isFavKey(key)) {
        const base = baseKey(key);
        const title = resolveDeckTitle(base);
        return {
          ru: `Избранное — ${title}`,
          uk: `Вибране — ${title}`,
          name: `Favorites — ${title}`
        };
      }
      return origName ? origName(key) : (resolveDeckTitle(key) || key);
    };

    A.Decks.flagForKey = function(key){
      if (isFavKey(key)) return '★';
      return origFlag ? origFlag(key) : '★';
    };

    A.FavoritesBridge = {
      isFavoritesDeckKey: isFavKey,
      baseDeckKey: baseKey
    };

    A.__favPatched = true;
  })();

  /* ------------------------------- Экран ------------------------------- */
  function i18n() {
    const uk = getUiLang() === 'uk';
    return uk
      ? {
          title: 'Вибране',
          train: 'Тренувати',
          emptyTitle: 'Вибране',
          emptyText: 'Поки тут порожньо. Додавайте слова натискаючи ♥ у тренері.',
          remove: 'Прибрати з вибраного'
        }
      : {
          title: 'Избранное',
          train: 'Тренировать',
          emptyTitle: 'Избранное',
          emptyText: 'Пока здесь пусто. Добавляйте слова нажимая ♥ в тренере.',
          remove: 'Убрать из избранного'
        };
  }

  function mount() {
    const app = document.getElementById('app');
    if (!app) return;

    const T = i18n();
    const entries = (A.Favorites && typeof A.Favorites.entries === 'function')
      ? A.Favorites.entries() : [];

    // Пустая страница — визуально как в home.js (карточка + заголовок)
    if (!entries.length) {
      app.innerHTML = `
        <div class="home">
          <section class="card favorites-view">
            <header class="sets-header">
              <span class="flag" aria-hidden="true">★</span>
              <h2 class="sets-title">${T.emptyTitle}</h2>
            </header>
            <p style="opacity:.7;margin:.25rem 0 0;">${T.emptyText}</p>
          </section>
        </div>`;
      return;
    }

    // Группировка по словарям
    const byDeck = {};
    entries.forEach(e => { (byDeck[e.key] = byDeck[e.key] || []).push(String(e.id)); });

    // Сортировка по локализованному названию словаря (как «Мои ошибки»)
    const deckKeys = Object.keys(byDeck).sort((a,b) => {
      const ta = resolveDeckTitle(a).toLowerCase();
      const tb = resolveDeckTitle(b).toLowerCase();
      return ta.localeCompare(tb);
    });

    // Разметка экрана (повторяем структуру «Мои ошибки»)
    let html = `
      <div class="home">
        <section class="card favorites-view">
          <header class="sets-header">
            <span class="flag" aria-hidden="true">★</span>
            <h2 class="sets-title">${T.title}</h2>
          </header>
          <div class="mist-root" id="favRoot"></div>
        </section>
      </div>`;
    app.innerHTML = html;

    const root = document.getElementById('favRoot');

    const frag = document.createDocumentFragment();
    deckKeys.forEach(deckKey => {
      const ids = byDeck[deckKey];
      const deck = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function')
        ? (A.Decks.resolveDeckByKey(deckKey) || [])
        : [];

      // предпросмотр (как в «Мои ошибки»: несколько терминов/переводов)
      const previewWords = [];
      for (let i = 0; i < deck.length && previewWords.length < 6; i++) {
        const w = deck[i];
        if (ids.includes(String(w.id))) previewWords.push(w);
      }

      const group = document.createElement('div');
      group.className = 'mist-group'; // тот же класс, чтобы стили совпали
      group.innerHTML = `
        <div class="mist-group__head">
          <div class="mist-group__title">
            <span class="flag" aria-hidden="true">${flagForKey(deckKey)}</span>
            <span class="txt">${resolveDeckTitle(deckKey)}</span>
            <span class="count">(${ids.length})</span>
          </div>
          <div class="mist-group__actions">
            <button class="primary-btn mist-train" data-deck="${deckKey}">${T.train}</button>
          </div>
        </div>
        <div class="mist-rows">
          ${previewWords.map(w => `
            <div class="mist-row" data-id="${String(w.id)}" data-deck="${deckKey}">
              <div class="mist-term">${w.word || w.term || ''}</div>
              <div class="mist-trans">${tWord(w)}</div>
              <button class="mist-del" title="${T.remove}" aria-label="${T.remove}" data-del="${String(w.id)}">♥</button>
            </div>`).join('')}
        </div>
      `;
      frag.appendChild(group);
    });

    root.innerHTML = '';
    root.appendChild(frag);

    // Запуск тренера для группы (виртуальная колода fav:<deckKey>)
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.mist-train');
      if (!btn) return;
      const baseDeckKey = btn.getAttribute('data-deck');
      const vKey = VKEY_PREFIX + baseDeckKey;

      try {
        // запомнить выбранную виртуальную колоду
        A.settings = A.settings || {};
        A.settings.lastDeckKey = vKey;
        A.saveSettings && A.saveSettings(A.settings);
        // сбросить индекс сета, чтобы слайс собрался заново
        if (A.Trainer && typeof A.Trainer.setBatchIndex === 'function') {
          A.Trainer.setBatchIndex(0, vKey);
        }
      } catch(_){}

      try { A.Router && A.Router.routeTo && A.Router.routeTo('home'); } catch(_){}
    });

    // Удаление из избранного одной строкой
    root.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      const id  = del.getAttribute('data-del');
      const dk  = del.closest('.mist-row')?.getAttribute('data-deck');
      if (!dk || !id) return;
      try { A.Favorites.toggle(dk, id); } catch(_){}
      // перерисовать экран
      mount();
    });
  }

  // Экспорт экрана
  A.ViewFavorites = A.ViewFavorites || { mount };

  // Перерисовать при смене языка, если мы на экране избранного
  document.addEventListener('lexitron:ui-lang-changed', () => {
    try {
      if (A.Router && A.Router.current === 'fav' && A.ViewFavorites && A.ViewFavorites.mount) {
        A.ViewFavorites.mount();
      }
    } catch(_) {}
  });
})();
