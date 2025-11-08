/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.stats.core.js
 * Purpose: Статистика и её вычисления
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  window.App = window.App || {};
  var App = window.App;
  App.Stats = App.Stats || {};

  App.Stats.recomputeAndRender = function(){
    try{ if (typeof renderSetStats === 'function') renderSetStats(); }catch(e){}
    try{ if (typeof updateStats === 'function') updateStats(); }catch(e){}
  };
})();

/* ====================== End of file =======================
 * File: ui.stats.core.js • Version: 1.0 • 2025-10-19
*/
