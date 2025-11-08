/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.options.safe.js
 * Purpose: Безопасные опции UI
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  var App = window.App || (window.App = {});

  function uiLang(){ return (App.settings && App.settings.lang) || 'ru'; }
  function activeKey(){ return (App.dictRegistry && App.dictRegistry.activeKey) || null; }

  function labelOf(word){
    if (!word) return '';
    var ui = uiLang();
    var txt = (ui === 'ru') ? (word.ru || word.uk) : (word.uk || word.ru);
    txt = txt || word.translation || word.meaning || word.value || '';
    return String(txt||'').trim();
  }

  function resolveDeck(key){
    try{ return (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key) || []) : []; }catch(e){ return []; }
  }
  function mistakesDeck(){
    try{ return (App.Mistakes && App.Mistakes.deck) ? (App.Mistakes.deck() || []) : []; }catch(e){ return []; }
  }

  function uniqPush(arr, item, used){
    var txt = item && item.text;
    if (!txt || used.has(txt)) return false;
    arr.push(item); used.add(txt); return true;
  }

  function buildOptionsMistakes(word){
    var options = [];
    var used = new Set();

    var correctText = labelOf(word) || String(word.word||'').trim();
    uniqPush(options, { id:String(word.id), text: correctText, isCorrect:true }, used);

    var pool = mistakesDeck().slice();
    for (var i = pool.length - 1; i >= 0; i--){
      if (String(pool[i].id) === String(word.id)) pool.splice(i,1);
    }
    for (var i=0; i<pool.length && options.length<4; i++){
      var txt = labelOf(pool[i]);
      if (!txt) continue;
      uniqPush(options, { id:String(pool[i].id), text:txt, isCorrect:false }, used);
    }

    var dk = word._mistakeSourceKey || activeKey();
    var full = resolveDeck(dk);
    for (var j=0; j<full.length && options.length<4; j++){
      var w = full[j]; if (String(w.id) === String(word.id)) continue;
      var txt2 = labelOf(w); if (!txt2) continue;
      uniqPush(options, { id:String(w.id), text:txt2, isCorrect:false }, used);
    }

    for (var k = options.length - 1; k > 0; k--){
      var m = Math.floor(Math.random()*(k+1));
      var tmp = options[k]; options[k]=options[m]; options[m]=tmp;
    }
    return options;
  }

  function sanitizeRegular(word, options){
    var used = new Set();
    var out = [];

    var correctText = labelOf(word) || String(word.word||'').trim();
    var hasCorrect = false;

    function pushOpt(opt){
      var txt = (opt && String(opt.text||'').trim()) || '';
      if (!txt || used.has(txt)) return;
      out.push({ id:String(opt.id||''), text:txt, isCorrect:!!opt.isCorrect });
      used.add(txt);
    }

    if (Array.isArray(options)) {
      for (var i=0;i<options.length;i++){
        var o = options[i] || {};
        if (o.isCorrect) hasCorrect = true;
        if (!o.text){
          if (o.isCorrect) o.text = correctText;
          else if (o.word) o.text = labelOf(o.word);
        }
        pushOpt(o);
      }
    }

    if (!hasCorrect){
      pushOpt({ id:String(word.id), text:correctText, isCorrect:true });
    }

    var deck = resolveDeck(activeKey());
    for (var j=0; j<deck.length && out.length<4; j++){
      var w = deck[j]; if (String(w.id) === String(word.id)) continue;
      var txt = labelOf(w); if (!txt) continue;
      pushOpt({ id:String(w.id), text:txt, isCorrect:false });
    }

    while (out.length < 4){
      out.push({ id:'__stub_'+out.length, text: correctText, isCorrect: (out.length===0) });
    }

    var corrIdx = out.findIndex(function(o){ return o.isCorrect; });
    for (var k = out.length - 1; k > 0; k--){
      var m = Math.floor(Math.random()*(k+1));
      var tmp = out[k]; out[k]=out[m]; out[m]=tmp;
    }
    if (out.every(function(o){ return !o.isCorrect; })){
      out[0].isCorrect = true;
    }
    return out;
  }

  function install(){
    var original = null, where = null;
    var probes = [
      function(){ if (typeof window.buildOptionsFor === 'function') return { obj:window, key:'buildOptionsFor' }; },
      function(){ if (typeof window.buildOptions === 'function') return { obj:window, key:'buildOptions' }; },
      function(){ if (App && App.UI && typeof App.UI.buildOptions === 'function') return { obj:App.UI, key:'buildOptions' }; },
      function(){ if (App && App.Trainer && typeof App.Trainer.buildOptions === 'function') return { obj:App.Trainer, key:'buildOptions' }; },
      function(){ if (App && typeof App.buildOptions === 'function') return { obj:App, key:'buildOptions' }; }
    ];
    for (var i=0;i<probes.length;i++){
      var hit = null; try{ hit = probes[i](); }catch(e){}
      if (hit){ original = hit.obj[hit.key]; where = hit; break; }
    }

    function wrapper(word){
      if ((App.dictRegistry && App.dictRegistry.activeKey) === 'mistakes'){
        return buildOptionsMistakes(word);
      } else {
        var opts = original ? original.call(where.obj, word) : [];
        return sanitizeRegular(word, opts);
      }
    }

    if (where){
      where.obj[where.key] = wrapper;
    } else {
      var origRender = null;
      if (typeof window.renderOptions === 'function'){
        origRender = window.renderOptions;
        window.renderOptions = function(word){
          var opts = sanitizeRegular(word, []);
          return origRender(opts);
        };
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ try{ install(); }catch(e){} });
  } else {
    try { install(); } catch(e){}
  }
})();

/* ====================== End of file =======================
 * File: ui.options.safe.js • Version: 1.0 • 2025-10-19
*/
