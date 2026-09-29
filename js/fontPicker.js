// js/fontPicker.js
// Reusable "choose a font" widget: local system fonts, Google Fonts catalog,
// or an uploaded file. Shared caches mean a font loaded from one picker
// (local fonts list, uploaded files) is instantly available in every other
// picker on the page. Everything is inline and always visible — no
// click-to-open panel: family and weight/style are two separate <select>
// dropdowns, stacked top to bottom (the weight one appears once a family is
// chosen), for every source (Google Fonts, local system fonts, uploads).

import {
  isLocalFontAccessSupported,
  loadLocalFonts,
  getLocalFontsPermissionState,
  groupLocalFontsByFamily,
  loadGoogleFontsCatalog,
  googleFontEntry,
  analyzeGoogleFontWeights,
  getVariableAxes,
  uploadFontEntry,
} from './fontSources.js';

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra-Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'Extra-Bold', 900: 'Black',
};

function weightName(w) {
  return WEIGHT_NAMES[w] || `${w}`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ---- shared state across every picker instance on the page ----
// Local Font Access permission is granted once for the whole page, so every
// picker (Font A, Font B, …) must reflect it immediately — not just the one
// whose button happened to be clicked.
let localFontsPromise = null;
const localFontsListeners = new Set(); // fn(FontEntry[]) => void

function ensureLocalFontsLoaded() {
  if (!localFontsPromise) localFontsPromise = loadLocalFonts();
  return localFontsPromise.then((fonts) => {
    for (const fn of localFontsListeners) fn(fonts);
    return fonts;
  });
}

const uploadedFonts = []; // FontEntry[]
const uploadedFontsListeners = new Set();

function notifyUploads() {
  for (const fn of uploadedFontsListeners) fn(uploadedFonts);
}

function addUploadedFonts(entries) {
  uploadedFonts.push(...entries);
  notifyUploads();
}

export function createFontPicker({ label, onSelect, initial }) {
  const root = document.createElement('div');
  root.className = 'font-picker';
  root.innerHTML = `
    <div class="font-picker-label">${label}</div>
    <div class="fp-selected-summary" ${initial ? '' : 'hidden'}>${initial || ''}</div>
    <div class="fp-tabs">
      <button type="button" class="fp-tab active" data-src="google">Google Fonts</button>
      <button type="button" class="fp-tab" data-src="local">Font del sistema</button>
      <button type="button" class="fp-tab" data-src="upload">Carica file</button>
    </div>
    <div class="fp-body">
      <div class="fp-pane fp-pane-google">
        <div class="fp-field">
          <label class="fp-field-label">Famiglia</label>
          <select class="fp-google-family-select">
            <option value="">Cerco famiglie…</option>
          </select>
        </div>
        <div class="fp-exact">
          <input type="text" class="fp-exact-input" placeholder="…oppure scrivi il nome esatto di una famiglia Google Fonts" />
          <button type="button" class="fp-exact-btn">Carica</button>
        </div>
        <div class="fp-google-weight-block" hidden>
          <label class="fp-field-label">Peso</label>
          <div class="fp-google-weight-status"></div>
          <select class="fp-google-weight-select" hidden></select>
          <div class="fp-google-slider-row" hidden>
            <input type="range" class="fp-google-weight-slider" />
            <span class="fp-google-slider-val"></span>
          </div>
          <label class="fp-google-italic-toggle" hidden>
            <input type="checkbox" class="fp-google-italic-checkbox" /> Corsivo
          </label>
        </div>
      </div>
      <div class="fp-pane fp-pane-local" hidden>
        <div class="fp-local-intro">
          <p>Legge l'elenco dei font installati sul tuo computer (richiede Chrome o Edge).</p>
          <button type="button" class="fp-local-grant">Consenti accesso ai font locali</button>
        </div>
        <div class="fp-local-controls" hidden>
          <div class="fp-field">
            <label class="fp-field-label">Famiglia</label>
            <select class="fp-local-family-select">
              <option value="">Scegli una famiglia…</option>
            </select>
          </div>
          <div class="fp-local-weight-block" hidden>
            <label class="fp-field-label">Peso</label>
            <div class="fp-local-weight-status"></div>
            <select class="fp-local-weight-select" hidden></select>
            <div class="fp-local-slider-row" hidden>
              <input type="range" class="fp-local-weight-slider" />
              <span class="fp-local-slider-val"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="fp-pane fp-pane-upload" hidden>
        <label class="fp-dropzone">
          <input type="file" class="fp-file-input" accept=".ttf,.otf,.woff,.woff2" multiple hidden />
          Trascina un file font qui o clicca per scegliere (.ttf, .otf, .woff, .woff2)
        </label>
        <div class="fp-list fp-upload-list"></div>
      </div>
    </div>
  `;

  const summary = root.querySelector('.fp-selected-summary');
  const tabs = root.querySelectorAll('.fp-tab');
  const panes = {
    google: root.querySelector('.fp-pane-google'),
    local: root.querySelector('.fp-pane-local'),
    upload: root.querySelector('.fp-pane-upload'),
  };

  function select(entry) {
    summary.hidden = false;
    summary.textContent = entry.label;
    onSelect(entry);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.entries(panes).forEach(([key, pane]) => {
        pane.hidden = key !== tab.dataset.src;
      });
    });
  });

  // ---- Google Fonts pane: family dropdown, then weight dropdown/slider ----
  const googleFamilySelect = root.querySelector('.fp-google-family-select');
  const exactInput = root.querySelector('.fp-exact-input');
  const exactBtn = root.querySelector('.fp-exact-btn');
  const googleWeightBlock = root.querySelector('.fp-google-weight-block');
  const googleWeightStatus = root.querySelector('.fp-google-weight-status');
  const googleWeightSelect = root.querySelector('.fp-google-weight-select');
  const googleSliderRow = root.querySelector('.fp-google-slider-row');
  const googleWeightSlider = root.querySelector('.fp-google-weight-slider');
  const googleSliderVal = root.querySelector('.fp-google-slider-val');
  const googleItalicToggle = root.querySelector('.fp-google-italic-toggle');
  const googleItalicCheckbox = root.querySelector('.fp-google-italic-checkbox');

  loadGoogleFontsCatalog().then((catalog) => {
    googleFamilySelect.innerHTML = '<option value="">Scegli una famiglia…</option>' +
      catalog.map((f) => `<option value="${escapeAttr(f.family)}">${f.family} — ${f.category}</option>`).join('');
  });

  let currentGoogleFamily = null;

  function openGoogleWeightStep(family) {
    currentGoogleFamily = family;
    googleWeightBlock.hidden = false;
    googleWeightSelect.hidden = true;
    googleSliderRow.hidden = true;
    googleItalicToggle.hidden = true;
    googleItalicCheckbox.checked = false;
    googleWeightStatus.textContent = 'Cerco i pesi disponibili…';
    analyzeGoogleFontWeights(family).then((info) => {
      googleWeightStatus.textContent = '';
      googleItalicToggle.hidden = !info.hasItalic;
      if (info.variable) {
        googleSliderRow.hidden = false;
        googleWeightSlider.min = info.min;
        googleWeightSlider.max = info.max;
        const startAt = info.min <= 400 && info.max >= 400 ? 400 : info.min;
        googleWeightSlider.value = startAt;
        googleSliderVal.textContent = startAt;
        commitGoogle(startAt, false);
      } else {
        googleWeightSelect.hidden = false;
        googleWeightSelect.innerHTML = info.discrete
          .map((s) => `<option value="${s.weight}|${s.italic ? 1 : 0}">${weightName(s.weight)} ${s.weight}${s.italic ? ' · Corsivo' : ''}</option>`)
          .join('');
        // Default to whichever upright weight is closest to 400 (Regular).
        const upright = info.discrete.filter((s) => !s.italic);
        const preferred = (upright.length ? upright : info.discrete)
          .reduce((best, s) => (Math.abs(s.weight - 400) < Math.abs(best.weight - 400) ? s : best));
        googleWeightSelect.value = `${preferred.weight}|${preferred.italic ? 1 : 0}`;
        const [w, i] = googleWeightSelect.value.split('|');
        commitGoogle(Number(w), i === '1');
      }
    }).catch((err) => {
      googleWeightStatus.textContent = err.message;
    });
  }

  async function commitGoogle(weight, italic) {
    try {
      const entry = googleFontEntry(currentGoogleFamily, { weight, italic });
      await entry.getArrayBuffer();
      select(entry);
    } catch (err) {
      alert(`Impossibile caricare "${currentGoogleFamily}": ${err.message}`);
    }
  }

  googleFamilySelect.addEventListener('change', () => {
    if (googleFamilySelect.value) openGoogleWeightStep(googleFamilySelect.value);
  });

  function loadExact() {
    const family = exactInput.value.trim();
    if (family) {
      googleFamilySelect.value = '';
      openGoogleWeightStep(family);
    }
  }
  exactBtn.addEventListener('click', loadExact);
  exactInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadExact(); });

  googleWeightSelect.addEventListener('change', () => {
    const [w, i] = googleWeightSelect.value.split('|');
    commitGoogle(Number(w), i === '1');
  });
  googleWeightSlider.addEventListener('input', () => { googleSliderVal.textContent = googleWeightSlider.value; });
  googleWeightSlider.addEventListener('change', () => {
    commitGoogle(Number(googleWeightSlider.value), googleItalicCheckbox.checked);
  });
  googleItalicCheckbox.addEventListener('change', () => {
    commitGoogle(Number(googleWeightSlider.value), googleItalicCheckbox.checked);
  });

  // ---- Local fonts pane: family dropdown, then weight dropdown/slider ----
  const localGrantBtn = root.querySelector('.fp-local-grant');
  const localIntro = root.querySelector('.fp-local-intro');
  const localControls = root.querySelector('.fp-local-controls');
  const localFamilySelect = root.querySelector('.fp-local-family-select');
  const localWeightBlock = root.querySelector('.fp-local-weight-block');
  const localWeightStatus = root.querySelector('.fp-local-weight-status');
  const localWeightSelect = root.querySelector('.fp-local-weight-select');
  const localSliderRow = root.querySelector('.fp-local-slider-row');
  const localWeightSlider = root.querySelector('.fp-local-weight-slider');
  const localSliderVal = root.querySelector('.fp-local-slider-val');
  let localFamilies = [];

  function renderLocalFamilySelect() {
    const prev = localFamilySelect.value;
    localFamilySelect.innerHTML = '<option value="">Scegli una famiglia…</option>' +
      localFamilies.map((g) => `<option value="${escapeAttr(g.family)}">${g.family}</option>`).join('');
    if (prev && localFamilies.some((g) => g.family === prev)) localFamilySelect.value = prev;
  }

  async function openLocalWeightStep(group) {
    localWeightBlock.hidden = false;
    localWeightSelect.hidden = true;
    localSliderRow.hidden = true;
    localWeightStatus.textContent = '';

    if (group.entries.length > 1) {
      // Several installed styles for this family (the common case): a plain
      // dropdown of exactly those styles.
      localWeightSelect.hidden = false;
      localWeightSelect.innerHTML = group.entries
        .map((entry, i) => `<option value="${i}">${entry.meta.style || entry.label}</option>`)
        .join('');
      localWeightSelect.onchange = () => select(group.entries[Number(localWeightSelect.value)]);
      select(group.entries[0]);
      return;
    }

    // A single installed face: check whether it's actually a variable font
    // (one file covering a whole weight range) so we can offer a slider.
    const entry = group.entries[0];
    localWeightStatus.textContent = 'Controllo se è un font variabile…';
    try {
      const otFont = await entry.getOpentypeFont();
      const axes = getVariableAxes(otFont);
      localWeightStatus.textContent = '';
      if (axes && axes.wght) {
        localSliderRow.hidden = false;
        localWeightSlider.min = Math.round(axes.wght.min);
        localWeightSlider.max = Math.round(axes.wght.max);
        const def = Math.round(axes.wght.default);
        localWeightSlider.value = def;
        localSliderVal.textContent = def;
        applyLocalVariableWeight(entry, def);
      } else {
        select(entry);
      }
    } catch (err) {
      localWeightStatus.textContent = '';
      select(entry); // fall back to plain selection if inspection fails
    }
  }

  function applyLocalVariableWeight(entry, weight) {
    // Same underlying file for any weight on this axis — just tag which
    // instance was requested, so CSS-rendered text (Font Pair) can apply
    // font-variation-settings for a true live preview at that weight.
    entry.meta.variableWeight = weight;
    entry.label = `${entry.meta.family} · ${weight} (variabile)`;
    select(entry);
  }

  localFamilySelect.addEventListener('change', () => {
    const group = localFamilies.find((g) => g.family === localFamilySelect.value);
    if (group) openLocalWeightStep(group);
  });
  localWeightSlider.addEventListener('input', () => { localSliderVal.textContent = localWeightSlider.value; });
  localWeightSlider.addEventListener('change', () => {
    const group = localFamilies.find((g) => g.family === localFamilySelect.value);
    if (group) applyLocalVariableWeight(group.entries[0], Number(localWeightSlider.value));
  });

  if (!isLocalFontAccessSupported()) {
    localIntro.innerHTML = '<p>Il tuo browser non supporta l\'accesso ai font locali (Local Font Access API). Usa Chrome o Edge, oppure carica un file.</p>';
  } else {
    function showLocalFonts(fonts) {
      localFamilies = groupLocalFontsByFamily(fonts);
      localIntro.hidden = true;
      localControls.hidden = false;
      renderLocalFamilySelect();
    }
    // Reused by every picker on the page: as soon as any of them loads the
    // local font list (via the button below, or the auto-check further
    // down), all the others pick it up too — no separate "consenti accesso"
    // per column.
    localFontsListeners.add(showLocalFonts);

    localGrantBtn.addEventListener('click', async () => {
      localGrantBtn.disabled = true;
      localGrantBtn.textContent = 'Attendo permesso…';
      try {
        await ensureLocalFontsLoaded();
      } catch (err) {
        alert(err.message);
        localGrantBtn.disabled = false;
        localGrantBtn.textContent = 'Consenti accesso ai font locali';
      }
    });

    if (localFontsPromise) {
      // Another picker already requested (or already has) access.
      localFontsPromise.then(showLocalFonts);
    } else {
      // The browser remembers this permission across reloads/visits: if it
      // was already granted earlier, skip the button and load straight away.
      getLocalFontsPermissionState().then((state) => {
        if (state !== 'granted') return;
        localGrantBtn.disabled = true;
        localGrantBtn.textContent = 'Carico i font locali…';
        ensureLocalFontsLoaded().catch((err) => {
          alert(err.message);
          localGrantBtn.disabled = false;
          localGrantBtn.textContent = 'Consenti accesso ai font locali';
        });
      });
    }
  }

  // ---- Upload pane ----
  const uploadList = root.querySelector('.fp-upload-list');
  const fileInput = root.querySelector('.fp-file-input');
  const dropzone = root.querySelector('.fp-dropzone');

  function renderUploadList() {
    uploadList.innerHTML = '';
    for (const entry of uploadedFonts) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'fp-item';
      item.innerHTML = `<span>${entry.label}</span>`;
      item.addEventListener('click', () => select(entry));
      uploadList.appendChild(item);
    }
    if (uploadedFonts.length === 0) {
      uploadList.innerHTML = '<div class="fp-empty">Nessun file caricato ancora.</div>';
    }
  }
  uploadedFontsListeners.add(renderUploadList);
  renderUploadList();

  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const entries = Array.from(fileInput.files).map(uploadFontEntry);
    addUploadedFonts(entries);
    fileInput.value = '';
  });
  ['dragover', 'dragenter'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
  );
  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(ttf|otf|woff2?|)$/i.test(f.name));
    if (files.length) addUploadedFonts(files.map(uploadFontEntry));
  });

  return root;
}
