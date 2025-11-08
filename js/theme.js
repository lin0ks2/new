(function(){
  'use strict';

  var STORAGE_KEY = 'ui-theme'; // 'light' | 'dark' | null
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function systemPrefersDark(){
    return media ? media.matches : false;
  }

  function getStored(){
    try { return localStorage.getItem(STORAGE_KEY); } catch(e){ return null; }
  }

  function store(val){
    try { if (val === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, val); } catch(e){}
  }

  function applyTheme(mode){ // 'light' | 'dark'
    if (mode === 'dark') {
      root.setAttribute('data-theme','dark');
    } else {
      root.removeAttribute('data-theme'); // light by default
    }
    syncToggle(mode);
  }

  function currentMode(){
    var stored = getStored(); // 'light' | 'dark' | null
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function syncToggle(mode){
    var el = document.getElementById('themeToggle');
    if (!el) return;
    el.checked = (mode === 'dark');
  }

  function init(){
    // Initial apply
    applyTheme(currentMode());

    // Toggle handler
    var el = document.getElementById('themeToggle');
    if (el){
      el.addEventListener('change', function(){
        var next = el.checked ? 'dark' : 'light';
        store(next);
        applyTheme(next);
      });
    }

    // System changes (only when user didn't lock manually)
    if (media){
      media.addEventListener('change', function(){
        var stored = getStored();
        if (stored === 'light' || stored === 'dark') return; // user choice wins
        applyTheme(systemPrefersDark() ? 'dark' : 'light');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
