// js/similarFont.js — "Similar Font" tab: overlay two fonts to compare their shapes.
import { createFontPicker } from './fontPicker.js';
import { buildOverlay, applyLayerStyle, BLEND_MODES, DEFAULT_CHARSET, supportedChars } from './glyphRender.js';

function defaultLayer(color, opacity) {
  return { color, renderMode: 'fill', strokeWidth: 1.5, opacity, letterSpacing: 0 };
}

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
    blend: 'multiply',
    layers: {
      A: defaultLayer('#e0342d', 1),
      B: defaultLayer('#2f6fed', 0.85),
    },
  };

  root.innerHTML = `
    <div class="tab-toolbar">
      <div class="sf-columns" id="sf-columns"></div>
      <div class="sf-general">
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
          <label>Dimensione glifi: <span id="sf-size-val">220</span>px</label>
          <input type="range" id="sf-size" min="8" max="600" value="220" />
        </div>
        <div class="control-group">
          <label>Blend (tra i due font)</label>
          <select id="sf-blend">
            ${BLEND_MODES.map((b) => `<option value="${b.value}" ${b.value === 'multiply' ? 'selected' : ''}>${b.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="sf-stage" id="sf-stage">
      <p class="sf-placeholder">Scegli due font per iniziare il confronto.</p>
    </div>
  `;

  const columnsEl = root.querySelector('#sf-columns');

  function buildLayerColumn(layerKey, label) {
    const col = document.createElement('div');
    col.className = 'sf-column';
    const pickerWrap = document.createElement('div');
    col.appendChild(pickerWrap);
    pickerWrap.appendChild(createFontPicker({
      label,
      onSelect: (entry) => { state[layerKey === 'A' ? 'fontA' : 'fontB'] = entry; render(); },
    }));

    const layer = state.layers[layerKey];
    const controls = document.createElement('div');
    controls.className = 'layer-controls';
    controls.innerHTML = `
      <label>Colore <input type="color" class="lc-color" value="${layer.color}" /></label>
      <label>Resa
        <select class="lc-render">
          <option value="fill">Riempimento</option>
          <option value="stroke">Solo contorno</option>
        </select>
      </label>
      <label class="lc-stroke-group" hidden>
        <span class="lc-field-label">Spessore contorno</span>
        <span class="lc-slider-row">
          <input type="range" class="lc-stroke" min="0.5" max="6" step="0.5" value="${layer.strokeWidth}" />
          <span class="lc-slider-val lc-stroke-val">${layer.strokeWidth}</span>
        </span>
      </label>
      <label>
        <span class="lc-field-label">Opacità</span>
        <span class="lc-slider-row">
          <input type="range" class="lc-opacity" min="0.1" max="1" step="0.05" value="${layer.opacity}" />
          <span class="lc-slider-val lc-opacity-val">${layer.opacity}</span>
        </span>
      </label>
      <label>
        <span class="lc-field-label">Spaziatura</span>
        <span class="lc-slider-row">
          <input type="range" class="lc-spacing" min="-0.05" max="0.5" step="0.01" value="${layer.letterSpacing}" />
          <span class="lc-slider-val lc-spacing-val">${layer.letterSpacing}em</span>
        </span>
      </label>
    `;
    col.appendChild(controls);

    const colorInput = controls.querySelector('.lc-color');
    const renderSelect = controls.querySelector('.lc-render');
    const strokeGroup = controls.querySelector('.lc-stroke-group');
    const strokeInput = controls.querySelector('.lc-stroke');
    const strokeVal = controls.querySelector('.lc-stroke-val');
    const opacityInput = controls.querySelector('.lc-opacity');
    const opacityVal = controls.querySelector('.lc-opacity-val');
    const spacingInput = controls.querySelector('.lc-spacing');
    const spacingVal = controls.querySelector('.lc-spacing-val');

    colorInput.addEventListener('input', () => { layer.color = colorInput.value; render(); });
    renderSelect.addEventListener('change', () => {
      layer.renderMode = renderSelect.value;
      strokeGroup.hidden = layer.renderMode !== 'stroke';
      render();
    });
    strokeInput.addEventListener('input', () => {
      layer.strokeWidth = Number(strokeInput.value);
      strokeVal.textContent = layer.strokeWidth;
      render();
    });
    opacityInput.addEventListener('input', () => {
      layer.opacity = Number(opacityInput.value);
      opacityVal.textContent = layer.opacity;
      render();
    });
    spacingInput.addEventListener('input', () => {
      layer.letterSpacing = Number(spacingInput.value);
      spacingVal.textContent = `${layer.letterSpacing}em`;
      render();
    });

    return col;
  }

  columnsEl.appendChild(buildLayerColumn('A', 'Font A'));
  columnsEl.appendChild(buildLayerColumn('B', 'Font B'));

  const modeSelect = root.querySelector('#sf-mode');
  const textGroup = root.querySelector('#sf-text-group');
  const glyphGroup = root.querySelector('#sf-glyph-group');
  const textInput = root.querySelector('#sf-text');
  const glyphInput = root.querySelector('#sf-glyph');
  const sizeInput = root.querySelector('#sf-size');
  const sizeVal = root.querySelector('#sf-size-val');
  const blendSelect = root.querySelector('#sf-blend');
  const stage = root.querySelector('#sf-stage');

  function syncModeVisibility() {
    textGroup.hidden = state.mode !== 'word';
    glyphGroup.hidden = state.mode !== 'glyph';
  }

  modeSelect.addEventListener('change', () => { state.mode = modeSelect.value; syncModeVisibility(); render(); });
  textInput.addEventListener('input', () => { state.text = textInput.value; render(); });
  glyphInput.addEventListener('input', () => { state.glyphChar = glyphInput.value.slice(0, 1) || 'g'; render(); });
  sizeInput.addEventListener('input', () => { state.fontSize = Number(sizeInput.value); sizeVal.textContent = state.fontSize; render(); });
  blendSelect.addEventListener('change', () => { state.blend = blendSelect.value; render(); });

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

  // `layersA`/`layersB` are arrays — one entry per rendered line — since a
  // long comparison can wrap onto several stacked overlay lines.
  function styleOverlay(layersA, layersB) {
    const a = state.layers.A;
    const b = state.layers.B;
    for (const layerA of layersA) {
      applyLayerStyle(layerA.path, { mode: a.renderMode, color: a.color, opacity: a.opacity, strokeWidth: a.strokeWidth });
      layerA.svg.style.mixBlendMode = 'normal';
    }
    for (const layerB of layersB) {
      applyLayerStyle(layerB.path, { mode: b.renderMode, color: b.color, opacity: b.opacity, strokeWidth: b.strokeWidth });
      layerB.svg.style.mixBlendMode = state.blend;
    }
  }

  function renderSingleOverlay(text, fontSize) {
    stage.innerHTML = '';
    const safeText = text && text.length ? text : ' ';
    // Wrap onto more lines instead of shrinking the text to fit — using
    // whichever font is wider to decide where each line breaks, so both
    // fonts wrap at the same letter even if their own widths differ.
    const maxWidth = Math.max((stage.clientWidth || 900) - 64, 120);
    const { container, layersA, layersB } = buildOverlay({
      fontA: state.otA,
      fontB: state.otB,
      text: safeText,
      fontSize,
      letterSpacingA: state.layers.A.letterSpacing,
      letterSpacingB: state.layers.B.letterSpacing,
      maxWidth,
    });
    styleOverlay(layersA, layersB);
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
    const tileSize = Math.max(50, Math.min(state.fontSize / 1.6, 160));
    for (const ch of shared) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'sf-tile';
      tile.title = `${ch} — clic per ingrandire`;
      const { container, layersA, layersB } = buildOverlay({
        fontA: state.otA,
        fontB: state.otB,
        text: ch,
        fontSize: tileSize,
        padding: 10,
        letterSpacingA: state.layers.A.letterSpacing,
        letterSpacingB: state.layers.B.letterSpacing,
      });
      styleOverlay(layersA, layersB);
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
