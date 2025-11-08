/* ==========================================================
 * File: ui.swipe.js
 * Purpose: Навигация между основными страницами по свайпам
 * Version: 1.2 — dead-zone справа (под бургер), без прочих проверок
 * ========================================================== */

(function(){
  'use strict';

  // -------------------- Параметры жестов --------------------
  const START_EDGE_GUARD = 40; // ширина мёртвой зоны у ПРАВОГО края (px)
  const MIN_SWIPE_X = 64;      // минимальная длина горизонтального свайпа (px)
  const MAX_SLOPE_Y = 64;      // допустимое вертикальное отклонение (px)
  const MAX_GESTURE_MS = 900;  // макс. длительность жеста (ms)

  // зона у правого края
  function inRightEdge(x) {
    return (window.innerWidth - x) < START_EDGE_GUARD;
  }

  // -------------------- Последовательность страниц --------------------
  const ORDER = ['home', 'dicts', 'fav', 'mistakes', 'stats'];

  // -------------------- Текущий роут --------------------
  function curRoute(){
    try {
      if (window.App && App.Router && App.Router.current)
        return App.Router.current;
    } catch(_){}
    const a = document.body.getAttribute('data-route');
    return a || 'home';
  }

  // -------------------- Роутинг --------------------
  function routeTo(name){
    try {
      if (window.Router && typeof Router.routeTo === 'function') Router.routeTo(name);
      else if (window.App && App.Router && typeof App.Router.routeTo === 'function') App.Router.routeTo(name);
    } catch(_){}
    setTimeout(() => updateFooterActive(name), 0);
  }

  function nextRoute(name){
    const r = name || curRoute();
    const i = ORDER.indexOf(r);
    return ORDER[(i + 1 + ORDER.length) % ORDER.length];
  }

  function prevRoute(name){
    const r = name || curRoute();
    const i = ORDER.indexOf(r);
    return ORDER[(i - 1 + ORDER.length) % ORDER.length];
  }

  // -------------------- Обновление футера --------------------
  function updateFooterActive(route){
    const r = route || curRoute();
    const footer = document.querySelector('.app-footer');
    if (!footer) return;
    footer.querySelectorAll('.nav-btn').forEach(btn => {
      const act = btn.getAttribute('data-action');
      const isActive = (act === r);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      const icon = btn.querySelector('.nav-icon');
      if (icon) icon.classList.toggle('active', isActive);
    });
  }

  // -------------------- Распознавание свайпа --------------------
  let sx=0, sy=0, st=0, moved=false, handled=false, startEl=null;

  function onTouchStart(e){
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
    st = Date.now();
    moved = false;
    handled = false;
    startEl = e.target;

    // 🚫 если свайп начался у ПРАВОГО края (<START_EDGE_GUARD px до кромки) — игнорируем (жест уходит бургеру)
    if (inRightEdge(sx)) {
      handled = true;
      return;
    }
  }

  function onTouchMove(e){
    if (handled || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < 8 && ady < 8) return;
    moved = true;

    // блокируем скролл только если явно горизонтальный свайп
    if (adx > ady && adx >= MIN_SWIPE_X && ady <= MAX_SLOPE_Y) {
      try { e.preventDefault(); } catch(_){}
    }
  }

  function onTouchEnd(e){
    if (!moved || handled) return;
    const dt = Date.now() - st;
    if (dt > MAX_GESTURE_MS) return;

    const touch = (e.changedTouches && e.changedTouches[0]) || {};
    const dx = touch.clientX - sx;
    const dy = touch.clientY - sy;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < MIN_SWIPE_X || ady > MAX_SLOPE_Y) return;

    handled = true;
    const right = dx > 0;  // свайп вправо
    const left  = dx < 0;  // свайп влево

    // инвертированная логика: влево → вперёд, вправо → назад
    if (left)  return routeTo(nextRoute());
    if (right) return routeTo(prevRoute());
  }

  // -------------------- Инициализация --------------------
  function mount(){
    const root = document.getElementById('app') || document.body;
    root.addEventListener('touchstart', onTouchStart, {passive:true});
    root.addEventListener('touchmove',  onTouchMove,  {passive:false});
    root.addEventListener('touchend',   onTouchEnd,   {passive:true});
    updateFooterActive(curRoute());
  }

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);

})();
