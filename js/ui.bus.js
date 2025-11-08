/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.bus.js
 * Purpose: Событийная шина (event bus) UI
 * Version: 1.0
 * Last modified: 2025-10-19
*/

window.UIBus = (function(){
  const map = {};
  return {
    on: function(evt, cb){ (map[evt] ||= []).push(cb); },
    off: function(evt, cb){ if(!map[evt]) return; map[evt] = map[evt].filter(x=>x!==cb); },
    emit: function(evt, data){ (map[evt]||[]).forEach(cb=>{ try{ cb(data); }catch(_){} }); }
  };
})();

/* ====================== End of file =======================
 * File: ui.bus.js • Version: 1.0 • 2025-10-19
*/
