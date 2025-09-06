
// theme.js v1.3.1
(function(){
  const App = window.App = (window.App||{});
  App.isNightNow = function(){ const h = new Date().getHours(); return (h>=20 || h<7); };
  App.applyTheme = function(){
    let mode = App.settings?.theme || 'auto';
    if (mode==='auto') mode = App.isNightNow() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('lang', App.settings?.lang || 'uk');
  };
  let timer=null;
  App.scheduleThemeTick = function(){
    if (timer) clearInterval(timer);
    if ((App.settings?.theme||'auto')==='auto') timer = setInterval(App.applyTheme, 60*1000);
  };
})();
// конец!
