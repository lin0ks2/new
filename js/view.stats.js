/* ==========================================================
 * Project: MOYAMOVA
 * File: view.stats.js
 * Purpose: Страница "Статистика"
 * ========================================================== */
(function (window, document) {
  'use strict';

  const A = window.App || (window.App = {});

  // --- Helpers ---------------------------------------------------

  function getUiLang() {
    try {
      if (A.settings) {
        if (A.settings.uiLang) return A.settings.uiLang;
        if (A.settings.lang) return A.settings.lang;
      }
      const htmlLang = document.documentElement.getAttribute('lang');
      if (htmlLang) return htmlLang;
    } catch (_) {}
    return 'ru';
  }

  function posFromDeckKey(deckKey) {
    const parts = String(deckKey || '').split('_');
    return parts[1] || 'other';
  }

  function nicePosName(pos, uiLang) {
    const isUk = uiLang === 'uk';
    const mapRu = {
      nouns: 'Существительные',
      verbs: 'Глаголы',
      adj: 'Прилагательные',
      adv: 'Наречия',
      phrases: 'Фразы',
      other: 'Другое'
    };
    const mapUk = {
      nouns: 'Іменники',
      verbs: 'Дієслова',
      adj: 'Прикметники',
      adv: 'Прислівники',
      phrases: 'Фрази',
      other: 'Інше'
    };
    const dict = isUk ? mapUk : mapRu;
    return dict[pos] || pos;
  }

  function percent(part, total) {
    if (!total || total <= 0) return 0;
    return Math.round((part / total) * 100);
  }

  function degreesFromPercent(p) {
    return Math.round((p / 100) * 360);
  }

  function flagForLangBucket(langBucket) {
    const lang = langBucket.lang;
    const decks = langBucket.decks || [];

    if (A.Decks && typeof A.Decks.flagForKey === 'function' && decks.length) {
      try {
        const f = A.Decks.flagForKey(decks[0].key);
        if (f) return f;
      } catch (_) {}
    }

    const map = {
      de: '🇩🇪',
      en: '🇬🇧',
      fr: '🇫🇷',
      es: '🇪🇸',
      sr: '🇷🇸',
      ru: '🇷🇺',
      uk: '🇺🇦'
    };
    return map[lang] || lang.toUpperCase();
  }

  // --- I18N для страницы -----------------------------------------

  function getTexts() {
    const uiLang = getUiLang();
    const isUk = uiLang === 'uk';
    const fromI18n = (A.i18n && A.i18n()) || null;

    return {
      uiLang,
      title: (fromI18n && fromI18n.statsTitle) ||
        (isUk ? 'Статистика вивчення' : 'Статистика изучения'),
      learnedTotal: (fromI18n && fromI18n.statsLearnedTotal) ||
        (isUk ? 'Вивчено слів всього' : 'Выучено слов всего'),
      byLangTitle: (fromI18n && fromI18n.statsByLangTitle) ||
        (isUk ? 'За мовами' : 'По языкам'),
      posName: function (pos) { return nicePosName(pos, uiLang); },
      learnedLang: (fromI18n && fromI18n.statsLearnedLang) ||
        (isUk ? 'За цією мовою' : 'По этому языку'),
      learnedLangShort: function (learned, total) {
        return isUk
          ? ('Вивчено ' + learned + ' з ' + total + ' слів')
          : ('Выучено ' + learned + ' из ' + total + ' слов');
      },
      decksSummary: function (started, completed, totalDecks) {
        return isUk
          ? ('Словників: ' + totalDecks +
             ' • розпочато: ' + started +
             ' • завершено: ' + completed)
          : ('Словарей: ' + totalDecks +
             ' • начато: ' + started +
             ' • завершено: ' + completed);
      },
      langFilterLabel: isUk ? 'Мова тренування' : 'Язык тренировки',
      placeholderTitle: isUk ? 'Активність і якість' : 'Активность и качество',
      placeholderText: isUk
        ? 'Тут пізніше з’явиться статистика за часом у застосунку, регулярністю та якістю запам’ятовування.'
        : 'Здесь позже появится статистика по времени в приложении, регулярности и качеству запоминания.'
    };
  }

  // --- Подсчёт статистики ----------------------------------------

  function computeStats() {
    const decksApi = A.Decks;
    const trainer  = A.Trainer;
    const rawDecks = window.decks || {};

    const byLang = {};
    const globalStat = {
      totalWords: 0,
      learnedWords: 0,
      byPos: {}
    };

    if (!decksApi) {
      return { global: globalStat, byLang: [] };
    }

    // Берём реальные деки из window.decks
    const deckKeys = Object.keys(rawDecks).filter(function (k) {
      return Array.isArray(rawDecks[k]) && rawDecks[k].length;
    });

    // максимальное количество звёзд для "выучено"
    let starsMax = 5;
    if (A.Config) {
      if (typeof A.Config.starsMax === 'number') starsMax = A.Config.starsMax;
      else if (typeof A.Config.starMax === 'number') starsMax = A.Config.starMax;
    }

    deckKeys.forEach(function (deckKey) {
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
        decks: []
      });

      // тянем прогресс так же, как домашний экран
      let starsMap = {};
      try {
        if (A.Progress && typeof A.Progress.aggregateStars === 'function') {
          starsMap = A.Progress.aggregateStars(deckKey) || {};
        }
      } catch (_) {
        starsMap = {};
      }

      let deckLearned = 0;

      words.forEach(function (w) {
        langBucket.totalWords += 1;
        globalStat.totalWords += 1;

        const posBucketLang   = (langBucket.byPos[pos] = langBucket.byPos[pos] || { pos: pos, total: 0, learned: 0 });
        const posBucketGlobal = (globalStat.byPos[pos] = globalStat.byPos[pos] || { pos: pos, total: 0, learned: 0 });

        posBucketLang.total   += 1;
        posBucketGlobal.total += 1;

        // решаем, выучено ли слово
        let isLearned = false;
        const sid = String(w.id);

        if (starsMap && Object.prototype.hasOwnProperty.call(starsMap, sid)) {
          isLearned = (starsMap[sid] | 0) >= starsMax;
        } else if (trainer && typeof trainer.isLearned === 'function') {
          // запасной вариант
          try { isLearned = !!trainer.isLearned(w, deckKey); } catch (_) { isLearned = false; }
        }

        if (isLearned) {
          langBucket.learnedWords   += 1;
          globalStat.learnedWords   += 1;
          posBucketLang.learned     += 1;
          posBucketGlobal.learned   += 1;
          deckLearned               += 1;
        }
      });

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

    const langList = Object.values(byLang).sort(function (a, b) {
      return (b.learnedWords || 0) - (a.learnedWords || 0);
    });

    return {
      global: globalStat,
      byLang: langList
    };
  }

  // --- Рендер кругов ---------------------------------------------

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

  // --- Глобальный блок -------------------------------------------

  function renderGlobalSection(stat, t) {
    const total   = stat.totalWords || 0;
    const learned = stat.learnedWords || 0;

    const circleMain = renderCircle(
      t.learnedTotal,
      percent(learned, total) + '%',
      learned + ' / ' + total,
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

  // --- Блок по языкам --------------------------------------------

  function renderLangSection(langStats, t, activeLangCode) {
    if (!langStats.length) {
      return '';
    }

    const withProgress = langStats.filter(function (ls) {
      return (ls.learnedWords || 0) > 0;
    });

    const langsForFilter = withProgress.length ? withProgress : langStats;

    let activeLang = activeLangCode;
    if (!activeLang) {
      if (withProgress.length) activeLang = withProgress[0].lang;
      else activeLang = langStats[0].lang;
    }

    let switchHtml = '';
    if (langsForFilter.length > 1) {
      const chips = langsForFilter.map(function (ls) {
        const isActive = ls.lang === activeLang;
        return (
          '<button class="stats-lang-chip' + (isActive ? ' is-active' : '') + '" ' +
                  'type="button" data-lang="' + ls.lang + '">' +
            '<span class="stats-lang-chip__flag">' + flagForLangBucket(ls) + '</span>' +
            '<span class="stats-lang-chip__label">' + ls.lang.toUpperCase() + '</span>' +
          '</button>'
        );
      }).join('');

      switchHtml =
        '<div class="stats-lang-switch" aria-label="' + t.langFilterLabel + '">' +
          chips +
        '</div>';
    }

    const items = langStats.map(function (langStat) {
      const total   = langStat.totalWords || 0;
      const learned = langStat.learnedWords || 0;
      const langCode = langStat.lang;
      const isActive = langCode === activeLang;

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

      let started = 0;
      let completed = 0;
      langStat.decks.forEach(function (d) {
        if (d.learnedWords > 0) started += 1;
        if (d.totalWords > 0 && d.learnedWords >= d.totalWords) completed += 1;
      });

      return (
        '<article class="stats-lang-card' + (isActive ? ' is-active' : '') + '" data-lang="' + langCode + '">' +
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
        switchHtml +
        '<div class="stats-lang-list">' + items + '</div>' +
      '</section>'
    );
  }

  // --- Плейсхолдер для будущих метрик ----------------------------

  function renderPlaceholderSection(t) {
    return (
      '<section class="stats-section stats-section--placeholder">' +
        '<h2 class="stats-subtitle">' + t.placeholderTitle + '</h2>' +
        '<p class="stats-placeholder">' + t.placeholderText + '</p>' +
      '</section>'
    );
  }

  // --- Переключение языков по флажкам ---------------------------

  function attachLangSwitchHandlers(root) {
    const chips = root.querySelectorAll('.stats-lang-switch .stats-lang-chip');
    if (!chips.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        const lang = this.getAttribute('data-lang');

        chips.forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
        });

        const cards = root.querySelectorAll('.stats-lang-card');
        cards.forEach(function (card) {
          const cardLang = card.getAttribute('data-lang');
          card.classList.toggle('is-active', cardLang === lang);
        });
      });
    });
  }

  // --- Выбор активного языка тренировки -------------------------

  function detectActiveTrainLang(statsByLang) {
    if (!statsByLang || !statsByLang.length) return null;

    try {
      if (A.Trainer && typeof A.Trainer.getDeckKey === 'function' &&
          A.Decks && typeof A.Decks.langOfKey === 'function') {
        const dk = A.Trainer.getDeckKey();
        if (dk) {
          const lang = A.Decks.langOfKey(dk);
          if (lang && statsByLang.some(function (b) { return b.lang === lang; })) {
            return lang;
          }
        }
      }
    } catch (_) {}

    const withProgress = statsByLang.filter(function (b) {
      return (b.learnedWords || 0) > 0;
    });
    if (withProgress.length) return withProgress[0].lang;
    return statsByLang[0].lang;
  }

  // --- Публичный API --------------------------------------------

  function mount() {
    const root = document.getElementById('app');
    if (!root) return;

    const t     = getTexts();
    const stats = computeStats();
    const activeLang = detectActiveTrainLang(stats.byLang);

    const html =
      '<div class="stats-page">' +
        renderGlobalSection(stats.global, t) +
        renderLangSection(stats.byLang, t, activeLang) +
        renderPlaceholderSection(t) +
      '</div>';

    root.innerHTML = html;
    attachLangSwitchHandlers(root);
  }

  A.ViewStats = {
    mount: mount
  };

})(window, document);
