/* ==========================================================
 * Project: MOYAMOVA
 * File: app.trainer.js
 * Purpose: Логика тренера + взвешенная выдача + учёт звёзд
 * Version: 1.2 (2025-11-05)
 * Update: если весь словарь выучен — разрешаем тренировку на выученных словах
 * ========================================================== */

const TRAINER_DEFAULT_LEARNED_REPEAT = 'ultra';

(function(){
  const App = window.App || (window.App = {});

  function starsMax(){ return 5; }

  function difficulty(){
    try {
      const lvl = (App.settings && (App.settings.level || App.settings.mode)) || 'normal';
      return (String(lvl).toLowerCase() === 'hard') ? 'hard' : 'normal';
    } catch(_){ return 'normal'; }
  }

  function deltaOnAnswer(ok){
    const hard = (difficulty() === 'hard');
    if (ok)  return hard ? +0.5 : +1.0;
    return hard ? -0.5 : -1.0;
  }

  const PENALTY_COOLDOWN_SEC = 20;

  function getLearnedEpsilon(){
    try{
      const pref = (App.settings && App.settings.learnedRepeat!=null)
        ? App.settings.learnedRepeat
        : (typeof TRAINER_DEFAULT_LEARNED_REPEAT!=='undefined' ? TRAINER_DEFAULT_LEARNED_REPEAT : 'never');
      if (typeof pref === 'number') return Math.max(0, Math.min(0.2, pref));
      switch(String(pref||'never').toLowerCase()){
        case 'normal': return 0.05;
        case 'rare':   return 0.01;
        case 'ultra':  return 0.001;
        case 'never':
        default:       return 0;
      }
    }catch(_){ return 0; }
  }

  function unlockThreshold(){ try{ return (App.Config && App.Config.reverseThreshold) || 2.5; }catch(_){ return 2.5; } }

  const starKey = (typeof App.starKey === 'function')
    ? App.starKey
    : (id, deckKey)=> `${deckKey}:${id}`;

  function ensureState(){
    App.state = App.state || {};
    App.state.stars = App.state.stars || {};
    App.state.lastSeen = App.state.lastSeen || {};
    App.state.setByDeck = App.state.setByDeck || {};
    App.state.wrongStreak = App.state.wrongStreak || {};
    App.state.cooldownUntil = App.state.cooldownUntil || {};
  }

  function isLearned(w, deckKey){
    try{
      ensureState();
      const sMax = starsMax();
      const k = starKey(w.id, deckKey);
      const s = Math.max(0, Math.min(sMax, App.state.stars[k] || 0));
      return s >= sMax;
    }catch(_){ return false; }
  }

  /* --- добавлено: проверка выучен ли весь словарь --- */
  function isWholeDeckLearned(deckKey){
    const key = deckKey || activeKey();
    const deck = resolveDeckByKey(key);
    if (!deck.length) return false;
    const sMax = starsMax();
    for (let i=0;i<deck.length;i++){
      const w = deck[i]; if (!w) return false;
      const k = starKey(w.id, key);
      const s = Math.max(0, Math.min(sMax, (App.state && App.state.stars && App.state.stars[k]) || 0));
      if (s < sMax) return false;
    }
    return true;
  }

  /* ------------------------- взвешивание показа ------------------------ */
  function weightForWord(w, deckKey){
    try{
      ensureState();
      const sMax = starsMax();
      const k = starKey(w.id, deckKey);
      const s = Math.max(0, Math.min(sMax, App.state.stars[k] || 0));
      const last = App.state.lastSeen[k] || 0;
      const elapsedMin = Math.max(0, (Date.now() - last)/60000);
      const recency = Math.min(elapsedMin/3, 5);

      // === правка: если весь словарь выучен — разрешаем тренировать всё ===
      if (s >= sMax) {
        if (isWholeDeckLearned(deckKey)) {
          return 1 + recency * 0.2; // нормальный вес
        }
        const eps = getLearnedEpsilon();
        return eps > 0 ? (eps * (1 + recency*0.2)) : 0;
      }

      const deficit = (sMax - s);
      let wgt = Math.max(0.1, 1 + 2*deficit + recency);

      if (App.Penalties && typeof App.Penalties.weightFor === 'function') {
        try { wgt *= Math.max(1, App.Penalties.weightFor(w.id)); } catch(_){}
      }
      return wgt;
    }catch(_){ return 1; }
  }

  function sampleNextIndexWeighted(deck, deckKey){
    if (!deck || !deck.length) return 0;
    const forbidden = App.state && App.state.lastIndex;
    let total = 0;
    const weights = new Array(deck.length);
    let eligibleCount = 0;
    for (let i=0;i<deck.length;i++){
      const w = deck[i];
      let base = weightForWord(w, deckKey);
      if (base > 0) eligibleCount++;
      if (forbidden === i) base *= 0.0001;
      weights[i] = base;
      total += base;
    }
    if (eligibleCount === 0 || total <= 0) { return 0; }
    let r = Math.random()*total;
    for (let i=0;i<deck.length;i++){
      r -= weights[i];
      if (r <= 0) return i;
    }
    return Math.floor(Math.random()*deck.length);
  }

  function getSetSize(){ try{ return (App.Config && App.Config.setSizeDefault) || 50; }catch(_){ return 50; } }
  function activeKey(){ try { return (App.dictRegistry && App.dictRegistry.activeKey) || null; } catch(_){ return null; } }
  function resolveDeckByKey(key){
    try{
      return (App.Decks && App.Decks.resolveDeckByKey)
        ? (App.Decks.resolveDeckByKey(key) || [])
        : [];
    }catch(_){ return []; }
  }

  function getBatchIndex(deckKey, totalOpt){
    ensureState();
    const key = deckKey || activeKey();
    const setSize = getSetSize();
    let total = totalOpt;
    if (!Number.isFinite(total)) {
      const deck = resolveDeckByKey(key);
      total = Math.max(1, Math.ceil(deck.length / setSize));
    }
    let idx = App.state.setByDeck[key] | 0;
    if (idx < 0) idx = 0;
    if (total > 0 && idx >= total) idx = total - 1;
    return idx;
  }

  function setBatchIndex(i, deckKey){
    ensureState();
    const key = deckKey || activeKey();
    const setSize = getSetSize();
    const deck = resolveDeckByKey(key);
    const total = Math.max(1, Math.ceil(deck.length / setSize));
    let idx = (i|0);
    if (idx < 0) idx = 0;
    if (idx >= total) idx = total - 1;
    App.state.setByDeck[key] = idx;
    if (typeof App.saveState === 'function') App.saveState();
    return idx;
  }

  function getBatchesMeta(deckKey){
    ensureState();
    const key = deckKey || activeKey();
    const deck = resolveDeckByKey(key);
    const setSize = getSetSize();
    const total = Math.max(1, Math.ceil(deck.length / setSize));
    const active = getBatchIndex(key, total);
    const completed = new Array(total).fill(false);
    const sMax = starsMax();

    for (let i=0;i<total;i++){
      const start = i * setSize;
      const end = Math.min(deck.length, start + setSize);
      let done = (end > start);
      for (let j=start; j<end; j++){
        const w = deck[j];
        if (!w){ done = false; break; }
        const k = starKey(w.id, key);
        const s = Math.max(0, Math.min(sMax, App.state.stars[k] || 0));
        if (s < sMax){ done = false; break; }
      }
      completed[i] = done;
    }
    return { total, active, completed };
  }

  /* правка fallback — если сет выучен, оставляем тренировку по нему */
  function getDeckSlice(deckKey){
    const key = deckKey || activeKey();
    const deck = resolveDeckByKey(key);
    const setSize = getSetSize();
    const total = Math.max(1, Math.ceil(deck.length / setSize));

    if (isCurrentSetComplete(key)) advanceSetCircular(key);

    const idx   = getBatchIndex(key, total);
    const start = idx * setSize;
    const end   = Math.min(deck.length, start + setSize);
    const slice = deck.slice(start, end);

    const eligible = slice.filter(w => !isLearned(w, key));
    if (eligible.length) return eligible;

    // если весь словарь выучен — разрешаем использовать все слова сета
    if (isWholeDeckLearned(key)) return slice;

    // fallback на следующий сет
    if (slice.length) {
      const nextIdx = (idx + 1) % total;
      setBatchIndex(nextIdx, key);
      const nStart = nextIdx * setSize;
      const nEnd   = Math.min(deck.length, nStart + setSize);
      const nSlice = deck.slice(nStart, nEnd);
      const nEligible = nSlice.filter(w => !isLearned(w, key));
      return nEligible.length ? nEligible : nSlice;
    }
    return deck;
  }

  function _currentSetBounds(deckKey){
    const key = deckKey || activeKey();
    const deck = resolveDeckByKey(key);
    const setSize = getSetSize();
    const idx = getBatchIndex(key, Math.max(1, Math.ceil(deck.length / setSize)));
    const start = idx * setSize;
    const end   = Math.min(deck.length, start + setSize);
    return { key, deck, setSize, idx, start, end, total: Math.max(1, Math.ceil(deck.length / setSize)) };
  }

  function isCurrentSetComplete(deckKey){
    const { key, deck, start, end } = _currentSetBounds(deckKey);
    if (!deck.length || end <= start) return false;
    const sMax = starsMax();
    for (let i = start; i < end; i++){
      const w = deck[i]; if (!w) return false;
      const k = starKey(w.id, key);
      const s = Math.max(0, Math.min(sMax, (App.state && App.state.stars && App.state.stars[k]) || 0));
      if (s < sMax) return false;
    }
    return true;
  }

  function isWholeDeckComplete(deckKey){ return isWholeDeckLearned(deckKey); }

  function advanceSetCircular(deckKey){
    const { key, deck, idx, total } = _currentSetBounds(deckKey);
    if (!deck.length || total < 1) return;
    const next = (idx + 1) % total;
    setBatchIndex(next, key);
    try { App.Home && typeof App.Home.renderSetStats==='function' && App.Home.renderSetStats(); } catch(_){}
    try { App.Home && typeof App.Home.updateStats==='function' && App.Home.updateStats(); } catch(_){}
    try { document.dispatchEvent(new CustomEvent('lexitron:set-advanced', { detail:{ key, index: next } })); } catch(_){}
  }

  function handleAnswer(deckKey, wordId, ok){
    ensureState();
    const key = deckKey || activeKey();
    if (!key || wordId==null) return;

    const k = starKey(wordId, key);
    const sMax = starsMax();
    const now = Date.now();

    const streak = App.state.wrongStreak[k] | 0;
    const until  = App.state.cooldownUntil[k] | 0;
    let d = deltaOnAnswer(!!ok);

    if (!ok){
      if (streak >= 2){
        if (now < until) d = 0;
        else App.state.wrongStreak[k] = 0;
      } else {
        App.state.wrongStreak[k] = streak + 1;
        if (App.state.wrongStreak[k] >= 2){
          App.state.cooldownUntil[k] = now + PENALTY_COOLDOWN_SEC*1000;
        }
      }
    } else {
      App.state.wrongStreak[k] = 0;
      App.state.cooldownUntil[k] = 0;
    }

    const cur = Number(App.state.stars[k] || 0);
    let next = cur + d;
    if (!ok && d < 0) next = Math.max(0, next);
    next = Math.max(0, Math.min(sMax, next));
    App.state.stars[k] = next;

    App.state.lastSeen[k] = now;
    App.state.lastIndex = null;
    if (typeof App.saveState === 'function') App.saveState();

    /* === ДОБАВЛЕНО: сразу подтянуть прогресс в плоские звёзды для тоггла === */
    try { App.syncStars && App.syncStars('merge'); } catch(_){}

    try {
      if (isWholeDeckComplete(key)) {
        document.dispatchEvent(new CustomEvent('lexitron:deck-complete', { detail:{ key } }));
      } else if (isCurrentSetComplete(key)) {
        document.dispatchEvent(new CustomEvent('lexitron:set-complete', { detail:{ key } }));
        advanceSetCircular(key);
      }
    } catch(_){}
  }

  var _recentShown = []; var _K = 5;
  function rememberShown(id){
    try{
      if (id==null) return;
      id = String(id);
      var i = _recentShown.indexOf(id);
      if (i>=0) _recentShown.splice(i,1);
      _recentShown.push(id);
      while(_recentShown.length>_K) _recentShown.shift();
    }catch(_){}
  }

  App.Trainer = Object.assign({}, App.Trainer || {}, {
    starsMax,
    unlockThreshold,
    sampleNextIndexWeighted: (deck)=>sampleNextIndexWeighted(deck, App.Trainer?.getDeckKey?.()),
    getSetSize,
    getBatchIndex,
    setBatchIndex,
    getBatchesMeta,
    getDeckSlice,
    handleAnswer,
    rememberShown,
    _recentShown,
    isCurrentSetComplete,
    isWholeDeckComplete,
    advanceSetCircular
  });
})();

/* ===================== Trainer bridge ===================== */
(function(){
  const A = (window.App = window.App || {});
  A.Trainer = A.Trainer || {};

  let _deckKey = A.Trainer.deckKey || null;
  let _deck    = A.Trainer.deck    || [];

  function _first(){
    try { return (A.Decks && A.Decks.builtinKeys && A.Decks.builtinKeys()[0]) || ''; } catch(_){ return ''; }
  }
  function _loadSaved(){ try { return (A.settings && A.settings.lastDeckKey) || ''; } catch(_){ return ''; } }
  function _save(key){ try { A.settings = A.settings || {}; A.settings.lastDeckKey = key; } catch(_){ } }
  function _resolve(key){ try { return (A.Decks && A.Decks.resolveDeckByKey && A.Decks.resolveDeckByKey(key)) || []; } catch(_){ return []; } }

  function _apply(){
    try{
      if (typeof A.Trainer.refresh === 'function') A.Trainer.refresh();
      else if (typeof A.Trainer.render === 'function') A.Trainer.render();
      document.dispatchEvent(new CustomEvent('lexitron:trainer-deck-changed', { detail:{ key:_deckKey } }));
    }catch(_){}
  }

  function setDeckKey(key, opts){
    opts = opts || {};
    if (!key || key === _deckKey) return;
    const deck = _resolve(key);
    if (!deck.length) return;
    _deckKey = key; _deck = deck;
    A.Trainer.deckKey = _deckKey; A.Trainer.deck = _deck;
    _save(_deckKey);
    if (!opts.silent) _apply();
  }

  function ensureDeckLoaded(){
    if (_deckKey) return;
    const k = _loadSaved() || _first();
    if (k) setDeckKey(k, { silent:true });
  }

  A.Trainer.setDeckKey       = A.Trainer.setDeckKey       || setDeckKey;
  A.Trainer.ensureDeckLoaded = A.Trainer.ensureDeckLoaded || ensureDeckLoaded;
  A.Trainer.getDeckKey       = A.Trainer.getDeckKey       || (()=>_deckKey);
  A.Trainer.getDeck          = A.Trainer.getDeck          || (()=>_deck);

  document.addEventListener('lexitron:deck-selected', (e)=>{
    try{ const k = e && e.detail && e.detail.key; if (k) setDeckKey(k); }catch(_){}
  }, { passive:true });

  const onRoute = ()=>{
    const r = (A.Router && A.Router.current) || document.body.getAttribute('data-route') || '';
    if (String(r).toLowerCase() === 'home') ensureDeckLoaded();
  };
  try {
    document.addEventListener('lexitron:route-changed', onRoute, { passive:true });
    window.addEventListener('lexitron:route-changed', onRoute, { passive:true });
  } catch(_){}
})();
