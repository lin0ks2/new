/* ==========================================================
 * Project: MOYAMOVA
 * File: dicts.js
 * Purpose: Логика приложения (JS)
 * Version: 1.0
 * Last modified: 2025-10-19
*/

(function(){
  'use strict';

  window.decks = window.decks || {};
  if (!Array.isArray(window.decks.de_verbs)) window.decks.de_verbs = [];
  if (!Array.isArray(window.decks.de_nouns)) window.decks.de_nouns = [];

  function i18n(){
    try { return (window.App && typeof App.i18n === 'function') ? (App.i18n()||{}) : {}; }
    catch(_) { return {}; }
  }

  function ensureHeader(modal){
    const dialog = modal && modal.querySelector('.dialog');
    if (!dialog) return {header:null,title:null,closeBtn:null};

    let header = dialog.querySelector('.modalHeader');
    if (!header){
      header = document.createElement('div');
      header.className = 'modalHeader';
      dialog.insertBefore(header, dialog.firstChild);
    }

    header.classList.add('flex-between');

    let title = dialog.querySelector('#modalTitle');
    if (!title){
      title = document.createElement('h2');
      title.id = 'modalTitle';
      title.textContent = 'Словари';
    } else if (title.parentElement) {
      title.parentElement.removeChild(title);
    }
    if (!title.classList.contains('modalTitle')) title.classList.add('modalTitle');
    header.insertBefore(title, header.firstChild);

    let closeBtn = dialog.querySelector('#modalClose') || modal.querySelector('#modalClose');
    if (!closeBtn){
      closeBtn = document.createElement('button');
      closeBtn.id = 'modalClose';
      closeBtn.className = 'iconBtn small';
      closeBtn.setAttribute('aria-label','Close');
      closeBtn.textContent = '✖️';
    } else if (closeBtn.parentElement) {
      closeBtn.parentElement.removeChild(closeBtn);
    }
    header.appendChild(closeBtn);

    modal.querySelectorAll('#modalClose').forEach(btn => {
      if (btn !== closeBtn) btn.remove();
    });

    return {header, title, closeBtn};
  }

  function wireModal(){
    const modal    = document.getElementById('modal');
    if (!modal) return;

    const {title, closeBtn} = ensureHeader(modal);

    const okBtn   = modal.querySelector('#okBtn');
    const backdrop= modal.querySelector('#backdrop');

    function fill(){
      const t = i18n();
      if (title && t.modalTitle) title.textContent = t.modalTitle;
      if (okBtn) okBtn.textContent = t.ok || 'OK';
    }

    function close(){ modal.classList.add('hidden'); }

    if (okBtn)    okBtn.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fill, {once:true});
    } else {
      fill();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireModal, {once:true});
  } else {
    wireModal();
  }
})();

/* ====================== End of file =======================
 * File: dicts.js • Version: 1.0 • 2025-10-19
*/
