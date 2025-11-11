/* ==========================================================
 * view.favorites.js — Экран "Избранное" (1 в 1 как dicts)
 *  - Та же разметка, классы и поведение, что и в view.dicts.js
 *  - Отличия только в источнике данных (Favorites) и ключах
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
      title:   uk ? 'Вибране' : 'Избранное',
      subtitle: uk ? 'Оберіть набір з вибраних слів' : 'Выберите набор из избранных слов',
      preview: uk ? 'Попередній перегляд' : 'Предпросмотр',
      empty:   uk ? 'Наборів не знайдено' : 'Наборы не найдены',
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

  /* ---------------------- data: favorites buckets ---------------------- */
  // Ключ избранного: favorites:<uiLang>:<baseDeckKey>
  function makeFavKey(baseDeckKey){
    const ui = getUiLang();
    return `favorites:${ui}:${baseDeckKey}`;
  }
  function parseFavKey(key){
    const m = String(key||'').match(/^favorites:(ru|uk):(.+)$/i);
    return m ? { uiLang: m[1].toLowerCase(), baseDeckKey: m[2] } : null;
  }
  function langOfKey(deckKey){
    try{ return A.Decks.langOfKey(deckKey); }catch(_){ return 'xx'; }
  }
  function flagForKey(deckKey){
    try{ return A.Decks.flagForKey(deckKey); }catch(_){ return '🏳️'; }
  }
  function resolveNameByKey(deckKey){
    try{ return A.Decks.resolveNameByKey(deckKey); }catch(_){ return String(deckKey||'').split(':').pop(); }
  }

  // Список бакетов избранного по базовым словарям
  function listFavoriteBuckets(){
    const ui = getUiLang();
    // 1) Эталонный способ: агрегат из A.Favorites.listSummary()
    try{
      if (A.Favorites && typeof A.Favorites.listSummary === 'function'){
        const sum = A.Favorites.listSummary() || [];
        return sum.map(x => ({
          baseDeckKey: x.baseDeckKey || x.key || x.deckKey || x.baseKey,
          favoritesKey: `favorites:${ui}:${x.baseDeckKey || x.key || x.deckKey || x.baseKey}`,
          count: Number(x.count || x.size || 0)
        })).filter(x=>x.count>0);
      }
    }catch(_){}
    // 2) Фолбэк: обойти словари и посчитать Favorites.has()
    let keys = [];
    try{
      if (A.Decks && typeof A.Decks.keys === 'function') keys = A.Decks.keys() || [];
      else if (A.Decks && typeof A.Decks.builtinKeys === 'function') keys = A.Decks.builtinKeys() || [];
    }catch(_){ keys = []; }
    const out = [];
    for (const baseDeckKey of keys){
      let count = 0;
      try{
        const deck = (A.Decks && A.Decks.resolveDeckByKey && A.Decks.resolveDeckByKey(baseDeckKey)) || [];
        for (const w of deck){
          try{ if (A.Favorites && A.Favorites.has && A.Favorites.has(baseDeckKey, w.id)) count++; }catch(_){}
        }
      }catch(_){}
      if (count>0) out.push({ baseDeckKey, favoritesKey: `favorites:${ui}:${baseDeckKey}`, count });
    }
    return out;
  })();