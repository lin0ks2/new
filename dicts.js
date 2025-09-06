
// dicts.js v1.3.1 — гарантируем window.decks и мягко валидируем ключи
(function(){
  window.decks = window.decks || {};
  // ожидаем, что в deck.js присутствуют window.decks.de_verbs и window.decks.de_nouns
  // ничего больше не делаем — лишь проверка на массивы.
  if (!Array.isArray(window.decks.de_verbs)) window.decks.de_verbs = [];
  if (!Array.isArray(window.decks.de_nouns)) window.decks.de_nouns = [];
})();
// конец!
