
/* app.core.js v1.3.1 */
(function(){
  const App = window.App = (window.App||{});
  App.APP_VER = '1.3.1';

  const LS_SETTINGS = 'k_settings_v1_3_1';
  const LS_STATE    = 'k_state_v1_3_1';
  const LS_DICTS    = 'k_dicts_v1_3_1';

  // Fallback + external
  const I18N_FALLBACK = window.I18N;

  App.settings = loadSettings();
  App.state = loadState() || {
    index:0,lastIndex:-1,favorites:{},stars:{},successes:{},
    lastShownWordId:null, totals:{shown:0,errors:0}, lastSeen:{}
  };
  App.dictRegistry = loadDictRegistrySafe();

  App.i18n = function(){
    const lang = App.settings.lang || 'uk';
    const base = (I18N_FALLBACK && I18N_FALLBACK[lang]) ? I18N_FALLBACK[lang] : I18N_FALLBACK.uk;
    return base;
  };

  App.clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  App.shuffle = (a)=>{const arr=a.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  App.escapeHtml = (s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function loadSettings(){ try{ const raw=localStorage.getItem(LS_SETTINGS); if(raw) return Object.assign({lang:'uk',theme:'auto',repeats:6}, JSON.parse(raw)); }catch(e){} return {lang:'uk',theme:'auto',repeats:6}; }
  App.saveSettings = function(s){ try{ localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }catch(e){} };

  function loadState(){ try{ const raw=localStorage.getItem(LS_STATE); if(raw) return JSON.parse(raw);}catch(e){} return null; }
  App.saveState = function(){ try{ localStorage.setItem(LS_STATE, JSON.stringify(App.state)); }catch(e){} };

  function loadDictRegistrySafe(){ try{ const raw=localStorage.getItem(LS_DICTS); if(raw) return JSON.parse(raw);}catch(e){} return { activeKey:null, user:{} }; }
  App.saveDictRegistry = function(){ try{ localStorage.setItem(LS_DICTS, JSON.stringify(App.dictRegistry)); }catch(e){} };

  // DOM map
  App.DOM = {
    titleEl:document.getElementById('title'),
    appVerEl:document.getElementById('appVer'),
    taglineEl:document.getElementById('tagline'),
    wordEl:document.getElementById('wordText'),
    hintEl:document.getElementById('hintText'),
    optionsRow:document.getElementById('optionsRow'),
    favBtn:document.getElementById('favBtn'),
    starsEl:document.getElementById('stars'),
    statsBar:document.getElementById('statsBar'),
    copyYearEl:document.getElementById('copyYear'),
    // header controls
    themeToggleBtn:document.getElementById('themeToggleBtn'),
    langToggleBtn:document.getElementById('langToggleBtn'),
    dictsBtn:document.getElementById('dictsBtn'),
    // modal
    modal:document.getElementById('modal'),
    backdrop:document.getElementById('backdrop'),
    okBtn:document.getElementById('okBtn'),
    dictListHost:document.getElementById('dictList')
  };
  if (App.DOM.copyYearEl) App.DOM.copyYearEl.textContent = new Date().getFullYear();

  App.bootstrap = function(){
    // set version label
    if (App.DOM.appVerEl) App.DOM.appVerEl.textContent = 'v' + App.APP_VER;
  };
})();
// конец!
