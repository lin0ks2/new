/* ==========================================================
 * Project: MOYAMOVA
 * File: app.core.js
 * Purpose: Инициализация и глобальные константы
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  const App = window.App = (window.App||{});
  App.APP_VER = '1.0';

  const LS_SETTINGS = 'k_settings_v1_3_1';
  const LS_STATE    = 'k_state_v1_3_1';
  const LS_DICTS    = 'k_dicts_v1_3_1';

  const I18N_FALLBACK = window.I18N;

  App.settings = loadSettings();

try{
  var __lang = (App.settings && (App.settings.uiLang || App.settings.lang)) || 'ru';
  document.documentElement.dataset.lang = __lang;
  document.documentElement.setAttribute('lang', __lang);
}catch(_){}
  
  App.state = loadState() || {
    index:0,lastIndex:-1,favorites:{},stars:{},successes:{},
    lastShownWordId:null, totals:{shown:0,errors:0}, lastSeen:{}
  };
App._deckKey = function(){ try{ return (App.dictRegistry && App.dictRegistry.activeKey) || ''; }catch(_){ return ''; } };
App.starKey = function(wid, dk){
  dk = dk || App._deckKey();
  return (dk ? (String(dk)+':') : '') + String(wid);
};

  App.dictRegistry = loadDictRegistrySafe();
  try{
    if (!App.dictRegistry || typeof App.dictRegistry !== 'object') App.dictRegistry = { activeKey:null, user:{}, lastByLang:{} };
    if (!App.dictRegistry.user || typeof App.dictRegistry.user !== 'object') App.dictRegistry.user = {};
    if (!App.dictRegistry.lastByLang || typeof App.dictRegistry.lastByLang !== 'object') App.dictRegistry.lastByLang = {};
  }catch(_){}

  (function migrateSets(){
    let ss = 50;
    try { ss = Number(App.state.setSize); } catch(e){}
    if (!Number.isFinite(ss) || ss < 2) ss = 50;
    App.state.setSize = ss;

    if (!App.state.setByDeck || typeof App.state.setByDeck !== 'object'){
      App.state.setByDeck = {};
    }
  })();

  App.i18n = function(lang){
    try{
      lang = (lang || (App.settings && (App.settings.uiLang || App.settings.lang)) || 'ru').toLowerCase();
      const base = (I18N_FALLBACK && I18N_FALLBACK[lang]) ? I18N_FALLBACK[lang] : (I18N_FALLBACK && I18N_FALLBACK.uk) || {};
      return base;
    }catch(_){ return (I18N_FALLBACK && I18N_FALLBACK.uk) || {}; }
  };

App.applyI18nTitles = function(root){
  try{
    var lang = (App && App.settings && (App.settings.uiLang || App.settings.lang)) ||
               document.documentElement.getAttribute('lang') || 'ru';
    var T = (window.I18N && window.I18N[lang]) || (App && App.i18n && App.i18n[lang]) || null;

    (root || document).querySelectorAll('[data-title-key]').forEach(function(el){
      try{
        var key = el.getAttribute('data-title-key');
        if (!key) return;
        var pretty = el.getAttribute('data-title-pretty') || '';
        var val = (T && T[key]) || el.getAttribute('data-title-fallback') || '';
        if (pretty) val = (pretty === 'auto') ? (val || '') : pretty;
        if (val){
          el.setAttribute('title', val);
          el.setAttribute('aria-label', val); // keep a11y in sync to avoid mixed tooltips
        }
      }catch(_){}
    });
  }catch(_){}
};;

try{
  if (document.readyState !== 'loading') { App.applyI18nTitles(); }
  else { document.addEventListener('DOMContentLoaded', function(){ try{ App.applyI18nTitles(); }catch(_){} }); }
}catch(_){}
;

  try{
    if (document.readyState !== 'loading') { App.applyI18nTitles(); }
    else { document.addEventListener('DOMContentLoaded', function(){ App.applyI18nTitles(); }, { once: true }); }
  }catch(_){}

  window.addEventListener('storage', function(){ App.applyI18nTitles(); });
  document.addEventListener('lexitron:ui-lang-changed', function(){ App.applyI18nTitles(); });

App.clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  App.shuffle = (a)=>{const arr=a.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  App.escapeHtml = (s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function loadSettings(){ try{ const raw=localStorage.getItem(LS_SETTINGS); if(raw) return Object.assign({lang:'ru',theme:'auto',repeats:6}, JSON.parse(raw)); }catch(e){} return {lang:'ru',theme:'auto',repeats:6}; }
  App.saveSettings = function(s){
  try{ localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }catch(e){}
  try{
    if (s && s.lang) localStorage.setItem('lexitron.uiLang', String(s.lang).toLowerCase());
  }catch(_){}}
;

  function loadState(){ try{ const raw=localStorage.getItem(LS_STATE); if(raw) return JSON.parse(raw);}catch(e){} return null; }

App._saveStateNow = function(){
  try{
    localStorage.setItem(LS_STATE, JSON.stringify(App.state));
  }catch(e){}
};

App._saveScheduled = false;
App._saveTimer = null;
App._saveIdleId = null;
App._savePending = false;

App.saveState = function(){
  try{
    App._savePending = true;
    if (App._saveScheduled) return;
    App._saveScheduled = true;

    if (App._saveTimer) clearTimeout(App._saveTimer);
    App._saveTimer = setTimeout(function(){
      App._saveTimer = null;
      var idle = window.requestIdleCallback || null;
      if (idle){
        if (App._saveIdleId && window.cancelIdleCallback){
          try{ cancelIdleCallback(App._saveIdleId); }catch(_){}
        }
        App._saveIdleId = idle(function(){
          App._saveIdleId = null;
          App._savePending = false;
          App._saveScheduled = false;
          App._saveStateNow();
        }, {timeout: 1000});
      } else {
        setTimeout(function(){
          App._savePending = false;
          App._saveScheduled = false;
          App._saveStateNow();
        }, 0);
      }
    }, 120);
  }catch(_){}
};

(function(){
  var flush = function(){
    try{
      if (App && App._savePending){
        App._savePending = false;
        App._saveScheduled = false;
        if (App._saveTimer) { clearTimeout(App._saveTimer); App._saveTimer = null; }
        if (App._saveIdleId && window.cancelIdleCallback){ try{ cancelIdleCallback(App._saveIdleId); }catch(_){} App._saveIdleId = null; }
        App._saveStateNow && App._saveStateNow();
      }
    }catch(e){}
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') flush();
  });
})();
;

  function loadDictRegistrySafe(){ try{ const raw=localStorage.getItem(LS_DICTS); if(raw) return JSON.parse(raw);}catch(e){} return { activeKey:null, user:{}, lastByLang:{} }; }
  App.saveDictRegistry = function(){ try{ localStorage.setItem(LS_DICTS, JSON.stringify(App.dictRegistry)); }catch(e){} };

  App.DOM = {
    titleEl:document.getElementById('title'),
    taglineEl:document.getElementById('tagline'),
    wordEl:document.getElementById('wordText'),
    hintEl:document.getElementById('hintText'),
    optionsRow:document.getElementById('optionsRow'),
    favBtn:document.getElementById('favBtn'),
    starsEl:document.getElementById('stars'),
    statsBar:document.getElementById('statsBar'),
    copyYearEl:document.getElementById('copyYear'),
    themeToggleBtn:document.getElementById('themeToggleBtn'),
    langToggleBtn:document.getElementById('langToggleBtn'),
    dictsBtn:document.getElementById('dictsBtn'),
    modalTitleEl:document.getElementById('modalTitle'),
    langFlags:document.getElementById('langFlags'),
    modal:document.getElementById('modal'),
    backdrop:document.getElementById('backdrop'),
    okBtn:document.getElementById('okBtn'),
    dictListHost:document.getElementById('dictList')
  };
  if (App.DOM.copyYearEl) App.DOM.copyYearEl.textContent = new Date().getFullYear();

  App.bootstrap = function(){
  };
})();

App.migrateFavoritesToV2 = function(){
  try{
    const st = App.state || (App.state = {});
    if (st.favorites_v2 && typeof st.favorites_v2 === 'object') return; // already migrated

    const old = st.favorites || {};
    const v2 = {};

    const dictKeys = []
      .concat(App.Decks.builtinKeys ? App.Decks.builtinKeys() : [])
      .concat(Object.keys((App.dictRegistry && App.dictRegistry.user) || {}));

    const idToDicts = {};
    dictKeys.forEach(key => {
      const arr = App.Decks.resolveDeckByKey(key) || [];
      arr.forEach(w => {
        (idToDicts[w.id] = idToDicts[w.id] || []).push(key);
      });
    });

    let migrated = 0, skipped = 0;
    Object.keys(old || {}).forEach(idStr => {
      if (!old[idStr]) return;
      const id = +idStr;
      const dicts = idToDicts[id] || [];
      if (dicts.length === 1){
        const k = dicts[0];
        if (!v2[k]) v2[k] = {};
        v2[k][id] = true;
        migrated++;
      } else {
        skipped++;
      }
    });

    st.favorites_v2 = v2;
    st.favorites_legacy = old;
    try { App.saveState && App.saveState(); } catch(e){}
    /* log removed */}catch(e){(void 0); }
};

App.isFavorite = function(dictKey, wordId){
  try{
    const st = App.state || {};
    const v2 = st.favorites_v2 || {};
    return !!(v2[dictKey] && v2[dictKey][wordId]);
  }catch(e){ return false; }
};

App.toggleFavorite = function(dictKey, wordId){
  try{
    const st = App.state || (App.state = {});
    st.favorites_v2 = st.favorites_v2 || {};
    st.favorites_v2[dictKey] = st.favorites_v2[dictKey] || {};
    st.favorites_v2[dictKey][wordId] = !st.favorites_v2[dictKey][wordId];
    App.saveState && App.saveState();
  }catch(e){}
};

App.clearFavoritesAll = function(){
  try{
    const st = App.state || {};
    st.favorites_v2 = {};
    App.saveState && App.saveState();
  }catch(e){}
};

(function migrateFromWorkingSets(){
  if (window.__ws_migrated__) return;
  window.__ws_migrated__ = true;
  try{
    const legacySetsRaw = localStorage.getItem('app.setByDeck');
    if (legacySetsRaw){
      try{
        const legacySets = JSON.parse(legacySetsRaw);
        if (legacySets && typeof legacySets==='object'){
          window.App = window.App || {};
          App.Sets = App.Sets || { state:{ activeByDeck:{}, completedByDeck:{} } };
          App.Sets.state = App.Sets.state || { activeByDeck:{}, completedByDeck:{} };
          App.Sets.state.activeByDeck = Object.assign({}, App.Sets.state.activeByDeck, legacySets);
          if (App.Sets._save) App.Sets._save();
        }
      }catch(_){}
      localStorage.removeItem('app.setByDeck');
    }

    const legacyStarsRaw = localStorage.getItem('app.starsByDeck');
    if (legacyStarsRaw){
      try{
        const legacyStarsByDeck = JSON.parse(legacyStarsRaw);
        App.state = App.state || {};
        App.state.stars = App.state.stars || {};
        if (legacyStarsByDeck && typeof legacyStarsByDeck==='object'){
          for (const deckKey of Object.keys(legacyStarsByDeck)){
            const m = legacyStarsByDeck[deckKey]||{};
            for (const wid of Object.keys(m)){
              const v = m[wid]|0;
              App.state.stars[App.starKey(wid, deckKey)] = Math.max(App.state.stars[App.starKey(wid, deckKey)]||0, v|0);
}
          }
          App.saveState && App.saveState();
        }
      }catch(_){}
      localStorage.removeItem('app.starsByDeck');
    }

    const keys = Object.keys(localStorage);
    let added = 0;
    keys.forEach(k=>{
      const mm = /^__mistakes_(.+)$/.exec(k);
      if (!mm) return;
      try{
        const arr = JSON.parse(localStorage.getItem(k)||'[]');
        added += Array.isArray(arr) ? arr.length : 0;
      }catch(_){}
      localStorage.removeItem(k);
    });
    if (added>0){
      App.state = App.state || {};
      App.state.totals = App.state.totals || {};
      App.state.totals.errors = (App.state.totals.errors|0) + added;
      App.saveState && App.saveState();
    }
  }catch(_){}
})();

  /**
   * Reset deck progress (stars/successes/lastSeen) for a given dictionary key.
   * Safe: does not touch sets-completion or favorites/mistakes storages.
   */
  App.resetDeckProgress = function(dictKey){
    try{
      const key = String(dictKey || (App.dictRegistry && App.dictRegistry.activeKey) || '');
      if (!key) return;
      const deck = (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key) || []) : [];
      if (!Array.isArray(deck) || deck.length===0) return;
      const ids = new Set(deck.map(w => String(w.id)));
      App.state = App.state || {};
      App.state.stars = App.state.stars || {};
      App.state.successes = App.state.successes || {};
      App.state.lastSeen = App.state.lastSeen || {};
      ids.forEach(id=>{
        App.state.stars[App.starKey(id, key)] = 0;
        App.state.successes[App.starKey(id, key)] = 0;
        App.state.lastSeen[App.starKey(id, key)] = 0;
      });
      App.saveState && App.saveState();
    }catch(_){}
  };

(function(){
  window.App = window.App || {};
  App.Config = App.Config || {
    setSizeDefault: 40,
    reverseThreshold: 2.5,
    starStep: 0.5,
    starMin: 0,
    starMax: 5,
    penaltiesMode: "moderate", /* ~x1.5 */
    trainerStrategy: "medium+penalties"
  };
})();

try{
  if (document.readyState !== 'loading') App.applyI18nTitles();
  else document.addEventListener('DOMContentLoaded', function(){ try{ App.applyI18nTitles(); }catch(_){
  } });
}catch(_){}

/* ====================== End of file =======================
 * File: app.core.js • Version: 1.0 • 2025-10-19
*/

/* [UPDATE-MSG] Show confirmation after update */
;(function(){
  try {
    var mark = Number(localStorage.getItem('updateJustApplied') || 0);
    if (mark && Date.now() - mark < 120000) {
      try{var __L=(window.App&&App.settings&&(App.settings.uiLang||App.settings.lang))||'ru';var __B=(window.I18N&&I18N[__L])||(window.I18N&&I18N.ru)||{};alert(__B.updateApplied||'Обновление успешно установлено!');}catch(_){alert('Обновление успешно установлено!');}
      localStorage.removeItem('updateJustApplied');
    }
  } catch (_) {}
})();
