/* ==========================================================
 * Project: MOYAMOVA
 * File: app.decks.js
 * Purpose: Логика приложения (JS)
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  var App = window.App || (window.App = {});
  App.Decks = App.Decks || {};
  App.settings = App.settings || { lang: 'ru' };
  App.state = App.state || {};
  App.dictRegistry = App.dictRegistry || { activeKey:null, user:{} };

  function langOfKey(key){
    var m = String(key||'').match(/^([a-z]{2})[_-]/i);
    return m ? m[1].toLowerCase() : null;
  }
  App.Decks.langOfKey = langOfKey;

  function normalizeKey(key){
    if (!key) return null;
    var k = String(key).trim().toLowerCase();
    return k.replace(/\s+/g,'').replace(/_+/g,'_').replace(/-+/g,'-');
  }

  function builtinKeys(){
    var out = [];
    if (window.decks && typeof window.decks === 'object'){
      for (var k in window.decks){
        if (!window.decks.hasOwnProperty(k)) continue;
        var arr = window.decks[k];
        if (Array.isArray(arr) && arr.length) out.push(k);
      }
    }
    var priority = [
      'de_verbs','de_nouns','de_adjectives','de_adverbs',
      'de_pronouns','de_prepositions','de_numbers','de_conjunctions','de_particles'
    ];
    out.sort(function(a,b){
      var ia = priority.indexOf(normalizeKey(a));
      var ib = priority.indexOf(normalizeKey(b));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return String(a).localeCompare(String(b));
    });
    return out;
  }

  function resolveDeckByKey(key){
    if (!key) return [];

    if (key === 'mistakes'){
      try {
        return (App.Mistakes && App.Mistakes.deck) ? (App.Mistakes.deck() || []) : [];
      } catch (e) { return []; }
    }

    if (key === 'fav' || key === 'favorites'){
      try {
        return (App.Favorites && App.Favorites.deck) ? (App.Favorites.deck() || []) : [];
      } catch (e) { return []; }
    }

    if (key.indexOf('user-') === 0){
      var u = App.dictRegistry.user || {};
      var d = u[key] && u[key].words;
      return Array.isArray(d) ? d : [];
    }

    if (window.decks && Array.isArray(window.decks[key])) return window.decks[key];

    var canon = normalizeKey(key);
    if (canon && canon !== key && window.decks && Array.isArray(window.decks[canon])) return window.decks[canon];

    return [];
  }

  function resolveNameByKey(key){
    var t = (typeof App.i18n === 'function') ? App.i18n() : null;
    if (key === 'mistakes') return (t && t.mistakesName) ? t.mistakesName : 'Мои ошибки';
    if (key === 'fav' || key === 'favorites') return (App.settings.lang === 'ru') ? 'Избранное' : 'Обране';

    var m = String(key||'').match(/^([a-z]{2})_([a-z]+)$/i);
    var uiRu = (App.settings.lang === 'ru');
    var POS_RU = {
      verbs:'Глаголы', nouns:'Существительные', adjectives:'Прилагательные',
      adverbs:'Наречия', pronouns:'Местоимения', prepositions:'Предлоги',
      conjunctions:'Союзы', particles:'Частицы', numbers:'Числительные'
    };
    var POS_UK = {
      verbs:'Дієслова', nouns:'Іменники', adjectives:'Прикметники',
      adverbs:'Прислівники', pronouns:'Займенники', prepositions:'Прийменники',
      conjunctions:'Сполучники', particles:'Частки', numbers:'Числівники'
    };
    if (m) {
      var pos = m[2].toLowerCase();
      var POS = uiRu ? POS_RU : POS_UK;
      if (POS[pos]) return POS[pos];
    }
    return uiRu ? 'Словарь' : 'Словник';
  }

  function flagForKey(key){
    if (key === 'fav' || key === 'favorites') return '♥';
    var lg = langOfKey(key) || '';
    var MAP = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', ru:'🇷🇺', uk:'🇺🇦', tr:'🇹🇷' };
    return MAP[lg] || '🌐';
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function openPreview(words, title){
    var t = (typeof App.i18n === 'function') ? App.i18n() : { pos_misc:'Слова' };
    var tr = (App.settings.lang === 'ru') ? 'ru' : 'uk';
    var rows = (words||[]).map(function(w){ return '<tr><td>'+escapeHtml(w.word||'')+'</td><td>'+escapeHtml(w[tr]||'')+'</td></tr>'; }).join('');
    var html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title||'')+'</title>'+
    '<style>body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}thead th{background:#f8fafc}</style>'+
    '</head><body><h3>'+escapeHtml(title||'')+'</h3><table><thead><tr><th>'+(t.pos_misc||'Слова')+'</th><th>'+((tr==='ru')?'Перевод':'Переклад')+'</th></tr></thead><tbody>'+rows+'</tbody></table></body></html>';
    var blob = new Blob([html], {type:'text/html;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel='noopener'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }

  function pickDefaultKey(){
    var fav = resolveDeckByKey('fav');
    if (fav && fav.length >= 4) return 'fav';
    var built = builtinKeys();
    for (var i=0;i<built.length;i++){
      var arr = resolveDeckByKey(built[i]);
      if (arr && arr.length >= 4) return built[i];
    }
    var users = Object.keys(App.dictRegistry.user || {});
    for (var j=0;j<users.length;j++){
      var d = resolveDeckByKey(users[j]);
      if (d && d.length >= 4) return users[j];
    }
    return built[0] || (users.length?users[0]:null);
  }

  App.Decks = {
    langOfKey: langOfKey,
    builtinKeys: builtinKeys,
    resolveDeckByKey: resolveDeckByKey,
    resolveNameByKey: resolveNameByKey,
    flagForKey: flagForKey,
    openPreview: openPreview,
    pickDefaultKey: pickDefaultKey
  };
})();

/*!
 * app.addon.sets.js — MOYAMOVA (carousel-safe)
 * Version: 1.5.2
 * Date: 2025-09-22
 *
 * Minimal, conservative changes from baseline:
 *  - keep API shape and state keys (activeByDeck, completedByDeck)
 *  - wrap to first set after the last (carousel), regardless of completion state of others
 *  - DO NOT call UI renderers from here (avoid double renders / flicker)
 *  - ensure App.state.index is clamped to new set bounds
 */
(function(){
  const App = window.App || (window.App = {});
  const S = App.Sets || (App.Sets = {});

  const LS_KEY = 'sets.progress.v1';
  const DEFAULT_SET_SIZE = 50;

  S.state = S.state || { activeByDeck: {}, completedByDeck: {} };

  function loadLS(){
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object'){
        S.state.activeByDeck = obj.activeByDeck || S.state.activeByDeck || {};
        S.state.completedByDeck = obj.completedByDeck || S.state.completedByDeck || {};
      }
    } catch(_){}
  }
  function saveLS(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(S.state)); } catch(_){}
  }

  function deckKey(){
    return (App.dictRegistry && App.dictRegistry.activeKey) || 'default';
  }
  function getDeck(){
    try { return (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(deckKey()) || []) : []; }
    catch(_) { return []; }
  }
  function getSetSize(){
    try {
      if (App.Trainer && typeof App.Trainer.getSetSize === 'function'){
        const n = App.Trainer.getSetSize(deckKey());
        return (Number.isFinite(n) && n>0) ? n : DEFAULT_SET_SIZE;
      }
    } catch(_){}
    return DEFAULT_SET_SIZE;
  }
  function setCount(len){
    const L = Number.isFinite(len) ? len : getDeck().length;
    const SZ = getSetSize();
    return Math.max(1, Math.ceil(L / SZ));
  }
  function boundsForSet(i, len){
    const L = Number.isFinite(len) ? len : getDeck().length;
    const SZ = getSetSize();
    const start = Math.max(0, (i|0) * SZ);
    const end = Math.min(L, start + SZ);
    return { start, end };
  }

  S.setTotalCount = function(){ return setCount(getDeck().length); };
  S.activeBounds = function(){
    const len = getDeck().length;
    const idx = S.getActiveSetIndex();
    return boundsForSet(idx, len);
  };
  S.getActiveSetIndex = function(){
    const k = deckKey();
    let i = S.state.activeByDeck[k];
    if (!Number.isFinite(i) || i < 0) i = 0;
    const total = setCount(getDeck().length);
    if (i >= total) i = 0;
    if (S.state.activeByDeck[k] !== i) { S.state.activeByDeck[k] = i; saveLS(); }
    return i;
  };
  S.setActiveSetIndex = function(i){
    const k = deckKey();
    const total = setCount(getDeck().length);
    const clamped = Math.max(0, Math.min(total-1, i|0));
    S.state.activeByDeck[k] = clamped;
    saveLS();

    try { if (App.Trainer && typeof App.Trainer.setBatchIndex === 'function') App.Trainer.setBatchIndex(clamped, k); } catch(_){}

    try {
      const b = boundsForSet(clamped);
      if (App.state && (App.state.index < b.start || App.state.index >= b.end)) {
        App.state.index = b.start;
        if (typeof App.saveState === 'function') App.saveState();
      }
    } catch(_){}

    try { document.dispatchEvent(new CustomEvent('sets:active-changed',{detail:{ key:k, index:clamped }})); } catch(_){}
  };
  S.isSetDone = function(i){
    const k = deckKey();
    const map = (S.state.completedByDeck && S.state.completedByDeck[k]) || {};
    return !!map[i];
  };
  S.markSetDone = function(i){
    const k = deckKey();
    if (!S.state.completedByDeck) S.state.completedByDeck = {};
    if (!S.state.completedByDeck[k]) S.state.completedByDeck[k] = {};
    S.state.completedByDeck[k][i] = true;
    saveLS();
  };

  function isActiveSetLearned(){
    try {
      const deck = getDeck();
      const b = S.activeBounds();
      const sMax = (App.Trainer && App.Trainer.starsMax) ? App.Trainer.starsMax() : 5;
      const stars = (App.state && App.state.stars) || {};
      for (let i=b.start; i<b.end; i++){
        const w = deck[i]; if (!w) continue;
        const sc = Math.max(0, Math.min(sMax, stars[App.starKey(w.id)] || 0));
        if (sc < sMax) return false;
      }
      return (b.end - b.start) > 0;
    } catch(_){ return false; }
  }

  S.checkCompletionAndAdvance = function(){
    const total = S.setTotalCount();
    if (total <= 0) return;
    if (!isActiveSetLearned()) return;

    const cur = S.getActiveSetIndex();
    S.markSetDone(cur);
    const next = (cur + 1) % total;
    S.setActiveSetIndex(next);
  };

  S.clearCompletedMarks = function(){
    const k = deckKey();
    if (S.state.completedByDeck && S.state.completedByDeck[k]) {
      S.state.completedByDeck[k] = {};
      saveLS();
    }
  };

  loadLS();
  S._save = saveLS;
})();

/* ====================== End of file =======================
 * File: app.decks.js • Version: 1.0 • 2025-10-19
*/
