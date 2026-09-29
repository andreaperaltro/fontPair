// js/main.js — app bootstrap: tab switching + module init.
import { initSimilarFontTab } from './similarFont.js';
import { initFontPairTab } from './fontPair.js';

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function checkLocalFontSupport() {
  const badge = document.getElementById('local-font-support');
  if (!badge) return;
  if ('queryLocalFonts' in window) {
    badge.textContent = 'Local Font Access disponibile in questo browser.';
    badge.classList.add('ok');
  } else {
    badge.textContent = 'Il tuo browser non supporta l’accesso ai font locali (serve Chrome o Edge) — puoi comunque caricare i file dei font.';
    badge.classList.add('warn');
  }
}

initTabs();
checkLocalFontSupport();
initSimilarFontTab(document.getElementById('tab-similar'));
initFontPairTab(document.getElementById('tab-pair'));
