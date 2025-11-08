/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.sets.done.js
 * Purpose: Финализация сетов/пройденные наборы
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  var App = window.App || (window.App = {});
  App.Sets = App.Sets || {};

  var STORE = 'sets.done.v1';

  function load(){
    try{
      var raw = localStorage.getItem(STORE);
      var st = raw ? JSON.parse(raw) : {};
      return (st && typeof st === 'object') ? st : {};
    }catch(e){ return {}; }
  }
  function save(st){ try{ localStorage.setItem(STORE, JSON.stringify(st)); }catch(e){} }
  function activeKey(){ return (App.dictRegistry && App.dictRegistry.activeKey) || null; }

  App.Sets.getDone = function(key){
    key = key || activeKey();
    var st = load();
    return st[key] || [];
  };
  App.Sets.isDone = function(key, idx){
    if (typeof idx === 'undefined'){ idx = key; key = activeKey(); }
    var arr = App.Sets.getDone(key);
    return Array.isArray(arr) ? arr.indexOf(idx) >= 0 : false;
  };
  App.Sets.markDone = function(key, idx){
    if (typeof idx === 'undefined'){ idx = key; key = activeKey(); }
    if (key == null || typeof idx !== 'number') return;
    var st = load();
    var arr = st[key] || (st[key] = []);
    if (arr.indexOf(idx) === -1) arr.push(idx);
    save(st);
    try{ App.Sets.refreshDoneStyles && App.Sets.refreshDoneStyles(); }catch(e){}
  };

  (function injectCSS(){
    var css = ""
      + ".set-tile--done{ box-shadow: inset 0 0 0 2px var(--accent); border-color: var(--accent)!important; }"
      + ".set-tile--done::after{ content:'✓'; position:absolute; right:6px; top:6px; font-weight:700; font-size:12px; color:var(--accent); opacity:.85; }";
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  })();

  function applyStyles(){
    try{
      var host = document.getElementById('setsBar');
      if (!host) return;
      var tiles = host.querySelectorAll('[data-set-index]');
      var done = App.Sets.getDone(activeKey());
      for (var j=0;j<tiles.length;j++){
        var el = tiles[j];
        var idx = parseInt(el.getAttribute('data-set-index'),10);
        if (done.indexOf(idx) >= 0){
          el.classList.add('set-tile--done');
          el.style.position = el.style.position || 'relative';
        } else {
          el.classList.remove('set-tile--done');
        }
      }
    }catch(e){}
  }

  App.Sets.refreshDoneStyles = applyStyles;

  (function patchRender(){
    var orig = App.renderSetsBar || window.renderSetsBar;
    if (typeof orig === 'function'){
      var wrapped = function(){
        var r = orig.apply(this, arguments);
        try{ applyStyles(); }catch(e){}
        return r;
      };
      App.renderSetsBar = wrapped;
      window.renderSetsBar = wrapped;
    }else{
      document.addEventListener('DOMContentLoaded', applyStyles);
    }
  })();

  if (App.Sets && typeof App.Sets.setActiveSetIndex === 'function'){
    var _origSet = App.Sets.setActiveSetIndex;
    App.Sets.setActiveSetIndex = function(i){
      var r = _origSet.apply(this, arguments);
      try{ applyStyles(); }catch(e){}
      return r;
    };
  }
})();

/* ====================== End of file =======================
 * File: ui.sets.done.js • Version: 1.0 • 2025-10-19
*/
