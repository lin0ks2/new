/* ==========================================================
 * view.stats.js — Экран "Статистика"
 * ========================================================== */
(function () {
  'use strict';
  const A = (window.App = window.App || {});

  /* ---------------------- helpers ---------------------- */

  function getUiLang() {
    const s = (A.settings && (A.settings.lang || A.settings.uiLang)) || 'ru';
    return (String(s).toLowerCase() === 'uk') ? 'uk' : 'ru';
  }

  function t() {
    const uk = getUiLang() === 'uk';
    const i = (A.i18n && A.i18n()) || null;
    return {
      title: (i && i.statsTitle) || (uk ? 'Статистика вивчення' : 'Статистика изучения'),
      byLangTitle: (i && i.statsByLangTitle) || (uk ? 'За мовами' : 'По языкам'),
      fallbackPosName: function (pos) {
        const mapRu = {
          nouns: 'Существительные',
          verbs: 'Глаголы',
          adj: 'Прилагательные',
          adjectives: 'Прилагательные',
          adv: 'Наречия',
          adverbs: 'Наречия',
          particles: 'Частицы',
          pronouns: 'Местоимения',
          numbers: 'Числительные',
          phrases: 'Фразы',
          other: 'Другое'
        };
        const mapUk = {
          nouns: 'Іменники',
          verbs: 'Дієслова',
          adj: 'Прикметники',
          adjectives: 'Прикметники',
          adv: 'Прислівники',
          adverbs: 'Прислівники',
          particles: 'Частки',
          pronouns: 'Займенники',
          numbers: 'Числівники',
          phrases: 'Фрази',
          other: 'Інше'
        };
        const dict = uk ? mapUk : mapRu;
        return dict[pos] || pos;
      },
      learnedLangShort: function (learned, total) {
        return uk
          ? ('Вивчено ' + learned + ' з ' + total + ' слів')
          : ('Выучено ' + learned + ' из ' + total + ' слов');
      },
      decksSummary: function (started, completed, totalDecks) {
        return uk
          ? ('Словників: ' + totalDecks +
             ' • розпочато: ' + started +
             ' • завершено: ' + completed)
          : ('Словарей: ' + totalDecks +
             ' • начато: ' + started +
             ' • завершено: ' + completed);
      },
      placeholderTitle: uk ? 'Активність і якість' : 'Активность и качество',
      placeholderText: uk
        ? 'Тут пізніше з’явиться статистика за часом у застосунку, регулярністю та якістю запам’ятовування.'
        : 'Здесь позже появится статистика по времени в приложении, регулярности и качеству запоминания.'
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

  function flagForLangBucket(langBucket) {
    const lang  = langBucket.lang;
    const decks = langBucket.decks || [];

    if (A.Decks && typeof A.Decks.flagForKey === 'function' && decks.length) {
      try {
        const f = A.Decks.flagForKey(decks[0].key);
        if (f) return f;
      } catch (_) {}
    }

    // запасной вариант — как в view.dicts.js
    const FLAG = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', ru:'🇷🇺', uk:'🇺🇦', sr:'🇷🇸', pl:'🇵🇱' };
    return FLAG[lang] || lang.toUpperCase();
  }

  /* ---------------------- подсчёт статистики ---------------------- */

  function computeStats() {
    const decksApi = A.Decks;
    const trainer  = A.Trainer;
    const rawDecks = window.decks || {};

    const byLang = {}; // lang -> bucket

    if (!decksApi) {
      return { byLang: [] };
    }

    const deckKeys = Object.keys(rawDecks).filter(function (k) {
      return Array.isArray(rawDecks[k]) && rawDecks[k].length;
    });

    deckKeys.forEach(function (deckKey) {
      let lang;
      try {
        lang = decksApi.langOfKey(deckKey);
      } catch (_) { return; }
      if (!lang) return;

      const words = decksApi.resolveDeckByKey(deckKey) || [];
      if (!words.length) return;

      const pos = posFromDeckKey(deckKey);

      const langBucket = (byLang[lang] = byLang[lang] || {
        lang: lang,
        totalWords: 0,
        learnedWords: 0,
        byPos: {},   // pos -> { pos, total, learned, sampleDeckKey }
        decks: []    // [{ key, name, totalWords, learnedWords }]
      });

      let deckLearned = 0;

      words.forEach(function (w) {
        langBucket.totalWords += 1;

        const posBucket = (langBucket.byPos[pos] = langBucket.byPos[pos] || {
          pos: pos,
          total: 0,
          learned: 0,
          sampleDeckKey: deckKey
        });

        posBucket.total += 1;

        let isLearned = false;
        if (trainer && typeof trainer.isLearned === 'function') {
          try {
            isLearned = !!trainer.isLearned(w, deckKey);
          } catch (_) {
            isLearned = false;
          }
        }

        if (isLearned) {
          langBucket.learnedWords += 1;
          posBucket.learned       += 1;
          deckLearned             += 1;
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

    return { byLang: langList };
  }

  /* ---------------------- рендер кругов ---------------------- */

  function renderCircle(label, primaryText, subText, part, total) {
    const p     = percent(part, total);
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

  /* ---------------------- блок по языкам ---------------------- */

  function resolvePosLabel(posBucket, texts) {
    const decksApi = A.Decks;
    let label = '';

    if (posBucket.sampleDeckKey && decksApi && typeof decksApi.resolveNameByKey === 'function') {
      try {
        label = decksApi.resolveNameByKey(posBucket.sampleDeckKey) || '';
      } catch (_) { label = ''; }
    }
    if (!label) {
      label = texts.fallbackPosName(posBucket.pos || '');
    }
    return label;
  }

  function renderLangCards(langStats, texts, activeLangCode) {
    if (!langStats.length) {
      return '<p class="stats-placeholder">—</p>';
    }

    let activeLang = activeLangCode || langStats[0].lang;

    const items = langStats.map(function (langStat) {
      const total    = langStat.totalWords || 0;
      const learned  = langStat.learnedWords || 0;
      const langCode = langStat.lang;
      const isActive = langCode === activeLang;

      const posCircles = Object.keys(langStat.byPos).map(function (pos) {
        const bucket = langStat.byPos[pos];
        const label  = resolvePosLabel(bucket, texts);
        return (
          '<div class="stats-grid__item">' +
            renderCircle(
              label,
              bucket.learned + ' / ' + bucket.total,
              percent(bucket.learned, bucket.total) + '%',
              bucket.learned,
              bucket.total
            ) +
          '</div>'
        );
      }).join('');

      let started   = 0;
      let completed = 0;
      langStat.decks.forEach(function (d) {
        if (d.learnedWords > 0) started += 1;
        if (d.totalWords > 0 && d.learnedWords >= d.totalWords) completed += 1;
      });

      // ВАЖНО: здесь убираем код языка (DE/EN/...) в заголовке карточки
      return (
        '<article class="stats-lang-card' + (isActive ? ' is-active' : '') + '" data-lang="' + langCode + '">' +
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
            '<div class="stats-lang-card__grid">' + posCircles + '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    return '<div class="stats-lang-list">' + items + '</div>';
  }

  /* ---------------------- плейсхолдер ---------------------- */

  function renderPlaceholderSection(texts) {
    return (
      '<section class="stats-section stats-section--placeholder">' +
        '<h2 class="stats-subtitle">' + texts.placeholderTitle + '</h2>' +
        '<p class="stats-placeholder">' + texts.placeholderText + '</p>' +
      '</section>'
    );
  }

  /* ---------------------- флаги (как в Словарях) ------------ */

  function setupLangFlags(root, langStats, activeLangInitial) {
    const box = root.querySelector('#stats-flags');
    if (!box || !langStats.length) return;

    const langs = langStats.map(function (ls) { return ls.lang; });
    let activeLang = activeLangInitial && langs.indexOf(activeLangInitial) !== -1
      ? activeLangInitial
      : langs[0];

    const FLAG = { en:'🇬🇧', de:'🇩🇪', fr:'🇫🇷', es:'🇪🇸', it:'🇮🇹', ru:'🇷🇺', uk:'🇺🇦', sr:'🇷🇸', pl:'🇵🇱' };

    function applyActive(lang) {
      activeLang = lang;

      // подсветка кнопок
      box.querySelectorAll('.dict-flag').forEach(function (b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });

      // показ нужной карточки
      root.querySelectorAll('.stats-lang-card').forEach(function (card) {
        const cl = card.getAttribute('data-lang');
        card.classList.toggle('is-active', cl === lang);
      });

      // можно запомнить последний выбранный язык
      try {
        A.settings = A.settings || {};
        A.settings.statsLang = lang;
      } catch (_) {}
    }

    // заново рисуем кнопки
    box.innerHTML = '';
    langs.forEach(function (lang) {
      const btn = document.createElement('button');
      btn.type  = 'button';
      btn.className = 'dict-flag' + (lang === activeLang ? ' active' : '');
      btn.dataset.lang = lang;
      btn.title        = lang.toUpperCase();
      btn.textContent  = FLAG[lang] || lang.toUpperCase();
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

    // сначала пробуем взять язык из настроек статистики
    try {
      if (A.settings && A.settings.statsLang &&
          statsByLang.some(function (b) { return b.lang === A.settings.statsLang; })) {
        return A.settings.statsLang;
      }
    } catch (_) {}

    // потом — язык активного словаря тренажёра
    try {
      if (A.Trainer && typeof A.Trainer.getDeckKey === 'function' &&
          A.Decks   && typeof A.Decks.langOfKey === 'function') {
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

  /* ---------------------- mount() ---------------------- */

  function mount() {
    const app = document.getElementById('app');
    if (!app) return;

    const texts = t();
    const stats = computeStats();
    const activeLang = detectActiveTrainLang(stats.byLang);

    const cardsHtml = renderLangCards(stats.byLang, texts, activeLang);

    // Разметка сделана по образцу view.dicts.js:
    // card.dicts-card + .dicts-header + .dicts-flags
    const html =
      '<div class="home">' +
        '<section class="card dicts-card stats-card">' +
          '<div class="dicts-header">' +
            '<h3>' + texts.title + '</h3>' +
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
