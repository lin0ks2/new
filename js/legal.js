// js/legal.js
// Лист юридической информации между шапкой и футером.
// Модуль формирует объект Legal и экспортирует его, а также вешает на window.Legal для удобства вызова из других скриптов.

const Legal = (() => {
  // -------------------- Язык интерфейса --------------------
  function currentLang(){
    try{
      const dom = document.documentElement.getAttribute('lang');
      const app = (window.App && App.settings && (App.settings.uiLang || App.settings.lang));
      const raw = String(dom || app || 'ru').toLowerCase();
      return (raw === 'uk' || raw === 'ua' || raw.startsWith('uk-')) ? 'uk' : 'ru';
    }catch(_){ return 'ru'; }
  }
  function legalUrl(section){
    const lang = currentLang();
    return `./legal/${section}.${lang}.html`;
  }

  // -------------------- Внутреннее состояние --------------------
  let sheet, content, tabs, styleTag;

  // 🔧 для возврата "куда были", и жеста влево→вправо
  let __backRoute = 'home';
  let __swX0 = 0, __swY0 = 0, __swMoved = false;

  // -------------------- Хелперы маршрута --------------------
  function getCurrentRoute(){
    try {
      return (window.App && App.Router && App.Router.current) || document.body.getAttribute('data-route') || 'home';
    } catch(_){
      return 'home';
    }
  }
  function routeBack(){
    const to = __backRoute || 'home';
    try{
      if (window.Router && typeof Router.routeTo === 'function') Router.routeTo(to);
      else if (window.App && App.Router && typeof App.Router.routeTo === 'function') App.Router.routeTo(to);
    }catch(_){}
  }
  function routeTo(name){
    const to = name || 'home';
    try{
      if (window.Router && typeof Router.routeTo === 'function') Router.routeTo(to);
      else if (window.App && App.Router && typeof App.Router.routeTo === 'function') App.Router.routeTo(to);
    }catch(_){}
  }

  // ✅ Перехват кликов по футеру, когда открыт Legal:
  // закрываем лист и сразу роутим на выбранную страницу
  document.addEventListener('click', function(e){
    const btn = e.target.closest('.app-footer .nav-btn');
    if (!btn) return;

    // Legal не открыт — ничего не делаем
    if (!document.body.classList.contains('legal-open') || !sheet || sheet.style.display === 'none') return;

    const target = btn.getAttribute('data-action');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    try { close(); } catch(_){}
    routeTo(target);
  }, true); // capture, чтобы сработать раньше других обработчиков

  // -------------------- Создание UI --------------------
  function ensureSheet(){
    if (sheet) return;

    const css = `
      .legal-sheet{
        position:fixed; left:0; right:0;
        top:var(--header-h-actual); bottom:var(--footer-h-actual);
        background:#fff; z-index:1200; display:none;
        box-shadow:none; border:0;
        display:flex; flex-direction:column;
      }
      .legal-top{
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px; border-bottom:1px solid #e5e7eb;
        font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
      }
      .legal-tabs{ display:flex; gap:8px; align-items:center; }
      .legal-tab{
        padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px;
        background:#fff; cursor:pointer; font-size:14px;
      }
      .legal-tab[aria-selected="true"]{
        border-color: var(--burger);
        outline:0; box-shadow:0 0 0 3px color-mix(in srgb, var(--burger) 20%, transparent);
      }
      .legal-content{
        position:relative; flex:1 1 auto; overflow:auto; -webkit-overflow-scrolling:touch;
        padding:12px;
        font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif; color:#111;
      }
      .legal-content h1{ margin:0 0 12px; font-size:22px; }
      .legal-content h2{ margin:20px 0 8px; font-size:18px; }
      .legal-content a{ color:#0b57d0; text-decoration:none; }
      .legal-content a:hover{ text-decoration:underline; }
      .legal-content :target{ scroll-margin-top: 72px; }
    `;
    styleTag = document.createElement('style');
    styleTag.id = 'legal-sheet-styles';
    styleTag.textContent = css;
    document.head.appendChild(styleTag);

    // реакция на смену языка
    try {
      document.addEventListener('lexitron:ui-lang-changed', function(){ try{ window.applyI18n && window.applyI18n(sheet); }catch(_){ } });
      window.addEventListener('lexitron:ui-lang-changed', function(){ try{ window.applyI18n && window.applyI18n(sheet); }catch(_){ } });
    } catch(_){ }

    sheet = document.createElement('section');
    sheet.className = 'legal-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-label','');
    sheet.setAttribute('data-i18n-aria','legalTitle');

    const top = document.createElement('div');
    top.className = 'legal-top';

    tabs = document.createElement('div');
    tabs.className = 'legal-tabs';
    tabs.innerHTML = `
      <button class="legal-tab" data-section="terms" aria-label="" data-i18n="legalTerms" data-i18n-aria="legalTerms">Условия</button>
      <button class="legal-tab" data-section="privacy" aria-label="" data-i18n="legalPrivacy" data-i18n-aria="legalPrivacy">Конфиденциальность</button>
      <button class="legal-tab" data-section="impressum" aria-label="" data-i18n="legalImpressum" data-i18n-aria="legalImpressum">Юридическая информация</button>
    `;

    top.appendChild(tabs);

    content = document.createElement('div');
    content.className = 'legal-content';

    sheet.appendChild(top);
    sheet.appendChild(content);
    document.body.appendChild(sheet);

    // свайп слева направо → закрыть и вернуться туда, откуда пришли
    sheet.addEventListener('touchstart', function(e){
      if (e.touches.length!==1) return;
      __swX0 = e.touches[0].clientX;
      __swY0 = e.touches[0].clientY;
      __swMoved = false;
    }, {passive:true});
    sheet.addEventListener('touchmove', function(e){
      if (e.touches.length!==1) return;
      const dx = e.touches[0].clientX - __swX0;
      const dy = e.touches[0].clientY - __swY0;
      if (Math.abs(dx)>6 || Math.abs(dy)>6) __swMoved = true;
    }, {passive:true});
    sheet.addEventListener('touchend', function(e){
      if (!__swMoved) return;
      const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
      if (!t) return;
      const dx = t.clientX - __swX0;
      const dy = t.clientY - __swY0;
      const ady = Math.abs(dy);
      const MIN_RIGHT = 90, MAX_UPDOWN = 48;
      // если движение вправо (dx > MIN_RIGHT) и нет большого вертикального отклонения
      if (dx > MIN_RIGHT && ady <= MAX_UPDOWN) {
        try { e.preventDefault(); } catch(_){}
        closeAndBack();
      }
    }, {passive:false});

    // клики по табам
    sheet.addEventListener('click', (e)=>{
      const btn = e.target.closest('.legal-tab');
      if (btn) open(btn.dataset.section);
    });
    document.addEventListener('keydown', (e)=>{
      if (sheet.style.display !== 'none' && e.key === 'Escape') close();
    }, {capture:true});

    // Перезагрузка при смене языка (тогл шлёт это событие)
    const reload = ()=>{
      if (!sheet || sheet.style.display === 'none') return;
      const active = sheet.querySelector('.legal-tab[aria-selected="true"]')?.dataset.section || 'impressum';
      load(active);
    };
    window.addEventListener('lexitron:ui-lang-changed', reload, { passive:true });
    document.addEventListener('lexitron:ui-lang-changed', reload, { passive:true });
  }

  function setActiveTab(section){
    sheet.querySelectorAll('.legal-tab').forEach(b=>{
      b.setAttribute('aria-selected', String(b.dataset.section === section));
    });
  }

  function extractMain(html){
    try{
      const el = document.createElement('div');
      el.innerHTML = html;
      const main = el.querySelector('main');
      return main ? main.innerHTML : html;
    }catch{
      return html;
    }
  }

  async function load(section){
    const url = legalUrl(section);
    const res = await fetch(url, { credentials: 'same-origin' });
    const text = await res.text();
    content.innerHTML = extractMain(text) + 
  `<div class="legal-tabs" style="margin:24px 0 0; border-top:1px solid #eee; padding-top:16px; justify-content:center;">
     <button class="legal-tab" data-section="terms" data-i18n="legalTerms">Условия</button>
     <button class="legal-tab" data-section="privacy" data-i18n="legalPrivacy">Конфиденциальность</button>
     <button class="legal-tab" data-section="impressum" data-i18n="legalImpressum">Юридическая информация</button>
   </div>`;
  }

  function open(section='impressum'){
    __backRoute = getCurrentRoute(); // запоминаем маршрут
    ensureSheet();
    if (document.body.classList.contains('menu-open')) {
      document.body.classList.remove('menu-open');
      document.querySelector('.oc-root')?.setAttribute('aria-hidden','true');
    }
    setActiveTab(section);
    sheet.style.display = 'flex';
    try{ window.applyI18n && window.applyI18n(sheet); }catch(_){}
    document.body.classList.add('legal-open');
    load(section).catch(console.warn);
  }

  function close(){
    if (!sheet) return;
    sheet.style.display = 'none';
    document.body.classList.remove('legal-open');
  }

  function closeAndBack(){
    try { close(); } catch(_){}
    routeBack();
  }

  return { open, close, closeAndBack };
})();

// Экспорт для ESM и доступ на window для старых обработчиков
try { window.Legal = Legal; } catch(_) {}
export default Legal;
export { Legal };
