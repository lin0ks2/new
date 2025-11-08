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

/* ====================== End of file =======================
 * File: app.favorites.js • Version: 1.0 • 2025-10-19
*/
