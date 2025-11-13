/* ==========================================================
 * Project: MOYAMOVA
 * File: view.stats.js
 * Purpose: Страница "Статистика"
 * ========================================================== */
(function (window, document) {
  'use strict';

  const A = window.App || (window.App = {});

  // --- Вспомогательные функции -----------------------------------

  function posFromDeckKey(deckKey) {
    // ожидаем форматы типа "de_nouns", "en_verbs" и т.п.
    const parts = String(deckKey || '').split('_');
    return parts[1] || 'other';
  }

  function nicePosName(pos, lang) {
    // можно локализовать через i18n, пока — грубый маппинг
    const mapRu = {
      nouns: 'Существительные',
      verbs: 'Глаголы',
      adj: 'Прилагательные',
      adv: 'Наречия',
      phrases: 'Фразы',
      other: 'Другое'
    };
    return mapRu[pos] || pos;
  }

  function percent(part, total) {
    if (!total || total <= 0) return 0;
    return Math.round((part / total) * 100);
  }

  function degreesFromPercent(p) {
    // 0–100 → 0–360deg
    return Math.round((p / 100) * 360);
  }

  // --- Подсчёт статистики ----------------------------------------

  function computeStats() {
    const decksApi = A.Decks;
    const trainer = A.Trainer;

    const byLang = {};   // { lang: { totalWords, learnedWords, byPos:{pos:{total,learned}}, decks:[...] } }
    const globalStat = {
      totalWords: 0,
      learnedWords: 0,
      byPos: {} // { pos: { total, learned } }
    };

    if (!decksApi || !decksApi.resolveDeckByKey) {
      return { global: globalStat, byLang: {} };
    }

    const dictRegistry = A.dictRegistry || {};
    const knownDeckKeys = dictRegistry.availableKeys || Object.keys(window.decks || {});

    knownDeckKeys.forEach(function (deckKey) {
      if (!deckKey) return;

      let lang;
      try {
        lang = decksApi.langOfKey(deckKey);
      } catch (_) {
        return;
      }
      if (!lang) return;

      const words = decksApi.resolveDeckByKey(deckKey) || [];
      if (!words.length) return;

      const pos = posFromDeckKey(deckKey);
      const langBucket = (byLang[lang] = byLang[lang] || {
        lang: lang,
        totalWords: 0,
        learnedWords: 0,
        byPos: {},
        decks: [] // { key, name, totalWords, learnedWords }
      });

      let deckLearned = 0;

      words.forEach(function (w) {
        langBucket.totalWords += 1;
        globalStat.totalWords += 1;

        const posBucketLang = (langBucket.byPos[pos] = langBucket.byPos[pos] || { pos, total: 0, learned: 0 });
        const posBucketGlobal = (globalStat.byPos[pos] = globalStat.byPos[pos] || { pos, total: 0, learned: 0 });

        posBucketLang.total += 1;
        posBucketGlobal.total += 1;

        let isLearned = false;
        try {
          if (trainer && typeof trainer.isLearned === 'function') {
            isLearned = !!trainer.isLearned(w, deckKey);
          }
        } catch (_) {}

        if (isLearned) {
          langBucket.learnedWords += 1;
          globalStat.learnedWords += 1;
          posBucketLang.learned += 1;
          posBucketGlobal.learned += 1;
          deckLearned += 1;
        }
      });

      // инфо по словарю
      let deckName = '';
      try {
        deckName = decksApi.resolveNameByKey(deckKey) || deckKey;
      } catch (_) {
        deckName = deckKey;
      }

      langBucket.decks.push({
        key: deckKey,
        name: deckName,
        totalWords: words.length,
        learnedWords: deckLearned
      });
    });

    // сортируем языки по количеству выученных слов
    const langList = Object.values(byLang).sort(function (a, b) {
      return (b.learnedWords || 0) - (a.learnedWords || 0);
    });

    return {
      global: globalStat,
      byLang: langList
    };
  }

  // --- Рендер круговых диаграмм ----------------------------------

  function renderCircle(label, primaryText, subText, part, total) {
    const p = percent(part, total);
    const angle = degreesFromPercent(p);
    return (
      '<div class="stats-circle" style="--stats-angle:' + angle + 'deg;">' +
        '<div class="stats-circle__ring"></div>' +
        '<div class="stats-circle__inner">' +
          '<div class="stats-circle__primary">' + primaryText + '</div>' +
          (subText ? '<div class="stats-circle__sub">' + subText + '</div>' : '') +
          '<div class="stats-circle__label">' + label + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // --- Рендер глобального блока ----------------------------------

  function renderGlobalSection(stat, t) {
    const total = stat.totalWords || 0;
    const learned = stat.learnedWords || 0;

    const circleMain = renderCircle(
      t.learnedTotal,
      percent(learned, total) + '%',
      learned + ' из ' + total,
      learned,
      total
    );

    const posCircles = Object.keys(stat.byPos).map(function (pos) {
      const bucket = stat.byPos[pos];
      const lbl = t.posName(pos);
      return (
        '<div class="stats-grid__item">' +
          renderCircle(
            lbl,
            bucket.learned + ' / ' + bucket.total,
            percent(bucket.learned, bucket.total) + '%',
            bucket.learned,
            bucket.total
          ) +
        '</div>'
      );
    }).join('');

    return (
      '<section class="stats-section stats-section--global">' +
        '<h1 class="stats-title">' + t.title + '</h1>' +
        '<div class="stats-hero">' +
          '<div class="stats-hero__main">' + circleMain + '</div>' +
          '<div class="stats-hero__grid">' + posCircles + '</div>' +
        '</div>' +
      '</section>'
    );
  }

  // --- Рендер блока "по языкам" ----------------------------------

  function renderLangSection(langStats, t) {
    const items = langStats.map(function (langStat) {
      const total = langStat.totalWords || 0;
      const learned = langStat.learnedWords || 0;
      const langCode = langStat.lang;

      const posCircles = Object.keys(langStat.byPos).map(function (pos) {
        const bucket = langStat.byPos[pos];
        return (
          '<div class="stats-grid__item">' +
            renderCircle(
              t.posName(pos),
              bucket.learned + ' / ' + bucket.total,
              percent(bucket.learned, bucket.total) + '%',
              bucket.learned,
              bucket.total
            ) +
          '</div>'
        );
      }).join('');

      // словари: сколько начато (learned>0), сколько полностью пройдено
      let started = 0;
      let completed = 0;
      langStat.decks.forEach(function (d) {
        if (d.learnedWords > 0) started += 1;
        if (d.learnedWords >= d.totalWords && d.totalWords > 0) completed += 1;
      });

      return (
        '<article class="stats-lang-card">' +
          '<header class="stats-lang-card__header">' +
            '<div class="stats-lang-card__title">' +
              '<span class="stats-lang-card__lang">' + langCode.toUpperCase() + '</span>' +
              '<span class="stats-lang-card__meta">' +
                t.learnedLangShort(learned, total) +
              '</span>' +
            '</div>' +
            '<div class="stats-lang-card__decks">' +
              t.decksSummary(started, completed, langStat.decks.length) +
            '</div>' +
          '</header>' +

          '<div class="stats-lang-card__body">' +
            '<div class="stats-lang-card__main-circle">' +
              renderCircle(
                t.learnedLang,
                percent(learned, total) + '%',
                learned + ' / ' + total,
                learned,
                total
              ) +
            '</div>' +
            '<div class="stats-lang-card__grid">' + posCircles + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    return (
      '<section class="stats-section stats-section--langs">' +
        '<h2 class="stats-subtitle">' + t.byLangTitle + '</h2>' +
        '<div class="stats-lang-list">' + items + '</div>' +
      '</section>'
    );
  }

  // --- Локальная "i18n" для страницы статистики ------------------

  function getTexts() {
    // можно потом подвязать на App.i18n, пока — простой варик
    return {
      title: 'Статистика изучения',
      learnedTotal: 'Выучено слов всего',
      byLangTitle: 'По языкам',
      posName: function (pos) { return nicePosName(pos); },
      learnedLang: 'По этому языку',
      learnedLangShort: function (learned, total) {
        return 'Выучено ' + learned + ' из ' + total + ' слов';
      },
      decksSummary: function (started, completed, totalDecks) {
        return 'Словарей: ' + totalDecks +
               ' • начато: ' + started +
               ' • завершено: ' + completed;
      }
    };
  }

  // --- Публичный API представления -------------------------------

  function mount() {
    const root = document.getElementById('app');
    if (!root) return;

    const t = getTexts();
    const stats = computeStats();

    const html =
      '<div class="stats-page">' +
        renderGlobalSection(stats.global, t) +
        renderLangSection(stats.byLang, t) +
        // пока просто плейсхолдер под будущие блоки по времени, качеству и т.п.
        '<section class="stats-section stats-section--placeholder">' +
          '<h2 class="stats-subtitle">Активность и качество</h2>' +
          '<p class="stats-placeholder">' +
            'Здесь позже появится статистика по времени в приложении, регулярности и качеству запоминания.' +
          '</p>' +
        '</section>' +
      '</div>';

    root.innerHTML = html;
  }

  A.ViewStats = {
    mount: mount
  };

})(window, document);
