// js/fontPair.js — "Font Pair" tab: glyph sets + type-scale role assignment.
import { createFontPicker } from './fontPicker.js';
import { DEFAULT_CHARSET, supportedChars } from './glyphRender.js';

// Standard type-scale pattern (~1.25 "major third" ratio, rounded to clean values).
// Sizes stay editable per role — this is just the sensible starting point.
const DEFAULT_ROLES = [
  { id: 'eyebrow', name: 'Eyebrow / Overline', text: 'CATEGORIA', size: 12, assign: 'A', uppercase: true, spacing: '0.14em' },
  { id: 'display', name: 'Display', text: 'Grande titolo', size: 48, assign: 'A' },
  { id: 'title', name: 'Title (H1)', text: 'Un titolo che cattura l’attenzione', size: 32, assign: 'A' },
  { id: 'subtitle', name: 'Subtitle (H2)', text: 'Un sottotitolo che spiega meglio il contesto', size: 20, assign: 'B' },
  { id: 'body', name: 'Body', text: 'Questo è un paragrafo di prova per valutare la leggibilità dell’abbinamento tra i due font scelti, su più righe di testo continuo.', size: 16, assign: 'B' },
  { id: 'caption', name: 'Caption', text: 'Didascalia o nota a piè di pagina', size: 13, assign: 'B' },
  { id: 'button', name: 'Button / Label', text: 'SCOPRI DI PIÙ', size: 14, assign: 'A', uppercase: true, spacing: '0.06em' },
];

export function initFontPairTab(root) {
  const state = {
    fontA: null,
    fontB: null,
    faceA: null,
    faceB: null,
    roles: DEFAULT_ROLES.map((r) => ({ ...r })),
  };

  root.innerHTML = `
    <div class="tab-toolbar">
      <div class="font-pickers" id="fpair-pickers"></div>
    </div>
    <div class="fpair-body">
      <section class="fpair-section" id="fpair-glyphs">
        <h3>Set di glifi</h3>
        <p class="hint">Scegli due font per vedere i caratteri disponibili in ciascuno.</p>
      </section>
      <section class="fpair-section" id="fpair-scale">
        <h3>Scala tipografica</h3>
        <p class="hint">Scala standard (rapporto ~1.25), pensata per leggersi come una pagina: cambia font e dimensione a sinistra, il testo a destra è modificabile direttamente.</p>
        <div class="fpair-stack" id="fpair-stack"></div>
      </section>
      <section class="fpair-section">
        <button type="button" id="fpair-export">Copia CSS dell'abbinamento</button>
        <span id="fpair-export-status"></span>
      </section>
    </div>
  `;

  const pickersEl = root.querySelector('#fpair-pickers');
  pickersEl.appendChild(createFontPicker({
    label: 'Font A',
    onSelect: async (entry) => { state.fontA = entry; await refreshFaces(); renderAll(); },
  }));
  pickersEl.appendChild(createFontPicker({
    label: 'Font B',
    onSelect: async (entry) => { state.fontB = entry; await refreshFaces(); renderAll(); },
  }));

  const glyphsEl = root.querySelector('#fpair-glyphs');
  const stackEl = root.querySelector('#fpair-stack');
  const exportBtn = root.querySelector('#fpair-export');
  const exportStatus = root.querySelector('#fpair-export-status');

  async function refreshFaces() {
    if (state.fontA) {
      try { state.faceA = await state.fontA.loadFontFace('FP-FontA'); }
      catch (err) { console.error(err); state.faceA = null; }
    }
    if (state.fontB) {
      try { state.faceB = await state.fontB.loadFontFace('FP-FontB'); }
      catch (err) { console.error(err); state.faceB = null; }
    }
  }

  function familyFor(assign) {
    return assign === 'A' ? 'FP-FontA' : 'FP-FontB';
  }

  async function renderGlyphs() {
    glyphsEl.innerHTML = '<h3>Set di glifi</h3>';
    if (!state.fontA || !state.fontB) {
      glyphsEl.insertAdjacentHTML('beforeend', '<p class="hint">Scegli due font per vedere i caratteri disponibili in ciascuno.</p>');
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'glyph-columns';
    for (const [label, entry, family] of [['Font A', state.fontA, 'FP-FontA'], ['Font B', state.fontB, 'FP-FontB']]) {
      const col = document.createElement('div');
      col.className = 'glyph-column';
      const otFont = await entry.getOpentypeFont();
      const chars = supportedChars(otFont, DEFAULT_CHARSET);
      col.innerHTML = `<h4>${label} — ${entry.label} <span class="hint">(${chars.length}/${DEFAULT_CHARSET.length} caratteri)</span></h4>`;
      const grid = document.createElement('div');
      grid.className = 'glyph-set';
      grid.style.fontFamily = `'${family}', sans-serif`;
      for (const ch of chars) {
        const cell = document.createElement('span');
        cell.className = 'glyph-cell';
        cell.textContent = ch;
        grid.appendChild(cell);
      }
      col.appendChild(grid);
      wrap.appendChild(col);
    }
    glyphsEl.appendChild(wrap);
  }

  function renderStack() {
    stackEl.innerHTML = '';
    const ready = Boolean(state.fontA && state.fontB);
    for (const role of state.roles) {
      const band = document.createElement('div');
      band.className = 'role-band';
      band.innerHTML = `
        <div class="role-controls-col">
          <div class="role-name">${role.name}</div>
          <div class="role-assign">
            <button type="button" data-a>A</button>
            <button type="button" data-b>B</button>
          </div>
          <label class="role-size-field">
            <input type="number" class="role-size" min="8" max="140" value="${role.size}" />px
          </label>
        </div>
        <div class="role-preview-col">
          <div class="role-preview-text" contenteditable="${ready}" spellcheck="false"></div>
        </div>
      `;
      const btnA = band.querySelector('[data-a]');
      const btnB = band.querySelector('[data-b]');
      const sizeInput = band.querySelector('.role-size');
      const preview = band.querySelector('.role-preview-text');
      preview.textContent = role.text;

      function syncPreview() {
        preview.style.fontFamily = ready ? `'${familyFor(role.assign)}', sans-serif` : 'inherit';
        preview.style.fontSize = `${role.size}px`;
        if (role.uppercase) {
          preview.style.textTransform = 'uppercase';
          preview.style.letterSpacing = role.spacing || '0';
        } else {
          preview.style.textTransform = 'none';
          preview.style.letterSpacing = 'normal';
        }
        btnA.classList.toggle('active', role.assign === 'A');
        btnB.classList.toggle('active', role.assign === 'B');
      }

      preview.addEventListener('input', () => { role.text = preview.textContent; });
      preview.addEventListener('blur', () => { if (!preview.textContent.trim()) { preview.textContent = role.text; } });
      sizeInput.addEventListener('input', () => { role.size = Number(sizeInput.value) || role.size; syncPreview(); });
      btnA.addEventListener('click', () => { role.assign = 'A'; syncPreview(); });
      btnB.addEventListener('click', () => { role.assign = 'B'; syncPreview(); });

      syncPreview();
      stackEl.appendChild(band);
    }
    if (!ready) {
      stackEl.insertAdjacentHTML('afterbegin', '<p class="hint">Scegli due font per vedere l’anteprima combinata.</p>');
    }
  }

  function buildCssSnippet() {
    const lines = [];
    lines.push('/* Font Pair — abbinamento generato con fontPair */');
    for (const [label, entry] of [['Font A', state.fontA], ['Font B', state.fontB]]) {
      if (!entry) continue;
      lines.push('');
      if (entry.source === 'google') {
        const { family, weight, italic } = entry.meta;
        const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
        lines.push(`/* ${label}: Google Fonts — aggiungi nel <head>: */`);
        lines.push(`/* <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&display=swap"> */`);
        lines.push(`/* poi usa font-family: '${family}', sans-serif; */`);
      } else {
        lines.push(`/* ${label}: font ${entry.source === 'local' ? 'locale' : 'caricato'} (\"${entry.label}\") — self-hostalo e aggiorna il src qui sotto */`);
        lines.push(`@font-face {`);
        lines.push(`  font-family: '${label === 'Font A' ? 'FontA' : 'FontB'}';`);
        lines.push(`  src: url('./fonts/${entry.label.replace(/\s+/g, '-')}.woff2') format('woff2');`);
        lines.push(`}`);
      }
    }
    lines.push('');
    for (const role of state.roles) {
      const familyName = role.assign === 'A'
        ? (state.fontA?.source === 'google' ? state.fontA.meta.family : 'FontA')
        : (state.fontB?.source === 'google' ? state.fontB.meta.family : 'FontB');
      lines.push(`.${role.id} {`);
      lines.push(`  font-family: '${familyName}', sans-serif;`);
      lines.push(`  font-size: ${role.size}px;`);
      if (role.uppercase) {
        lines.push(`  text-transform: uppercase;`);
        lines.push(`  letter-spacing: ${role.spacing || '0'};`);
      }
      lines.push(`}`);
    }
    return lines.join('\n');
  }

  exportBtn.addEventListener('click', async () => {
    const css = buildCssSnippet();
    try {
      await navigator.clipboard.writeText(css);
      exportStatus.textContent = 'CSS copiato negli appunti ✓';
    } catch {
      exportStatus.textContent = 'Copia non riuscita: apri la console per il CSS.';
      console.log(css);
    }
    setTimeout(() => { exportStatus.textContent = ''; }, 3000);
  });

  async function renderAll() {
    await renderGlyphs();
    renderStack();
  }

  renderStack();
}
