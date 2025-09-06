
/* app.trainer.js v1.3.1 — частотный планировщик */
(function(){
  const App = window.App;
  function starsMax(){ return App.clamp(App.settings.repeats||6,3,6); }
  function unlockThreshold(){ return 3; }
  function weightForWord(w){
    const sMax=starsMax();
    const stars=App.clamp(App.state.stars[w.id]||0,0,sMax);
    const deficit=(sMax-stars);
    const last=App.state.lastSeen[w.id]||0;
    const elapsedMin=Math.max(0,(Date.now()-last)/60000);
    const recency=Math.min(elapsedMin/3,5);
    return Math.max(0.1, 1+2*deficit+recency);
  }
  function sampleNextIndexWeighted(deck){
    if (!deck.length) return 0;
    const forbidden=App.state.lastIndex;
    let total=0; const weights=deck.map((w,idx)=>{ const base=weightForWord(w); const penalty=(idx===forbidden)?0.0001:1; const wgt=base*penalty; total+=wgt; return wgt; });
    let r=Math.random()*total;
    for (let i=0;i<deck.length;i++){ r-=weights[i]; if (r<=0) return i; }
    return Math.floor(Math.random()*deck.length);
  }
  App.Trainer = { starsMax, unlockThreshold, sampleNextIndexWeighted };
})();
// конец!
