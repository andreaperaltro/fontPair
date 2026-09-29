// js/similarFont.js — "Similar Font" tab: overlay two fonts to compare their shapes.
import { createFontPicker } from './fontPicker.js';
import { buildOverlay, applyLayerStyle, BLEND_MODES, DEFAULT_CHARSET, supportedChars } from './glyphRender.js';

export function initSimilarFontTab(root) {
  const state = {
    fontA: null,
    fontB: null,
    otA: null,
    otB: null,
    mode: 'word',
    text: 'Hamburgefonstiv',
    glyphChar: 'g',
    fontSize: 220,
    colorA: '#e0342d',
    colorB: '#2f6fed',
    blend: 'multiply',
    renderMode: 'fill',
    strokeWidth: 1.5,
    opacityB: 0.85,
  };

  root.innerHTML = `
    <div class="tab-toolbar">
      <div class="font-pickers" id="sf-pickers"></div>
      <div class="sf-controls">
        <div class="control-group">
          <label>Modalità</label>
          <select id="sf-mode">
            <option value="word">Parola personalizzata</option>
            <option value="glyph">Glifo singolo</option>
            <option value="all">Tutti i glifi</option>
          </select>
        </div>
        <div class="control-group" id="sf-text-group">
          <label>Testo</label>
          <input type="text" id="sf-text" value="Hamburgefonstiv" />
        </div>
        <div class="control-group" id="sf-glyph-group" hidden>
          <label>Carattere</label>
          <input type="text" id="sf-glyph" maxlength="2" value="g" />
        </div>
        <div class="control-group">
          <label>Dimensione: <span id="sf-size-val">220</span>px</label>
          <input type="range" id="sf-size" min="40" max="600" value="220" />
        </div>
        <div class="control-group">
          <label>Resa</label>
          <select id="sf-render-mode">
            <option value="fill">Riempimento</option>
            <option value="stroke">Solo contorno</option>
          </select>
        </div>
        <div class="control-group" id="sf-stroke-group" hidden>
          <label>Spessore contorno: <span id="sf-stroke-val">1.5</span></label>
          <input type="range" id="sf-stroke" min="0.5" max="6" step="0.5" value="1.5" />
        </div>
        <div class="control-group">
          <label>Blend</label>
          <select id="sf-blend">
            ${BLEND_MODES.map((b) => `<option value="${b.value}" ${b.value === 'multiply' ? 'selected' : ''}>${b.label}</option>`).join('')}
          </select>
        </div>
        <div class="control-group colors">
          <label>Colore A <input type="color" id="sf-colorA" value="#e0342d" /></label>
          <label>Colore B <input type="color" id="sf-colorB" value="#2f6fed" /></label>
        </div>
        <div class="control-group">
          <label>Opacità B: <span id="sf-opacity-val">0.85</span></label>
          <input type="range" id="sf-opacity" min="0.1" max="1" step="0.05" value="0.85" />
        </div>
      </div>
    </div>
    <div class="sf-stage" id="sf-stage">
      <p class="sf-placeholder">Scegli due font per iniziare il confronto.</p>
    </div>
  `;

  const pickersEl = root.querySelector('#sf-pickers');
  pickersEl.appendChild(createFontPicker({
    label: 'Font A',
    onSelect: (entry) => { state.fontA = entry; render(); },
  }));
  pickersEl.appendChild(createFontPicker({
    label: 'Font B',
    onSelect: (entry) => { state.fontB = entry; render(); },
  }));

  const modeSelect = root.querySelector('#sf-mode');
  const textGroup = root.querySelector('#sf-text-group');
  const glyphGroup = root.querySelector('#sf-glyph-group');
  const textInput = root.querySelector('#sf-text');
  const glyphInput = root.querySelector('#sf-glyph');
  const sizeInput = root.querySelector('#sf-size');
  const sizeVal = root.querySelector('#sf-size-val');
  const renderModeSelect = root.querySelector('#sf-render-mode');
  const strokeGroup = root.querySelector('#sf-stroke-group');
  const strokeInput = root.querySelector('#sf-stroke');
  const strokeVal = root.querySelector('#sf-stroke-val');
  const blendSelect = root.querySelector('#sf-blend');
  const colorA = root.querySelector('#sf-colorA');
  const colorB = root.querySelector('#sf-colorB');
  const opacityInput = root.querySelector('#sf-opacity');
  const opacityVal = root.querySelector('#sf-opacity-val');
  const stage = root.querySelector('#sf-stage');

  function syncModeVisibility() {
    textGroup.hidden = state.mode !== 'word';
    glyphGroup.hidden = state.mode !== 'glyph';
  }

  modeSelect.addEventListener('change', () => { state.mode = modeSelect.value; syncModeVisibility(); render(); });
  textInput.addEventListener('input', () => { state.text = textInput.value; render(); });
  glyphInput.addEventListener('input', () => { state.glyphChar = glyphInput.value.slice(0, 1) || 'g'; render(); });
  sizeInput.addEventListener('input', () => { state.fontSize = Number(sizeInput.value); sizeVal.textContent = state.fontSize; render(); });
  renderModeSelect.addEventListener('change', () => {
    state.renderMode = renderModeSelect.value;
    strokeGroup.hidden = state.renderMode !== 'stroke';
    render();
  });
  strokeInput.addEventListener('input', () => { state.strokeWidth = Number(strokeInput.value); strokeVal.textContent = state.strokeWidth; render(); });
  blendSelect.addEventListener('change', () => { state.blend = blendSelect.value; render(); });
  colorA.addEventListener('input', () => { state.colorA = colorA.value; render(); });
  colorB.addEventListener('input', () => { state.colorB = colorB.value; render(); });
  opacityInput.addEventListener('input', () => { state.opacityB = Number(opacityInput.value); opacityVal.textContent = state.opacityB; render(); });

  async function ensureOt() {
    if (!state.fontA || !state.fontB) return false;
    try {
      state.otA = await state.fontA.getOpentypeFont();
      state.otB = await state.fontB.getOpentypeFont();
      return true;
    } catch (err) {
      stage.innerHTML = `<p class="sf-placeholder sf-error">Errore nel caricare i font: ${err.message}</p>`;
      return false;
    }
  }

  function styleOverlay(layerA, layerB) {
    applyLayerStyle(layerA.path, { mode: state.renderMode, color: state.colorA, opacity: 1, strokeWidth: state.strokeWidth });
    applyLayerStyle(layerB.path, { mode: state.renderMode, color: state.colorB, opacity: state.opacityB, strokeWidth: state.strokeWidth });
    layerB.svg.style.mixBlendMode = state.blend;
    layerA.svg.style.mixBlendMode = 'normal';
  }

  function renderSingleOverlay(text, fontSize) {
    stage.innerHTML = '';
    const safeText = text && text.length ? text : ' ';
    const { container, layerA, layerB } = buildOverlay({ fontA: state.otA, fontB: state.otB, text: safeText, fontSize });
    styleOverlay(layerA, layerB);
    container.classList.add('sf-single');
    stage.appendChild(container);
  }

  function renderAllGlyphs() {
    stage.innerHTML = '';
    const charsA = new Set(supportedChars(state.otA));
    const charsB = new Set(supportedChars(state.otB));
    const shared = DEFAULT_CHARSET.filter((c) => charsA.has(c) && charsB.has(c));
    if (shared.length === 0) {
      stage.innerHTML = '<p class="sf-placeholder">Nessun glifo in comune tra i due font nel set di confronto.</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'sf-grid';
    for (const ch of shared) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'sf-tile';
      tile.title = `${ch} — clic per ingrandire`;
      const { container, layerA, layerB } = buildOverlay({ fontA: state.otA, fontB: state.otB, text: ch, fontSize: 90, padding: 10 });
      styleOverlay(layerA, layerB);
      tile.appendChild(container);
      tile.addEventListener('click', () => {
        state.mode = 'glyph';
        state.glyphChar = ch;
        modeSelect.value = 'glyph';
        glyphInput.value = ch;
        syncModeVisibility();
        render();
      });
      grid.appendChild(tile);
    }
    stage.appendChild(grid);
  }

  async function render() {
    if (!(await ensureOt())) {
      if (state.fontA || state.fontB) return; // error already shown by ensureOt
      stage.innerHTML = '<p class="sf-placeholder">Scegli due font per iniziare il confronto.</p>';
      return;
    }
    if (state.mode === 'all') renderAllGlyphs();
    else renderSingleOverlay(state.mode === 'glyph' ? state.glyphChar : state.text, state.fontSize);
  }

  syncModeVisibility();
}
