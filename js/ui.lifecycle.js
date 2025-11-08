/* ==========================================================
 * Project: MOYAMOVA
 * File: ui.lifecycle.js
 * Purpose: Жизненный цикл приложения, стартовая инициализация
 * Version: 1.1
 * Last modified: 2025-11-02
 * Notes:
 *  - Дефолт UI-языка = 'ru' (синхронно с app.core.js)
 *  - Без «склейки»: чистые функции, строгий режим, явные шаги
 *  - Без лишних логов и "void 0"
 * ========================================================== */

(function () {
  'use strict';

  /* ========================= Helpers ========================= */

  function safe(fn) { try { return fn(); } catch (_) { /* noop */ } }
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function safeHook(globalName, after) {
    var w = window;
    if (typeof w[globalName] !== 'function') return;
    var orig = w[globalName];
    w[globalName] = function () {
      var r = orig.apply(this, arguments);
      safe(after);
      return r;
    };
  }

  /* ===================== Answer / Set hooks ==================== */

  function afterAnswer() {
    safe(function () {
      if (window.App && App.Sets && typeof App.Sets.checkCompletionAndAdvance === 'function') {
        App.Sets.checkCompletionAndAdvance();
      }
    });
    safe(function () { if (window.App && App.Stats && App.Stats.recomputeAndRender) App.Stats.recomputeAndRender(); });
    safe(function () { if (typeof renderSetStats === 'function') renderSetStats(); });
    safe(function () { if (typeof window.updateSpoilerHeader === 'function') window.updateSpoilerHeader(); });
  }

  function afterSetChange() {
    safe(function () { if (window.App && App.Stats && App.Stats.recomputeAndRender) App.Stats.recomputeAndRender(); });
    safe(function () { if (typeof renderSetStats === 'function') renderSetStats(); });
    safe(function () { if (typeof window.updateSpoilerHeader === 'function') window.updateSpoilerHeader(); });
  }

  // Подвешиваемся к глобальным хэндлерам выбора ответа
  safe(function () {
    safeHook('onChoice',      afterAnswer);
    safeHook('onIDontKnow',   afterAnswer);
    safeHook('nextWord',      afterAnswer);

    if (window.App && App.Sets && typeof App.Sets.setActiveSetIndex === 'function') {
      var _set = App.Sets.setActiveSetIndex;
      App.Sets.setActiveSetIndex = function (i) {
        var r = _set.apply(this, arguments);
        safe(afterSetChange);
        return r;
      };
    }
  });

  /* ===================== Startup Manager ===================== */

  (function () {
    var LS = {
      uiLang:        'lexitron.uiLang',
      studyLang:     'lexitron.studyLang',
      deckKey:       'lexitron.deckKey',
      setupDone:     'lexitron.setupDone',
      legacyActiveKey: 'lexitron.activeKey'
    };

    function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* noop */ } }

    function builtinKeys() {
      return safe(function () {
        if (window.App && App.Decks && typeof App.Decks.builtinKeys === 'function') return App.Decks.builtinKeys();
        return Object.keys(window.decks || {});
      }) || [];
    }

    function firstLang() {
      var keys = builtinKeys();
      if (!keys.length) return null;
      return String(keys[0]).split('_')[0] || null;
    }

    function deckExists(key) {
      if (!key) return false;
      if (key === 'fav' || key === 'favorites' || key === 'mistakes') return true;
      return !!safe(function () {
        if (window.App && App.Decks && typeof App.Decks.resolveDeckByKey === 'function') {
          var arr = App.Decks.resolveDeckByKey(key);
          return Array.isArray(arr); // существование достаточно
        }
        return key && window.decks && Array.isArray(window.decks[key]);
      });
    }

    function deckNonEmpty(key) {
      if (!key) return false;
      return !!safe(function () {
        if (window.App && App.Decks && typeof App.Decks.resolveDeckByKey === 'function') {
          var arr = App.Decks.resolveDeckByKey(key);
          return Array.isArray(arr) && arr.length > 0;
        }
        return key && window.decks && Array.isArray(window.decks[key]) && window.decks[key].length > 0;
      });
    }

    function firstForLang(lang) {
      var pref = (lang || '').toLowerCase() + '_';
      var keys = builtinKeys().filter(function (k) { return k.startsWith(pref); });
      var preferred = pref + 'verbs';
      if (keys.indexOf(preferred) !== -1) return preferred;
      return keys[0] || null;
    }

    function firstNonEmptyForLang(lang) {
      var pref = (lang || '').toLowerCase() + '_';
      var keys = builtinKeys().filter(function (k) { return k.startsWith(pref); });
      for (var i = 0; i < keys.length; i++) {
        if (deckNonEmpty(keys[i])) return keys[i];
      }
      return null;
    }

    function readSettings() {
      // Единый дефолт для UI-языка
      var uiLang   = lsGet(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'ru';
      var studyLang = lsGet(LS.studyLang) || null;
      var deckKey   = lsGet(LS.deckKey) || lsGet(LS.legacyActiveKey) || null;
      var setupDone = lsGet(LS.setupDone) === 'true';
      return {
        uiLang: (uiLang || 'ru').toLowerCase(),
        studyLang: studyLang,
        deckKey: deckKey,
        setupDone: setupDone
      };
    }

    function shouldShowSetup(initial) {
      // query-переключатель
      try { if (/(?:\?|&)setup=1(?:&|$)/.test(location.search)) return true; } catch (_) {}
      if (!initial.setupDone) return true;
      try {
        var k = initial.deckKey;
        if (k === 'fav' || k === 'favorites' || k === 'mistakes') return false;
      } catch (_) {}
      if (!deckExists(initial.deckKey)) return true;
      return false;
    }

    function validateAndFix(initial) {
      var uiLang    = initial.uiLang;
      var studyLang = initial.studyLang;
      var deckKey   = initial.deckKey;

      // синхронизируем App.settings и localStorage
      safe(function () {
        if (window.App && App.settings) App.settings.lang = uiLang;
        lsSet(LS.uiLang, uiLang);
      });

      if (deckNonEmpty(deckKey)) {
        if (!studyLang) safe(function () { studyLang = String(deckKey).split('_')[0] || studyLang; });
        return { uiLang: uiLang, studyLang: studyLang, deckKey: deckKey };
      }

      if (studyLang) {
        var first = firstForLang(studyLang);
        if (first) return { uiLang: uiLang, studyLang: studyLang, deckKey: first };
      }

      var lang = firstLang();
      var firstAny = lang && firstForLang(lang);
      if (firstAny) return { uiLang: uiLang, studyLang: lang, deckKey: firstAny };

      return { uiLang: uiLang, studyLang: null, deckKey: null };
    }

    function persist(state) {
      if (state.uiLang)   lsSet(LS.uiLang, state.uiLang);
      if (state.studyLang) lsSet(LS.studyLang, state.studyLang);
      if (state.deckKey)  { lsSet(LS.deckKey, state.deckKey); lsSet(LS.legacyActiveKey, state.deckKey); }
    }

    function applyFilters(state) {
      safe(function () { if (window.App && App.settings) App.settings.dictsLangFilter = state.studyLang || null; });
      safe(function () { if (window.App && App.dictRegistry) App.dictRegistry.activeKey = state.deckKey; });
    }

    function boot(state) {
      if (!state.deckKey) {
        // Минимальная обратная связь; в проде лучше заменить на in-app нотификацию/модалку
        alert('Нет доступных словарей для старта.');
        return;
      }
      safe(function () {
        if (window.App && typeof App.bootstrap === 'function') {
          App.bootstrap();
        }
      });
    }

    function gate() {
      var initial = readSettings();

      // Если настроек нет/нужно выбрать — показываем SetupModal
      if (shouldShowSetup(initial) && window.SetupModal && typeof SetupModal.build === 'function') {
        document.addEventListener('lexitron:setup:done', function () {
          var after = readSettings();
          var fixed = validateAndFix(after);
          persist(fixed);
          applyFilters(fixed);
          lsSet(LS.setupDone, 'true');
          boot(fixed);
        }, { once: true });
        SetupModal.build();
        return;
      }

      // Обычный путь
      var fixed = validateAndFix(initial);
      persist(fixed);
      applyFilters(fixed);
      boot(fixed);
    }

    // Публичный API
    window.StartupManager = {
      gate: gate,
      readSettings: readSettings,
      validateAndFix: validateAndFix,
      persist: persist,
      applyFilters: applyFilters,
      boot: boot,
      // экспорт вспомогательных (пригодится в тестах/отладке)
      _util: {
        builtinKeys: builtinKeys,
        firstLang: firstLang,
        deckExists: deckExists,
        deckNonEmpty: deckNonEmpty,
        firstForLang: firstForLang,
        firstNonEmptyForLang: firstNonEmptyForLang
      }
    };
  })();

  /* =================== DOMContentLoaded bootstrap =================== */

  onReady(function () {
    safe(function () {
      if (window.StartupManager && typeof StartupManager.gate === 'function') {
        StartupManager.gate();
      }
    });
  });

  /* ====================== End of file ======================= */
})();
