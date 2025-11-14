/* ==========================================================
 * view.stats.js — Экран "Статистика"
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});

  /* ---------------------- helpers ---------------------- */

  function getUiLang() {
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return String(s).toLowerCase() === 'uk' ? 'uk' : 'ru';
  }

  function t() {
    const uk = getUiLang() === 'uk';
    const i = (A.i18n && A.i18n()) || null;
    return {
      title: (i && i.statsTitle) || (uk ? 'Статистика' : 'Статистика'),
      coreTitle: uk ? 'Основні частини мови' : 'Основные части речи',
      otherTitle: uk ? 'Інші частини мови' : 'Другие части речи',
      activityTitle: uk ? 'Активність' : 'Активность',
      activityNoData: uk
        ? 'Ще немає даних про активність — продовжуйте тренуватися, і тут з’являться кола за днями.'
        : 'Пока нет данных об активности — продолжайте тренироваться, и здесь появятся кружки по дням.',
      placeholderTitle: uk ? 'Активність і якість' : 'Активность и качество',
      placeholderText: uk
        ? 'Тут пізніше з’явиться статистика за часом у застосунку, регулярністю та якістю запам’ятовування.'
        : 'Здесь позже появится статистика по времени в приложении, регулярности и качеству запоминания.',
      learnedLangShort: function (learned, total) {
        return uk
          ? 'Вивчено ' + learned + ' з ' + total + ' слів'
          : 'Выучено ' + learned + ' из ' + total + ' слов';
      },
      decksSummary: function (started, completed, totalDecks) {
        return uk
          ? 'Словників: ' +
              totalDecks +
              ' • розпочато: ' +
              started +
              ' • завершено: ' +
              completed
          : 'Словарей: ' +
              totalDecks +
              ' • начато: ' +
              started +
              ' • завершено: ' +
              completed;
      },
      // fallback на случай, если не нашли имя словаря
      fallbackPosName: function (pos) {
        const uk = getUiLang() === 'uk';
        const mapRu = {
          nouns: 'Существительные',
          verbs: 'Глаголы',
          adjectives: 'Прилагательные',
          adverbs: 'Наречия',
          pronouns: 'Местоимения',
          prepositions: 'Предлоги',
          conjunctions: 'Союзы',
          particles: 'Частицы',
          numbers: 'Числительные',
          other: 'Другое'
        };
        const mapUk = {
          nouns: 'Іменники',
          verbs: 'Дієслова',
          adjectives: 'Прикметники',
          adverbs: 'Прислівники',
          pronouns: 'Займенники',
          prepositions: 'Прийменники',
          conjunctions: 'Сполучники',
          particles: 'Частки',
          numbers: 'Числівники',
          other: 'Інше'
        };
        const dict = uk ? mapUk : mapRu;
        return dict[pos] || pos;
      }
    };
  }

  function posFromDeckKey(deckKey) {
    const parts = String(deckKey || '').split('_');
    return parts[1] || 'other';
  }

  function percent(part, total) {
    if (!total || total <= 0) return 0;
    return Math.round((part / total) * 100);
  }

  function degreesFromPercent(p) {
    return Math.round((p / 100) * 360);
  }

  /* основные/прочие части речи и их "цвета" */
  const CORE_POS = ['verbs', 'nouns', 'adjectives'];
  const OTHER_POS_ORDER = [
    'adverbs',
    'pronouns',
    'prepositions',
    'conjunctions',
    'particles',
    'numbers',
    'other'
  ];

  const POS_COLORS = {
    verbs: 'var(--stats-color-verbs, #0ea5e9)',
    nouns: 'var(--stats-color-nouns, #6366f1)',
    adjectives: 'var(--stats-color-adj, #f97316)',
    adverbs: 'var(--stats-color-adv, #22c55e)',
    pronouns: 'var(--stats-color-pron, #ec4899)',
    prepositions: 'var(--stats-color-prep, #eab308)',
    conjunctions: 'var(--stats-color-conj, #8b5cf6)',
    particles: 'var(--stats-color-part, #14b8a6)',
    numbers: 'var(--stats-color-num, #f59e0b)',
    other: 'var(--stats-color-other, #9ca3af)'
  };

  /* ------------ ключевой момент: откуда берём "выучено" --------- */

  function isWordLearned(word, deckKey) {
    const trainer = A.Trainer;
    // 1) Основной путь — через state.stars + App.starKey (как в app.decks.js)
    try {
      if (
        A.state &&
        A.state.stars &&
        typeof A.starKey === 'function' &&
        trainer &&
        typeof trainer.starsMax === 'function'
      ) {
        const sMax = trainer.starsMax();
        const starsMap = A.state.stars || {};
        const sk = A.starKey(word.id, deckKey);
        const raw = starsMap[sk] || 0;
        const sc = Math.max(0, Math.min(sMax, raw));
        return sc >= sMax;
      }
    } catch (e) {
      // пойдём в запасной путь
    }

    // 2) Безопасный фоллбэк — доверяем Trainer.isLearned, если он есть
    try {
      if (trainer && typeof trainer.isLearned === 'function') {
        return !!trainer.isLearned(word, deckKey);
      }
    } catch (e) {}

    // 3) Если ничего нет — считаем слово невыученным (иначе будет "всё выучено")
    return false;
  }

  /* ---------------------- подсчёт статистики ---------------------- */

  function computeStats() {
    const decksApi = A.Decks;
    const rawDecks = window.decks || {};
    const byLang = {};
    const langOrder = [];

    if (!decksApi) {
      return { byLang: [] };
    }

    let deckKeys = [];
    if (typeof decksApi.builtinKeys === 'function') {
      deckKeys = decksApi.builtinKeys() || [];
    } else {
      deckKeys = Object.keys(rawDecks).filter(function (k) {
        return Array.isArray(rawDecks[k]) && rawDecks[k].length;
      });
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

      let langBucket = byLang[lang];
      if (!langBucket) {
        langBucket = byLang[lang] = {
          lang: lang,
          totalWords: 0,
          learnedWords: 0,
          byPos: {}, // pos -> { pos, total, learned, sampleDeckKey }
          decks: []  // [{ key, name, totalWords, learnedWords }]
        };
        langOrder.push(lang);
      }

      let deckLearned = 0;

      words.forEach(function (w) {
        langBucket.totalWords += 1;

        const posBucket =
          (langBucket.byPos[pos] =
            langBucket.byPos[pos] || {
              pos: pos,
              total: 0,
              learned: 0,
              sampleDeckKey: deckKey
            });

        posBucket.total += 1;

        if (isWordLearned(w, deckKey)) {
          langBucket.learnedWords += 1;
          posBucket.learned += 1;
          deckLearned += 1;
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

    const langList = langOrder.map(function (lang) {
      return byLang[lang];
    });

    return { byLang: langList };
  }

  /* ---------------------- labels из словарей ---------------------- */

  function resolvePosLabel(posBucket, texts) {
    const decksApi = A.Decks;
    let label = '';

    if (
      posBucket.sampleDeckKey &&
      decksApi &&
      typeof decksApi.resolveNameByKey === 'function'
    ) {
      try {
        label = decksApi.resolveNameByKey(posBucket.sampleDeckKey) || '';
      } catch (_) {
        label = '';
      }
    }
    if (!label) {
      label = texts.fallbackPosName(posBucket.pos || '');
    }
    return label;
  }

  /* ---------------------- nested rings ---------------------- */

  function splitPosBuckets(langStat) {
    const core = [];
    const other = [];

    Object.keys(langStat.byPos || {}).forEach(function (pos) {
      const bucket = langStat.byPos[pos];
      if (CORE_POS.indexOf(pos) !== -1) core.push(bucket);
      else other.push(bucket);
    });

    core.sort(function (a, b) {
      return CORE_POS.indexOf(a.pos) - CORE_POS.indexOf(b.pos);
    });

    other.sort(function (a, b) {
      return OTHER_POS_ORDER.indexOf(a.pos) - OTHER_POS_ORDER.indexOf(b.pos);
    });

    return { core: core, other: other };
  }

  function renderRingSet(buckets, texts, groupKind) {
    if (!buckets || !buckets.length) return '';

    const ringCount = buckets.length;

    const layersHtml = buckets
      .map(function (bucket, idx) {
        const p = percent(bucket.learned, bucket.total);
        const angle = degreesFromPercent(p);
        const scale = ringCount === 1 ? 1 : 1 - idx * 0.18; // 1, 0.82, 0.64...
        const color = POS_COLORS[bucket.pos] || POS_COLORS.other;

        return (
          '<div class="stats-ring-layer" ' +
          'style="--ring-angle:' +
          angle +
          'deg;--ring-scale:' +
          scale +
          ';--ring-color:' +
          color +
          ';">' +
          '<div class="stats-ring-layer__ring"></div>' +
          '</div>'
        );
      })
      .join('');

    const legendHtml = buckets
      .map(function (bucket) {
        const color = POS_COLORS[bucket.pos] || POS_COLORS.other;
        const label = resolvePosLabel(bucket, texts);
        const val = bucket.learned + ' / ' + bucket.total; // без процентов
        return (
          '<div class="stats-ring-legend__item" style="--ring-color:' +
          color +
          ';">' +
          '<span class="stats-ring-legend__dot"></span>' +
          '<span class="stats-ring-legend__label">' +
          label +
          '</span>' +
          '<span class="stats-ring-legend__value">' +
          val +
          '</span>' +
          '</div>'
        );
      })
      .join('');

    const caption = groupKind === 'core' ? texts.coreTitle : texts.otherTitle;

    return (
      '<div class="stats-ring-set stats-ring-set--' +
      groupKind +
      '">' +
      '<div class="stats-ring-set__circle">' +
      '<div class="stats-ring-set__caption">' +
      caption +
      '</div>' +
      '<div class="stats-ring-set__circle-inner">' +
      layersHtml +
      '</div>' +
      '</div>' +
      '<div class="stats-ring-legend">' +
      legendHtml +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------- АКТИВНОСТЬ (круглые точки) ----------- */

  // Ожидаемый формат, если когда-нибудь реализуем:
  // App.Stats.getDailyActivity(lang) -> [
  //   { date: '2025-11-10', learned: 12, reviewed: 40, seconds: 600 },
  //   ...
  // ]
  function getDailyActivitySeries(lang) {
    try {
      if (A.Stats && typeof A.Stats.getDailyActivity === 'function') {
        var arr = A.Stats.getDailyActivity(lang) || [];
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  }

  function renderActivitySection(langCode, texts) {
    var series = getDailyActivitySeries(langCode);
    if (!series.length) {
      return (
        '<section class="stats-section stats-section--activity">' +
          '<h2 class="stats-subtitle">' + texts.activityTitle + '</h2>' +
          '<p class="stats-placeholder stats-placeholder--activity">' +
            texts.activityNoData +
          '</p>' +
        '</section>'
      );
    }

    // Превращаем метрики в «интенсивность» точки
    var scores = series.map(function (d) {
      var learned  = Number(d.learned  || 0);
      var reviewed = Number(d.reviewed || 0);
      var seconds  = Number(d.seconds  || 0);
      // простая эвристика: учёт, повторения и время
      return learned * 4 + reviewed * 1 + seconds / 60;
    });

    var max = scores.reduce(function (m, v) { return v > m ? v : m; }, 0);
    if (max <= 0) {
      // есть записи, но всё нули — считаем как «есть, но слабая активность»
      max = 1;
    }

    var dotsHtml = series
      .map(function (d, idx) {
        var s = scores[idx];
        var ratio = s / max;
        var lvl = 0;
        if      (ratio >= 0.75) lvl = 3;
        else if (ratio >= 0.5)  lvl = 2;
        else if (ratio >= 0.25) lvl = 1;
        else lvl = 0;

        var title =
          (d.date || '') +
          (d.learned || d.reviewed || d.seconds
            ? (' — +' + (d.learned || 0) + ' / ' + (d.reviewed || 0) + ' / ' + Math.round((d.seconds || 0) / 60) + ' мин')
            : '');

        return (
          '<div class="stats-activity-dot stats-activity-dot--lvl' + lvl + '"' +
            (title ? ' title="' + title.replace(/"/g, '&quot;') + '"' : '') +
          '></div>'
        );
      })
      .join('');

    return (
      '<section class="stats-section stats-section--activity">' +
        '<h2 class="stats-subtitle">' + texts.activityTitle + '</h2>' +
        '<div class="stats-activity-grid">' + dotsHtml + '</div>' +
      '</section>'
    );
  }

  /* ---------------------- карточки по языкам ---------------------- */

  function renderLangCards(langStats, texts, activeLangCode) {
    if (!langStats.length) {
      return '<p class="stats-placeholder">—</p>';
    }

    var activeLang = activeLangCode || langStats[0].lang;

    const items = langStats
      .map(function (langStat) {
        const total = langStat.totalWords || 0;
        const learned = langStat.learnedWords || 0;
        const langCode = langStat.lang;
        const isActive = langCode === activeLang;

        let started = 0;
        let completed = 0;
        langStat.decks.forEach(function (d) {
          if (d.learnedWords > 0) started += 1;
          if (d.totalWords > 0 && d.learnedWords >= d.totalWords) completed += 1;
        });

        const split = splitPosBuckets(langStat);
        const coreSetHtml = renderRingSet(split.core, texts, 'core');
        const otherSetHtml = renderRingSet(split.other, texts, 'other');
        const activityHtml = renderActivitySection(langCode, texts);

        return (
          '<article class="stats-lang-card' +
          (isActive ? ' is-active' : '') +
          '" data-lang="' +
          langCode +
          '">' +
          '<header class="stats-lang-card__header">' +
          '<div class="stats-lang-card__title">' +
          '<span class="stats-lang-card__meta">' +
          texts.learnedLangShort(learned, total) +
          '</span>' +
          '</div>' +
          '<div class="stats-lang-card__decks">' +
          texts.decksSummary(started, completed, langStat.decks.length) +
          '</div>' +
          '</header>' +
          '<div class="stats-lang-card__body">' +
          '<div class="stats-ring-sets">' +
          coreSetHtml +
          otherSetHtml +
          '</div>' +
          activityHtml +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    return '<div class="stats-lang-list">' + items + '</div>';
  }

  /* ---------------------- плейсхолдер ---------------------- */

  function renderPlaceholderSection(texts) {
    return (
      '<section class="stats-section stats-section--placeholder">' +
      '<h2 class="stats-subtitle">' +
      texts.placeholderTitle +
      '</h2>' +
      '<p class="stats-placeholder">' +
      texts.placeholderText +
      '</p>' +
      '</section>'
    );
  }

  /* ---------------------- флаги (как в Словарях) ------------ */

  function setupLangFlags(root, langStats, activeLangInitial) {
    const box = root.querySelector('#stats-flags');
    if (!box || !langStats.length) return;

    const langs = langStats.map(function (ls) {
      return ls.lang;
    });
    let activeLang =
      activeLangInitial && langs.indexOf(activeLangInitial) !== -1
        ? activeLangInitial
        : langs[0];

    const FLAG = {
      en: '🇬🇧',
      de: '🇩🇪',
      fr: '🇫🇷',
      es: '🇪🇸',
      it: '🇮🇹',
      ru: '🇷🇺',
      uk: '🇺🇦',
      sr: '🇷🇸',
      pl: '🇵🇱'
    };

    function applyActive(lang) {
      activeLang = lang;

      box.querySelectorAll('.dict-flag').forEach(function (b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });

      root.querySelectorAll('.stats-lang-card').forEach(function (card) {
        const cl = card.getAttribute('data-lang');
        card.classList.toggle('is-active', cl === lang);
      });

      try {
        A.settings = A.settings || {};
        A.settings.statsLang = lang;
      } catch (_) {}
    }

    box.innerHTML = '';
    langs.forEach(function (lang) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dict-flag' + (lang === activeLang ? ' active' : '');
      btn.dataset.lang = lang;
      btn.title = lang.toUpperCase();
      btn.textContent = FLAG[lang] || lang.toUpperCase();
      btn.addEventListener('click', function () {
        if (lang === activeLang) return;
        applyActive(lang);
      });
      box.appendChild(btn);
    });

    applyActive(activeLang);
  }

  /* ---------------------- выбор активного языка ------------ */

  function detectActiveTrainLang(statsByLang) {
    if (!statsByLang || !statsByLang.length) return null;

    try {
      if (
        A.settings &&
        A.settings.statsLang &&
        statsByLang.some(function (b) {
          return b.lang === A.settings.statsLang;
        })
      ) {
        return A.settings.statsLang;
      }
    } catch (_) {}

    try {
      if (
        A.Trainer &&
        typeof A.Trainer.getDeckKey === 'function' &&
        A.Decks &&
        typeof A.Decks.langOfKey === 'function'
      ) {
        const dk = A.Trainer.getDeckKey();
        if (dk) {
          const lang = A.Decks.langOfKey(dk);
          if (
            lang &&
            statsByLang.some(function (b) {
              return b.lang === lang;
            })
          ) {
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

  /* ---------------------- mount() ---------------------- */

  function mount() {
    const app = document.getElementById('app');
    if (!app) return;

    const texts = t();
    const stats = computeStats();
    const activeLang = detectActiveTrainLang(stats.byLang);

    const cardsHtml = renderLangCards(stats.byLang, texts, activeLang);

    const html =
      '<div class="home">' +
      '<section class="card dicts-card stats-card">' +
      '<div class="dicts-header">' +
      '<h3>' +
      texts.title +
      '</h3>' +
      '<div id="stats-flags" class="dicts-flags"></div>' +
      '</div>' +
      cardsHtml +
      '</section>' +
      renderPlaceholderSection(texts) +
      '</div>';

    app.innerHTML = html;
    setupLangFlags(app, stats.byLang, activeLang);
  }

  A.ViewStats = {
    mount: mount
  };
})();
