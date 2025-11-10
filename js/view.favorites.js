/* ==========================================================
 * view.favorites.js — Экран "Избранное"
 *  - Рисует список избранных слов, сгруппированных по словарям
 *  - "Тренироваться" доступно, если ≥4 слова
 *  - Виртуальный словарь с ключом 'favorites'
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});

  function getUiLang() {
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || null;
    const attr = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const v = (s || attr || 'ru').toLowerCase();
    return (v === 'uk') ? 'uk' : 'ru';
  }
  function tWord(w) {
    const lang = getUiLang();
    if (!w) return '';
    return (lang === 'uk'
      ? (w.uk || w.translation_uk || w.trans_uk || w.ua)
      : (w.ru || w.translation_ru || w.trans_ru))
      || w.translation || w.trans || w.meaning || '';
  }
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
    return key || (getUiLang()==='uk' ? 'Словник' : 'Словарь');
  }

  // Собираем настоящие объекты слов из пар {deckKey, id}
  function buildFavoriteWords() {
    const out = [];
    try {
      const byDeck = A.Favorites.byDeck(); // { deckKey: [id...] }
      const dk = Object.keys(byDeck);
      for (let i = 0; i < dk.length; i++) {
        const key = dk[i];
        const ids = byDeck[key];
        const deck = (A.Decks && typeof A.Decks.resolveDeckByKey === 'function')
          ? (A.Decks.resolveDeckByKey(key) || [])
          : [];
        const map = new Map(deck.map(w => [String(w.id), w]));
        ids.forEach(id => {
          const w = map.get(String(id));
          if (w) out.push({ ...w, __fav_from: key }); // пометим источник
        });
      }
    } catch (_) {}
    return out;
  }

  // Виртуальная колода favorites для тренера
  function ensureFavoritesDeckRegistered(words) {
    A.Decks = A.Decks || {};
    // Храним снимок слов для текущего запуска тренировки
    A.__favoritesDeckSnapshot = words.slice();

    // Оборачиваем resolveDeckByKey, не ломая оригинал
    if (!A.Decks.__resolveDeckByKeyOriginal) {
      A.Decks.__resolveDeckByKeyOriginal = A.Decks.resolveDeckByKey || function(){ return []; };
      A.Decks.resolveDeckByKey = function (key) {
        if (key === 'favorites' || key === 'fav') {
          return (A.__favoritesDeckSnapshot || []);
        }
        return A.Decks.__resolveDeckByKeyOriginal(key);
      };
    }
    // Флаг/функция для узнавания спец-колоды
    A.Decks.isFavoritesDeckKey = function (key) {
      return (key === 'favorites' || key === 'fav');
    };
    // Флаг (например для флага 🇩🇪 можно вернуть ⭐)
    A.Decks.flagForKey = (function (orig) {
      return function (key) {
        if (A.Decks.isFavoritesDeckKey && A.Decks.isFavoritesDeckKey(key)) return '⭐';
        return orig ? orig(key) : '🇩🇪';
      };
    })(A.Decks.flagForKey);
  }

  function mount() {
    const app = document.getElementById('app');
    if (!app) return;

    const uk = (getUiLang() === 'uk');
    const title = uk ? 'Вибране' : 'Избранное';

    // Снимок данных
    const words = buildFavoriteWords();
    // Группировка по словарям-источникам
    const byDeck = {};
    words.forEach(w => {
      const k = w.__fav_from || 'unknown';
      (byDeck[k] = byDeck[k] || []).push(w);
    });

    // Пустой экран — как на home
    if (!words.length) {
      app.innerHTML = `
        <div class="home">
          <section class="card home-sets">
            <header class="sets-header">
              <span class="flag" aria-hidden="true">⭐</span>
              <h2 class="sets-title">${title}</h2>
            </header>
            <p style="margin:8px 0; opacity:.7;">${uk ? 'Немає обраних слів.' : 'Нет избранных слов.'}</p>
          </section>
        </div>`;
      return;
    }

    // Соберём таблицы как в «Мои ошибки»
    let html = `
      <div class="home">
        <section class="card">
          <h3 style="margin:0 0 6px;">${title}</h3>
          <div class="fav-groups">`;

    Object.keys(byDeck).forEach((deckKey) => {
      const list = byDeck[deckKey];
      const header = resolveDeckTitle(deckKey);
      html += `
        <div class="fav-group">
          <h4 class="fav-group__title" style="margin:12px 0 6px;">${header}</h4>
          <div class="table-like">`;
      list.forEach(w => {
        html += `
          <div class="row">
            <div class="cell word">${w.word || w.term || ''}</div>
            <div class="cell trans">${tWord(w)}</div>
          </div>`;
      });
      html += `</div></div>`;
    });

    // Кнопка "Тренироваться" доступна, если ≥4 слова
    const trainEnabled = words.length >= 4;
    const trainLabel = uk ? 'Тренувати' : 'Тренироваться';

    html += `
          <div style="margin-top:14px;">
            <button class="btn ${trainEnabled ? '' : 'is-disabled'}" id="favTrainBtn" ${trainEnabled ? '' : 'disabled'}>${trainLabel}</button>
          </div>
        </section>
      </div>`;

    app.innerHTML = html;

    // Кнопка запуска тренировки «Избранного»
    const btn = document.getElementById('favTrainBtn');
    if (btn && trainEnabled) {
      btn.addEventListener('click', () => {
        // Регистрируем виртуальную колоду и запускаем как обычный словарь
        ensureFavoritesDeckRegistered(words);
        try {
          A.settings = A.settings || {};
          A.settings.lastDeckKey = 'favorites';
          A.saveSettings && A.saveSettings(A.settings);
        } catch (_) {}
        try { A.Router && A.Router.routeTo && A.Router.routeTo('home'); } catch(_) {}
      });
    }
  }

  // пересобираем экран по событию
  function bindBus() {
    try {
      document.addEventListener('favorites:changed', () => {
        if (A.Router && A.Router.current === 'fav') mount();
      });
    } catch (_) {}
  }

  A.ViewFavorites = { mount };
  bindBus();
})();
