/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.state.js
 * Purpose: Состояние UI/приложения
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  const A = ()=>window.App||{};
  function key(){ return (A().dictRegistry && A().dictRegistry.activeKey) || null; }
  function idx(){
    const k = key();
    return (A().Sets && A().Sets.state && A().Sets.state.activeByDeck && A().Sets.state.activeByDeck[k]) || 0;
  }
  function sync(){
    try{
      const k = key(); const i = idx();
      if (A().Trainer && typeof A().Trainer.setBatchIndex==='function'){
        A().Trainer.setBatchIndex(i, k);
      }
    }catch(e){}
  }
  window.UIState = {
    get activeDict(){ return key(); },
    set activeDict(v){
  if (!A().dictRegistry) A().dictRegistry = {};
  A().dictRegistry.activeKey = v;
  if (A().saveDictRegistry) A().saveDictRegistry();
  try{
    localStorage.setItem('lexitron.deckKey', v);
    localStorage.setItem('lexitron.activeKey', v);
  }catch(_){}
},
    get activeSetIndex(){ return idx(); },
    setActiveSetIndex: function(i){ A().Sets && A().Sets.setActiveSetIndex && A().Sets.setActiveSetIndex(i); },
    syncTrainer: sync
  };
})();

/* ====================== End of file =======================
 * File: ui.state.js • Version: 1.0 • 2025-10-19
*/
