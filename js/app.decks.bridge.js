/* ==========================================================
 * app.decks.bridge.js — универсальный «мост» виртуальных словарей
 *  - Делает mistakes:<lang>:<baseKey> и favorites:<lang>:<baseKey> полноценными словарями
 *  - Прокидывает имя/флаг/язык базового словаря
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});
  A.Decks = A.Decks || {};

  // Сохраняем оригинальные резолверы
  const _resolve = A.Decks.resolveDeckByKey ? A.Decks.resolveDeckByKey.bind(A.Decks) : null;
  const _name    = A.Decks.resolveNameByKey ? A.Decks.resolveNameByKey.bind(A.Decks) : null;
  const _flag    = A.Decks.flagForKey       ? A.Decks.flagForKey.bind(A.Decks)       : null;
  const _langOf  = A.Decks.langOfKey        ? A.Decks.langOfKey.bind(A.Decks)        : null;

  // -------- Виртуальные ключи
  function parseVirtualKey(key){
    const s = String(key||'');
    let m = s.match(/^(mistakes):(ru|uk):([a-z]{2}_[a-z]+)$/i);
    if (m) return { kind:'mistakes', trainLang:m[2], baseDeckKey:m[3] };
    m = s.match(/^(favorites):(ru|uk):([a-z]{2}_[a-z]+)$/i);
    if (m) return { kind:'favorites', trainLang:m[2], baseDeckKey:m[3] };
    return null;
  }
  function isVirtual(key){ return !!parseVirtualKey(key); }

  // -------- Резолв набора слов для виртуальных ключей
  function resolveVirtualDeck(key){
    const p = parseVirtualKey(key);
    if (!p) return [];
    const base = p.baseDeckKey;

    // Базовый словарь целиком
    const full = _resolve ? (_resolve(base) || []) : [];

    if (p.kind === 'mistakes'){
      // Если есть Mistakes API — используем его
      if (A.Mistakes && A.Mistakes.resolveDeckForMistakesKey){
        try { return A.Mistakes.resolveDeckForMistakesKey(key) || []; } catch(_){}
      }
      // Фолбэк: если есть getIds — фильтруем по id
      try {
        const ids = new Set((A.Mistakes && A.Mistakes.getIds ? A.Mistakes.getIds(p.trainLang, base) : []).map(String));
        if (ids.size) return full.filter(w => ids.has(String(w.id)));
      } catch(_){}
      return [];
    }

    if (p.kind === 'favorites'){
      // Если есть Favorites API — используем его
      if (A.Favorites && A.Favorites.resolveDeckForFavoritesKey){
        try { return A.Favorites.resolveDeckForFavoritesKey(key) || []; } catch(_){}
      }
      // Фолбэк: фильтруем через Favorites.has(...)
      try {
        const has = A.Favorites && typeof A.Favorites.has === 'function' ? A.Favorites.has.bind(A.Favorites) : null;
        if (!has) return [];
        const out = [];
        for (const w of full){ if (has(base, w.id)) out.push(w); }
        return out;
      } catch(_){}
      return [];
    }

    return [];
  }

  // -------- Переопределяем Decks API

  A.Decks.resolveDeckByKey = function(key){
    try{
      if (isVirtual(key)) return resolveVirtualDeck(key) || [];
    }catch(_){}
    return _resolve ? (_resolve(key) || []) : [];
  };

  A.Decks.resolveNameByKey = function(key){
    try{
      const p = parseVirtualKey(key);
      if (p){
        // Имя как у базового словаря, без префикса «Мои ошибки/Избранное»
        return _name ? _name(p.baseDeckKey) : p.baseDeckKey;
      }
    }catch(_){}
    return _name ? _name(key) : String(key||'');
  };

  A.Decks.flagForKey = function(key){
    try{
      const p = parseVirtualKey(key);
      if (p){
        return _flag ? (_flag(p.baseDeckKey) || '🧩') : '🧩';
      }
    }catch(_){}
    return _flag ? _flag(key) : '🏷️';
  };

  // Язык базового словаря — удобно для группировки на экранах
  A.Decks.langOfMistakesKey = function(key){
    try { const p = parseVirtualKey(key); if (!p || p.kind!=='mistakes') return null; return _langOf ? _langOf(p.baseDeckKey) : null; } catch(_){ return null; }
  };
  A.Decks.langOfFavoritesKey = function(key){
    try { const p = parseVirtualKey(key); if (!p || p.kind!=='favorites') return null; return _langOf ? _langOf(p.baseDeckKey) : null; } catch(_){ return null; }
  };
})();
