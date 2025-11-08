/* ==========================================================
 * app.decks.bridge.js — «мост» для словарей ошибок
 *  - Делает mistakes:<lang>:<baseKey> полноценными словарями
 * ========================================================== */
(function(){
  'use strict';
  const A = (window.App = window.App || {});
  A.Decks = A.Decks || {};

  const _resolve = A.Decks.resolveDeckByKey ? A.Decks.resolveDeckByKey.bind(A.Decks) : null;
  const _name    = A.Decks.resolveNameByKey ? A.Decks.resolveNameByKey.bind(A.Decks) : null;
  const _flag    = A.Decks.flagForKey       ? A.Decks.flagForKey.bind(A.Decks)       : null;
  const _langOf  = A.Decks.langOfKey        ? A.Decks.langOfKey.bind(A.Decks)        : null;

  A.Decks.resolveDeckByKey = function(key){
    try{
      if (A.Mistakes && A.Mistakes.isMistakesDeckKey && A.Mistakes.isMistakesDeckKey(key)){
        return A.Mistakes.resolveDeckForMistakesKey(key) || [];
      }
    }catch(_){}
    return _resolve ? (_resolve(key) || []) : [];
  };

  A.Decks.resolveNameByKey = function(key){
    try{
      if (A.Mistakes && A.Mistakes.isMistakesDeckKey && A.Mistakes.isMistakesDeckKey(key)){
        const p = A.Mistakes.parseKey(key);
        const base = p && p.baseDeckKey;
        // ❗ Возвращаем только имя базового словаря — без префиксов «Мои ошибки — …» и без (RU/UK)
        const baseName = _name ? _name(base) : (base || '');
        return baseName || (key || '');
      }
    }catch(_){}
    return _name ? _name(key) : (key || '');
  };

  A.Decks.flagForKey = function(key){
    try{
      if (A.Mistakes && A.Mistakes.isMistakesDeckKey && A.Mistakes.isMistakesDeckKey(key)){
        const p = A.Mistakes.parseKey(key);
        const base = p && p.baseDeckKey;
        return _flag ? (_flag(base) || '🧩') : '🧩';
      }
    }catch(_){}
    return _flag ? _flag(key) : '🏷️';
  };

  // Пробросим язык исходного словаря для сортировки флагами в списке ошибок
  A.Decks.langOfMistakesKey = function(key){
    try {
      const p = A.Mistakes && A.Mistakes.parseKey && A.Mistakes.parseKey(key);
      const base = p && p.baseDeckKey;
      return _langOf ? _langOf(base) : null;
    } catch(_){ return null; }
  };
})();
