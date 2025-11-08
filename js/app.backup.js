'use strict';
/*
 * app.backup.js
 * Экспорт / импорт состояния приложения MOYAMOVA
 * Финальная версия с поддержкой iOS/PWA и автопривязкой кнопок
 * Дата: 2025-11-06
 */

(function(){
  // ====================== Вспомогательные ======================
  function downloadString(filename, text){
    try{
      const blob = new Blob([text], {type: 'application/json;charset=utf-8'});
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // iOS / PWA fallback — открываем во вкладке, если download не сработает
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        URL.revokeObjectURL(url);
        a.remove();
      }, 1500);
      return true;
    }catch(e){
      console.error('Backup download failed:', e);
      try {
        // последняя надежда — открыть JSON во вкладке
        window.open('data:application/json;charset=utf-8,' + encodeURIComponent(text), '_blank');
      }catch(_){}
      return false;
    }
  }

  function readFileAsText(file, callback){
    const reader = new FileReader();
    reader.onload = e => callback(null, e.target.result);
    reader.onerror = e => callback(e);
    reader.readAsText(file, 'utf-8');
  }

  function safeParse(json){
    try{ return JSON.parse(json); }catch(_){ return null; }
  }

  // ====================== Основная логика ======================
  const App = window.App || (window.App = {});
  if (!App.Backup) App.Backup = {};

  // Сбор данных
  App.Backup.export = function(){
    try{
      const payload = {
        meta: {
          app: 'MOYAMOVA',
          version: App.version || 'unknown',
          time: new Date().toISOString(),
        },
        settings: App.settings || {},
        state: App.state || {},
        dicts: App.dictRegistry || {}
      };
      const json = JSON.stringify(payload, null, 2);
      const fname = 'moyamova-backup-' + new Date().toISOString().replace(/[:T]/g, '-').split('.')[0] + '.json';
      downloadString(fname, json);
      if (App.UI && App.UI.toast) App.UI.toast('Резервная копия создана');
    }catch(e){
      console.error('Backup export failed:', e);
      if (App.UI && App.UI.toast) App.UI.toast('Ошибка экспорта');
    }
  };

 // Импорт данных
App.Backup.import = function(){
  try{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // iOS-safe скрытие
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', function(ev){
      const f = ev && ev.target && ev.target.files && ev.target.files[0];
      if (f){
        readFileAsText(f, function(err, txt){
          if (err){ console.error(err); return; }
          const data = safeParse(txt);
          if (!data){ alert('Файл повреждён или имеет неверный формат.'); return; }

          // === Восстановление в память ===
          if (data.settings) window.App.settings = data.settings;
          if (data.state)    window.App.state    = data.state;
          if (data.dicts)    window.App.dictRegistry = data.dicts;

          // === Persist в те ключи, которые читает приложение ===
          try { if (typeof App.saveSettings === 'function') App.saveSettings(App.settings); } catch(_){}
          try { if (typeof App._saveStateNow === 'function') App._saveStateNow(); } catch(_){}
          try { if (typeof App.saveDictRegistry === 'function') App.saveDictRegistry(); } catch(_){}

          // Синхронизируем активный ключ для быстрого доступа
          try{
            var key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
            if (key){
              localStorage.setItem('lexitron.deckKey', String(key));
              localStorage.setItem('lexitron.activeKey', String(key));
            }
          }catch(_){}

          // Пересчёт/перерисовка (на случай без reload)
          try {
            if (App.Stats && typeof App.Stats.recomputeAndRender === 'function') {
              App.Stats.recomputeAndRender({ full: true });
            }
            if (typeof window.renderSetStats === 'function') { window.renderSetStats(); }
            if (App.Sets && typeof App.Sets.applyStyles === 'function') { App.Sets.applyStyles(); }
            if (typeof window.updateSpoilerHeader === 'function') window.updateSpoilerHeader();
          } catch(e){ console.warn('post-import UI update warning:', e); }

          // Надёжно: перезапустим, чтобы все модули перечитали LS
          try{ if (App.UI && App.UI.toast) App.UI.toast('Импорт завершён. Перезапуск...'); }catch(_){}
          setTimeout(function(){ location.reload(); }, 150);
        });
      }
      setTimeout(()=>input.remove(), 0);
    });

    input.click();
  }catch(e){
    console.error('Backup import failed:', e);
    alert('Ошибка импорта данных');
  }
};

  // ====================== Автопривязка кнопок ======================
  (function bindBackupButtons(){
    function bind(){
      const exp = document.querySelector('.backup-btn[data-action="export"]');
      const imp = document.querySelector('.backup-btn[data-action="import"]');
      if (exp) exp.addEventListener('click', ()=> App.Backup.export && App.Backup.export());
      if (imp) imp.addEventListener('click', ()=> App.Backup.import && App.Backup.import());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  })();

})();
