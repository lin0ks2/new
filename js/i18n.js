/* ==========================================================
 * Project: MOYAMOVA
 * File: i18n.js
 * Purpose: Локализация (RU/UK), без EN
 * Version: 1.1
 * Last modified: (rebuilt, fixed)
 */

(function () {
  'use strict';

  // ------------------------------------------------------------
  // Словари
  // ------------------------------------------------------------
  window.I18N = {
    ru: {
      // === auto: donate ===
      donateTitle: "Поддержать проект",
      donateLegalNote: "Ваше пожертвование является добровольным и не является оплатой товаров или услуг.",
      donateMonoTitle: "Поддержать через Monobank",
      donateMonoOpen: "Открыть Monobank",
      donatePaypalTitle: "Поддержать через PayPal",
      donatePaypalOpen: "Открыть PayPal",
      donateThanks: "Каждый донат помогает нам развивать MOYAMOVA — добавлять новые функции и словари, улучшать обучение и сохранять приложение свободным от рекламы. Спасибо за вашу поддержку!",
      ariaBack: "Назад",
      ariaClose: "Закрыть",
      ariaDicts: "Словари",
      ariaFav: "Избранное",
      ariaGuide: "Инструкция",
      ariaHome: "Главная",
      ariaMenu: "Меню",
      ariaMistakes: "Мои ошибки",
      ariaStats: "Статистика",
      btnCheckUpdates: "Проверить обновления",
      btnExport: "Экспорт",
      btnImport: "Импорт",
      menuAppVersion: "Версия приложения",
      menuBackup: "Резервное копирование",
      menuLevel: "Режим сложности",
      menuTheme: "Тема",
      menuUiLang: "Язык интерфейса",
      menuUpdates: "Обновления",
      legalTerms: "Условия",
      legalPrivacy: "Конфиденциальность",
      legalImpressum: "Юридическая информация",
    },
    uk: {
      // === auto: donate ===
      donateTitle: "Підтримати проєкт",
      donateLegalNote: "Ваш донат є добровільним і не є оплатою товарів чи послуг.",
      donateMonoTitle: "Підтримати через Monobank",
      donateMonoOpen: "Відкрити Monobank",
      donatePaypalTitle: "Підтримати через PayPal",
      donatePaypalOpen: "Відкрити PayPal",
      donateThanks: "Кожен донат допомагає нам розвивати MOYAMOVA — додавати нові функції та словники, покращувати навчання і зберігати застосунок вільним від реклами. Дякуємо за вашу підтримку!",
      ariaBack: "Назад",
      ariaClose: "Закрити",
      ariaDicts: "Словники",
      ariaFav: "Вибране",
      ariaGuide: "Інструкція",
      ariaHome: "Головна",
      ariaMenu: "Меню",
      ariaMistakes: "Мої помилки",
      ariaStats: "Статистика",
      btnCheckUpdates: "Перевірити оновлення",
      btnExport: "Експорт",
      btnImport: "Імпорт",
      menuAppVersion: "Версія застосунку",
      menuBackup: "Резервне копіювання",
      menuLevel: "Режим складності",
      menuTheme: "Тема",
      menuUiLang: "Мова інтерфейсу",
      menuUpdates: "Оновлення",
      legalTerms: "Умови",
      legalPrivacy: "Конфіденційність",
      legalImpressum: "Юридична інформація",
    }
  };

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  window.I18N_getLang = function () {
    try {
      const A = window.App || {};
      const l =
        (A.settings && (A.settings.lang || A.settings.uiLang)) ||
        document.documentElement.getAttribute('lang') ||
        'ru';
      return String(l).toLowerCase() === 'uk' ? 'uk' : 'ru';
    } catch (_) {
      return 'ru';
    }
  };

  window.I18N_t = function (key) {
    const lang = window.I18N_getLang();
    try {
      const dict = (window.I18N && window.I18N[lang]) || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) return String(dict[key]);
    } catch (_) {}
    try {
      const dict = (window.I18N && window.I18N['ru']) || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) return String(dict[key]);
    } catch (_) {}
    return key;
  };

  window.applyI18n = function (scope) {
    const root = scope || document;
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      const k = el.getAttribute('data-i18n');
      if (!k) return;
      const val = window.I18N_t(k);
      if (val !== k) el.textContent = val;
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      const k = el.getAttribute('data-i18n-aria');
      if (!k) return;
      const val = window.I18N_t(k);
      if (val !== k) el.setAttribute('aria-label', val);
    });
  };

  // ------------------------------------------------------------
  // Первичные события
  // ------------------------------------------------------------
  try {
    document.addEventListener('DOMContentLoaded', function () {
      try { window.applyI18n(); } catch (_) {}
    });
    window.addEventListener('lexitron:ui-lang-changed', function () {
      try { window.applyI18n(); } catch (_) {}
    });
    document.addEventListener('lexitron:ui-lang-changed', function () {
      try { window.applyI18n(); } catch (_) {}
    });
  } catch (_) {}

  // --- дополнительное применение перевода после полной инициализации ---
  setTimeout(function () {
    try { window.applyI18n(document); } catch (_) {}
  }, 500);

  // ------------------------------------------------------------
  // 🔄 Автоматическое применение перевода к новым элементам DOM
  // ------------------------------------------------------------
  (function enableAutoI18n() {
    if (!('MutationObserver' in window)) return;

    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue; // только элементы
          if (
            node.hasAttribute('data-i18n') ||
            node.hasAttribute('data-i18n-aria') ||
            node.querySelector('[data-i18n], [data-i18n-aria]')
          ) {
            try {
              window.applyI18n && window.applyI18n(node);
            } catch (err) {
              console.warn('Auto-i18n failed:', err);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.info('✅ Auto-i18n observer active');
  })();

})(); // 🔸 Закрывает главный (function(){ ... }) блок i18n.js
