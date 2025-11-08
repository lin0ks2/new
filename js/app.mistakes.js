/* ==========================================================
 * app.mistakes.js — Хранилище и API для «Мои ошибки»
 *  - Разделение бакетов по языку тренировки (ru/uk) и исходному словарю
 *  - Ключ словаря ошибок: mistakes:<trainLang>:<baseDeckKey>
 *  - Во время тренировки словаря ошибок добавления НЕ происходят
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});

  function getTrainLang(){
    try{
      const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
      return (String(s).toLowerCase() === 'uk') ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }

  function ensure(){
    A.mistakes = A.mistakes || {};
    A.mistakes.buckets = A.mistakes.buckets || {}; // { trainLang: { baseDeckKey: { ids:Set, meta:Map } } }
  }

  function isMistakesDeckKey(deckKey){
    return typeof deckKey === 'string' && deckKey.startsWith('mistakes:');
  }

  function makeKey(trainLang, baseDeckKey){
    return `mistakes:${trainLang}:${baseDeckKey}`;
  }

  function parseKey(key){
    if (!isMistakesDeckKey(key)) return null;
    const parts = String(key).split(':');
    if (parts.length < 3) return null;
    const trainLang = parts[1];
    const baseDeckKey = parts.slice(2).join(':');
    return { trainLang, baseDeckKey };
  }

  function _bucket(trainLang, baseDeckKey){
    ensure();
    const lang = trainLang || getTrainLang();
    A.mistakes.buckets[lang] = A.mistakes.buckets[lang] || {};
    const byLang = A.mistakes.buckets[lang];
    byLang[baseDeckKey] = byLang[baseDeckKey] || { ids: new Set(), meta: new Map() };
    return byLang[baseDeckKey];
  }

  function push(baseDeckKey, wordId, opts){
    try{
      const trainLang = (opts && opts.trainLang) || getTrainLang();
      if (!baseDeckKey || wordId == null) return;

      // ❗ Не копим ошибки во время тренировки "словарей ошибок"
      if (isMistakesDeckKey(baseDeckKey)) return;

      const b = _bucket(trainLang, baseDeckKey);
      const id = String(wordId);
      b.ids.add(id);
      const cur = b.meta.get(id) || { count:0, last:0 };
      cur.count = (cur.count|0) + 1;
      cur.last  = Date.now();
      b.meta.set(id, cur);

      if (typeof A.saveMistakes === 'function'){
        try { A.saveMistakes(A.mistakes); } catch(_){}
      }
    }catch(_){}
  }

  function removeDeck(trainLang, baseDeckKey){
    try{
      ensure();
      const lang = trainLang || getTrainLang();
      if (A.mistakes.buckets[lang] && A.mistakes.buckets[lang][baseDeckKey]){
        delete A.mistakes.buckets[lang][baseDeckKey];
        if (typeof A.saveMistakes === 'function'){
          try { A.saveMistakes(A.mistakes); } catch(_){}
        }
      }
    }catch(_){}
  }

  function listSummary(){
    ensure();
    const out = [];
    for (const lang of Object.keys(A.mistakes.buckets)){
      const byLang = A.mistakes.buckets[lang] || {};
      for (const baseKey of Object.keys(byLang)){
        const b = byLang[baseKey];
        out.push({
          trainLang: lang,
          baseKey,
          mistakesKey: makeKey(lang, baseKey),
          count: (b.ids ? b.ids.size : 0)
        });
      }
    }
    return out.sort((a,b)=> (a.trainLang.localeCompare(b.trainLang) || a.baseKey.localeCompare(b.baseKey)));
  }

  function getIds(trainLang, baseDeckKey){
    const b = _bucket(trainLang, baseDeckKey);
    return Array.from(b.ids || []);
  }

  function resolveDeckForMistakesKey(mKey){
    const parsed = parseKey(mKey);
    if (!parsed) return [];
    const { trainLang, baseDeckKey } = parsed;
    const full = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(baseDeckKey) || []) : [];
    if (!full.length) return [];
    const ids = new Set(getIds(trainLang, baseDeckKey).map(String));
    return full.filter(w => ids.has(String(w.id)));
  }

  A.Mistakes = Object.assign({}, A.Mistakes || {}, {
    makeKey: makeKey,
    parseKey: parseKey,
    listSummary,
    push,
    getIds,
    removeDeck,
    resolveDeckForMistakesKey,
    isMistakesDeckKey
  });
})();