/* ==========================================================
 * Project: MOYAMOVA
 * File: app.favorites.js
 * Purpose: Избранное/закладки
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  var App = window.App || (window.App = {});
  var PROG_KEY = 'favorites.progress.v1';

  function uiLang(){ return (App.settings && App.settings.lang) || 'ru'; }
  function dictFilterLang(){
    return (App.settings && App.settings.dictsLangFilter) || null;
  }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  function loadProg(){ try{ var raw = localStorage.getItem(PROG_KEY); return raw? JSON.parse(raw): {}; }catch(e){ return {}; } }
  function saveProg(db){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(db)); }catch(e){} }
  function progKey(dictKey, id){ return dictKey + '#' + String(id); }
  function starsMax(){ try{ return App.Trainer.starsMax(); }catch(e){ return 5; } }

  function pget(ui, dictKey, id){ var db=loadProg(); var L=db[ui]||{}; var k=progKey(dictKey,id); return (L[k] && L[k].stars)|0 || 0; }
  function pset(ui, dictKey, id, val){
    var db=loadProg(); if(!db[ui]) db[ui] = {};
    var k=progKey(dictKey,id); var cur=db[ui][k] || {stars:0, ts:0};
    var mx=starsMax(); cur.stars = Math.max(0, Math.min(val|0, mx)); cur.ts = Date.now ? Date.now() : (+new Date());
    db[ui][k]=cur; saveProg(db); return cur.stars;
  }
  function pinc(ui, dictKey, id, d){ return pset(ui, dictKey, id, pget(ui, dictKey, id) + (d|0)); }
  function pled(ui, dictKey, id){ return pget(ui, dictKey, id) >= starsMax(); }

  function keyLang(key){
    try{ return (App.Decks && App.Decks.langOfKey) ? (App.Decks.langOfKey(key) || null) : null; }catch(e){ return null; }
  }
  function resolveDeck(key){
    try{ return (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key) || []) : []; }catch(e){ return []; }
  }

  function aliveWord(dictKey, id){
    var deck = resolveDeck(dictKey); if (!deck || !deck.length) return null;
    id = String(id);
    for (var i=0;i<deck.length;i++){ if (String(deck[i].id) === id) return deck[i]; }
    return null;
  }

  App.Favorites = {
    progress: {
      getStars: function(dictKey,id){ return pget(uiLang(), dictKey, id); },
      setStars: function(dictKey,id,val){ return pset(uiLang(), dictKey, id, val); },
      incStar:  function(dictKey,id,delta){ return pinc(uiLang(), dictKey, id, delta||1); },
      reset:    function(dictKey,id){ return pset(uiLang(), dictKey, id, 0); },
      isLearned:function(dictKey,id){ return pled(uiLang(), dictKey, id); },
      clearAllForUi: function(){
        var ui = uiLang(); var db=loadProg(); if (db[ui]) { db[ui] = {}; saveProg(db); }
      }
    },

    list: function(){
      try{
        App.migrateFavoritesToV2 && App.migrateFavoritesToV2();
        var st = App.state || {}; var v2 = st.favorites_v2 || {};
        var flg = dictFilterLang();
        var out = [];
        Object.keys(v2).forEach(function(dictKey){
          if (flg && keyLang(dictKey) !== flg) return;
          var map = v2[dictKey] || {};
          Object.keys(map).forEach(function(id){
            if (!map[id]) return;
            var w = aliveWord(dictKey, id);
            if (!w) return;
            out.push({ id: String(id), dictKey: dictKey, ts: 0 });
          });
        });
        return out;
      }catch(e){ return []; }
    },

    count: function(){
      var arr = App.Favorites.list() || [];
      return arr.length;
    },

    deck: function(){
      var arr = App.Favorites.list() || [], out=[];
      for (var i=0;i<arr.length;i++){
        var e = arr[i]; var w = aliveWord(e.dictKey, e.id);
        if (!w) continue;
        var ww = Object.assign({}, w);
        ww._favoriteSourceKey = e.dictKey;
        out.push(ww);
      }
      return out;
    },

    clearActive: function(){
      try{
        if (App.clearFavoritesForLang) App.clearFavoritesForLang();
      }catch(e){}
    }
  };
})();

(function(){
  const App = window.App || (window.App = {});

  function _langOfKey(k){
    try{
      const m = String(k||'').match(/^([a-z]{2})_/i);
      return m ? m[1].toLowerCase() : null;
    }catch(e){ return null; }
  }

  function _activeDictLang(){
    if (App.settings && App.settings.dictsLangFilter) return App.settings.dictsLangFilter;
    if (App.settings && App.settings.studyLang) return App.settings.studyLang;
    if (App.settings && App.settings.lang) return App.settings.lang;
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    return _langOfKey(key) || 'de';
  }

  App.clearFavoritesForLang = function(dictLang){
    try{
      const lang = dictLang || _activeDictLang();
      const st = (App.state && App.state.favorites_v2) ? App.state.favorites_v2 : null;
      if (!st) return;
      Object.keys(st).forEach(function(sourceKey){
        if (_langOfKey(sourceKey) === lang) delete st[sourceKey];
      });
      App.saveState && App.saveState();
    }catch(e){}
  };

  App.clearFavoritesAll = App.clearFavoritesAll || function(){
    try { if (App.state) App.state.favorites_v2 = {}; App.saveState && App.saveState(); } catch(e){}
  };
})();

(function(){
  const App = window.App || (window.App = {});

  function _langOfKey(k){
    try{
      const m = String(k||'').match(/^([a-z]{2})_/i);
      return m ? m[1].toLowerCase() : null;
    }catch(e){ return null; }
  }

  function _activeDictLang(){
    if (App.settings && App.settings.dictsLangFilter) return App.settings.dictsLangFilter;
    if (App.settings && App.settings.studyLang) return App.settings.studyLang;
    if (App.settings && App.settings.lang) return App.settings.lang;
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    return _langOfKey(key) || 'de';
  }

  App.clearFavoritesForLang = function(dictLang){
    try{
      const lang = dictLang || _activeDictLang();
      const st = (App.state && App.state.favorites_v2) ? App.state.favorites_v2 : null;
      if (!st) return;
      Object.keys(st).forEach(function(sourceKey){
        if (_langOfKey(sourceKey) === lang) delete st[sourceKey];
      });
      App.saveState && App.saveState();
    }catch(e){}
  };

  App.clearFavoritesAll = App.clearFavoritesAll || function(){
    try { if (App.state) App.state.favorites_v2 = {}; App.saveState && App.saveState(); } catch(e){}
  };
})();

/* === Favorites shim for UI/Trainer === */
(function(){
  var A = window.App || (window.App = {});
  A.Favorites = A.Favorites || {};

  // .has(dictKey, wordId) → App.isFavorite(...)
  if (typeof A.Favorites.has !== 'function') {
    A.Favorites.has = function(dictKey, wordId){
      try { return !!(A.isFavorite && A.isFavorite(dictKey, wordId)); } catch(_){ return false; }
    };
  }

  // .toggle(dictKey, wordId) → App.toggleFavorite(...)
  if (typeof A.Favorites.toggle !== 'function') {
    A.Favorites.toggle = function(dictKey, wordId){
      try { A.toggleFavorite && A.toggleFavorite(dictKey, wordId); } catch(_){}
    };
  }

  // Для моста и удаления пачкой (fallback): получить список избранных id по базовому словарю
  if (typeof A.Favorites.getIds !== 'function') {
    A.Favorites.getIds = function(trainLang, baseDeckKey){
      try {
        var full = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(baseDeckKey) || []) : [];
        var out = [];
        for (var i=0;i<full.length;i++){
          var w = full[i];
          if (A.Favorites.has(baseDeckKey, w.id)) out.push(String(w.id));
        }
        return out;
      } catch(_){ return []; }
    };
  }
})();



/* === Extended Favorites API (summary, clear per deck, resolve virtual key) === */
(function(){
  'use strict';
  var A = window.App || (window.App = {});
  A.Favorites = A.Favorites || {};

  function _getTrainLang(){
    try{
      var s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
      s = String(s).toLowerCase(); return (s === 'uk') ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }

  // Build summary by base decks: [{ baseDeckKey, count }]
  if (typeof A.Favorites.listSummary !== 'function'){
    A.Favorites.listSummary = function(){
      try{
        var out = [];
        var keys = (A.Decks && A.Decks.builtinKeys) ? (A.Decks.builtinKeys() || []) : [];
        for (var i=0;i<keys.length;i++){
          var k = keys[i];
          var deck = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(k) || []) : [];
          var cnt = 0;
          for (var j=0;j<deck.length;j++){
            var w = deck[j];
            if (A.Favorites.has && A.Favorites.has(k, w.id)) cnt++;
          }
          if (cnt>0) out.push({ baseDeckKey:k, count:cnt });
        }
        return out;
      }catch(_){ return []; }
    };
  }

  // Clear favorites for one base deck
  if (typeof A.Favorites.clearForDeck !== 'function'){
    A.Favorites.clearForDeck = function(baseDeckKey){
      try{
        var st = A.state || (A.state = {});
        st.favorites_v2 = st.favorites_v2 || {};
        if (st.favorites_v2[baseDeckKey]) {
          delete st.favorites_v2[baseDeckKey];
          if (A.saveState) try{ A.saveState(); }catch(_){}
          try{ document.dispatchEvent(new CustomEvent('favorites:changed')); }catch(_){}
        }
      }catch(_){}
    };
  }

  // Parse favorites virtual key: favorites:<trainLang>:<baseDeckKey>
  function _parseFavoritesKey(key){
    var m = String(key||'').match(/^favorites:(ru|uk):([\w.-]+)$/i);
    return m ? { kind:'favorites', trainLang:m[1].toLowerCase(), baseDeckKey:m[2] } : null;
  }

  // Resolve deck array for a favorites virtual key
  if (typeof A.Favorites.resolveDeckForFavoritesKey !== 'function'){
    A.Favorites.resolveDeckForFavoritesKey = function(key){
      try{
        var p = _parseFavoritesKey(key);
        if (!p) return [];
        var full = (A.Decks && A.Decks.resolveDeckByKey) ? (A.Decks.resolveDeckByKey(p.baseDeckKey) || []) : [];
        var out = [];
        for (var i=0;i<full.length;i++){
          var w = full[i];
          if (A.Favorites.has && A.Favorites.has(p.baseDeckKey, w.id)) out.push(w);
        }
        return out;
      }catch(_){ return []; }
    };
  }

  if (typeof A.Favorites.isFavoritesDeckKey !== 'function'){
    A.Favorites.isFavoritesDeckKey = function(key){ return /^favorites:(ru|uk):/i.test(String(key||'')); };
  }

})();

/* ====================== End of file =======================
 * File: app.favorites.js • Version: 1.0 • 2025-10-19
*/
