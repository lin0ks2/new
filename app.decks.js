/* app.decks.js v1.2.2
   ─────────────────────────────────────────────────────────────────────────────
   Ответственность модуля:
   • Регистрация и доступ к наборам слов (деки)
   • Эвристика части речи для автоназвания словаря
   • Флаги/названия для отображения
   • Предпросмотр
   • ГАРАНТИЯ УНИКАЛЬНЫХ СТАБИЛЬНЫХ ID:
     - если в исходном словаре id отсутствуют или дублируются, выдаём
       стабильный id на основе hash(dictKey|word)

   Изменения в этой версии (1.2.2):
   • Имя словаря теперь определяется ПРЕЖДЕ ВСЕГО по «блоку» (ключу словаря):
     - ключ содержит «prep» → «Предлоги/Прийменники»
     - ключ содержит «verb» → «Глаголы/Дієслова»
     - ключ содержит «noun» → «Существительные/Іменники»
     Если явного соответствия нет — используем эвристику по словам.
   • Эвристика «предлоги» — регистронезависимая, словарь предлогов распознаётся корректно.
   ─────────────────────────────────────────────────────────────────────────────
*/

(function(){
  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК A] Доступ к корневому пространству App
  // ───────────────────────────────────────────────────────────────────────────
  const App = window.App || (window.App = {});
  const decksNS = (App.Decks = App.Decks || {});

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК B] Вспомогательные функции (hash, клон, утилиты)
  // ───────────────────────────────────────────────────────────────────────────
  function djb2(str){
    let h = 5381;
    for (let i=0; i<str.length; i++){
      h = ((h << 5) + h) + str.charCodeAt(i);
      h |= 0;
    }
    return h >>> 0;
  }
  function ensureArray(a){ return Array.isArray(a) ? a : []; }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК C] Гарантия уникальных и стабильных id внутри словаря
  // ───────────────────────────────────────────────────────────────────────────
  function ensureStableIds(dictKey, words){
    const arr = ensureArray(words);
    const seen = new Set();
    for (let i=0; i<arr.length; i++){
      const w = arr[i] || {};
      let id = (w.id != null) ? String(w.id) : '';
      if (!id || seen.has(id)){
        const wordKey = String(w.word || '').trim();
        const base = `${dictKey}|${wordKey}`;
        id = String(djb2(base));
        let salt = 1;
        while (seen.has(id)) {
          id = String(djb2(base + '#' + (++salt)));
        }
        w.id = +id;
      }
      seen.add(String(w.id));
      arr[i] = w;
    }
    return arr;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК D] Эвристика части речи и автоназвания
  // ───────────────────────────────────────────────────────────────────────────
  const PREP_SET = new Set([
    'an','auf','aus','bei','mit','nach','seit','von','zu',
    'durch','für','gegen','ohne','um','wider','entlang',
    'gegenüber','über','unter','zwischen','vor','hinter',
    'in','neben'
  ]);
  const ADJ_SUFFIX = ['ig','lich','isch','sam','los','voll','bar'];

  function inferPOSForDeck(words){
    const list = ensureArray(words);
    if (!list.length) return 'misc';
    let verbs=0, nouns=0, preps=0, adjs=0, checked=0;

    for (const w of list){
      const s = String(w?.word || '').trim();
      if (!s) continue;
      checked++;

      const sLow = s.toLowerCase();

      // (1) предлоги — проверяем строго по словарю без учёта регистра
      if (PREP_SET.has(sLow)) { preps++; continue; }

      // (2) существительные — артикль + Заглавная или одиночная Заглавная
      if (/^(der|die|das)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*$/.test(s) || /^[A-ZÄÖÜ]/.test(s)){
        nouns++; continue;
      }

      // (3) глаголы — инфинитив: …en / …eln / …ern
      if (/^[a-zäöü].*(en|eln|ern)$/.test(sLow)) { verbs++; continue; }

      // (4) прилагательные по суффиксам
      if (/^[a-zäöü]/.test(s) && ADJ_SUFFIX.some(sf => sLow.endsWith(sf))) { adjs++; continue; }
    }

    const r = x => x / Math.max(1, checked);
    if (r(preps) > 0.35) return 'preps';
    if (r(verbs) > 0.5)  return 'verbs';
    if (r(nouns) > 0.5)  return 'nouns';
    if (r(adjs)  > 0.5)  return 'adjs';
    return 'misc';
  }

  function posLabel(pos){
    const t = App.i18n ? App.i18n() : (window.I18N?.uk || {});
    return ({
      verbs:t.pos_verbs || 'Дієслова',
      nouns:t.pos_nouns || 'Іменники',
      preps:t.pos_preps || 'Прийменники',
      adjs:t.pos_adjs   || 'Прикметники',
      advs:t.pos_advs   || 'Прислівники',
      misc:t.pos_misc   || 'Словник'
    })[pos] || (t.pos_misc || 'Словник');
  }

  function defaultDictName(words){
    const pos = inferPOSForDeck(words);
    return posLabel(pos);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК E] Классификация по КЛЮЧУ словаря (главное правило имени)
  // ───────────────────────────────────────────────────────────────────────────
  function classifyByKey(key){
    const k = String(key||'').toLowerCase();
    // покрытия распространённых вариантов имён ключей:
    if (/prep|предлог|praep|präpos|praeposition|präposition/.test(k)) return 'preps';
    if (/verb|глагол|verben/.test(k))                                 return 'verbs';
    if (/noun|nomen|существ|nouns/.test(k))                           return 'nouns';
    return 'misc';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК F] Флаги, имена, доступ к словарям
  // ───────────────────────────────────────────────────────────────────────────
  function flagForKey(key, words){
    if (key === 'fav' || key === 'favorites') return '♥';
    return '🇩🇪';
  }

  function resolveNameByKey(key){
    if (key === 'fav' || key === 'favorites'){
      const t = App.i18n ? App.i18n() : (window.I18N?.uk || {});
      return t.favTitle || 'Обране';
    }

    // 1) сначала — чётко по «блоку» ключа
    const cls = classifyByKey(key);
    if (cls !== 'misc') return posLabel(cls);

    // 2) иначе — эвристика по словам
    const words = decksNS.resolveDeckByKey(key) || [];
    return defaultDictName(words);
  }

  function builtinKeys(){
    const out = [];
    const d = window.decks || {};
    for (const k of Object.keys(d)){
      const arr = ensureArray(d[k]);
      if (arr.length) out.push(k);
    }
    return out.sort();
  }

  function prepareDeck(key){
    const d = window.decks || {};
    if (!Array.isArray(d[key])) return [];
    d[key] = ensureStableIds(key, d[key]);
    return d[key];
  }

  function resolveDeckByKey(key){
    if (!key) return [];
    if (key === 'fav' || key === 'favorites'){
      const all = [];
      const d = window.decks || {};
      for (const k of Object.keys(d)){ all.push(...ensureArray(d[k])); }
      const reg = App.dictRegistry || {};
      for (const uk of Object.keys(reg.user || {})){
        all.push(...ensureArray(reg.user[uk]?.words));
      }
      const byId = new Map(all.map(w => [w.id, w]));
      const favIds = Object.keys(App.state?.favorites || {}).filter(id => App.state.favorites[id]);
      return favIds.map(id => byId.get(+id)).filter(Boolean);
    }
    return prepareDeck(key);
  }

  function pickDefaultKey(){
    const fav = resolveDeckByKey('fav');
    if (fav && fav.length >= 4) return 'fav';
    const built = builtinKeys();
    return built[0] || Object.keys(App.dictRegistry?.user || {})[0] || null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК G] Предпросмотр словаря
  // ───────────────────────────────────────────────────────────────────────────
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  function openPreview(words, title){
    const t = App.i18n ? App.i18n() : (window.I18N?.uk || {});
    const transKey = (App.settings?.lang === 'ru') ? 'ru' : 'uk';
    const rows = (ensureArray(words)).map(w =>
      `<tr><td>${escapeHtml(w.word||'')}</td><td>${escapeHtml(w[transKey]||'')}</td></tr>`
    ).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(title||'')}</title>
      <style>
        body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:16px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}
        thead th{background:#f8fafc}
      </style>
    </head><body>
      <h3>${escapeHtml(title||'')}</h3>
      <table>
        <thead><tr><th>${escapeHtml(t.pos_misc || 'Словник')}</th><th>${(App.settings?.lang==='ru') ? 'Перевод' : 'Переклад'}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
    const blob = new Blob([html], {type:'text/html;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [БЛОК H] Публичный API
  // ───────────────────────────────────────────────────────────────────────────
  decksNS.flagForKey       = flagForKey;
  decksNS.resolveNameByKey = resolveNameByKey;
  decksNS.builtinKeys      = builtinKeys;
  decksNS.resolveDeckByKey = resolveDeckByKey;
  decksNS.pickDefaultKey   = pickDefaultKey;
  decksNS.openPreview      = openPreview;

})();
 // конец
