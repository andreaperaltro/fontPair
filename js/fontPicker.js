// js/fontPicker.js
// Reusable "choose a font" widget: local system fonts, Google Fonts catalog,
// or an uploaded file. Shared caches mean a font loaded from one picker
// (local fonts list, uploaded files) is instantly available in every other
// picker on the page.

import {
  isLocalFontAccessSupported,
  loadLocalFonts,
  getLocalFontsPermissionState,
  loadGoogleFontsCatalog,
  googleFontEntry,
  fetchGoogleFontStyles,
  uploadFontEntry,
} from './fontSources.js';

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra-Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'Extra-Bold', 900: 'Black',
};

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

let pickerIdCounter = 0;

export function createFontPicker({ label, onSelect, initial }) {
  const uid = `fp-${pickerIdCounter++}`;
  const root = document.createElement('div');
  root.className = 'font-picker';
  root.innerHTML = `
    <div class="font-picker-label">${label}</div>
    <button type="button" class="font-picker-trigger" aria-haspopup="true">
      <span class="fp-current">${initial || 'Scegli un font…'}</span>
      <span class="fp-chevron">▾</span>
    </button>
    <div class="font-picker-panel" hidden>
      <div class="fp-tabs">
        <button type="button" class="fp-tab active" data-src="google">Google Fonts</button>
        <button type="button" class="fp-tab" data-src="local">Font del sistema</button>
        <button type="button" class="fp-tab" data-src="upload">Carica file</button>
      </div>
      <div class="fp-body">
        <div class="fp-pane fp-pane-google">
          <div class="fp-google-step-list">
            <input type="search" class="fp-search" placeholder="Cerca tra le famiglie…" />
            <div class="fp-list fp-google-list"></div>
            <div class="fp-exact">
              <input type="text" class="fp-exact-input" placeholder="…oppure scrivi il nome esatto di una famiglia Google Fonts" />
              <button type="button" class="fp-exact-btn">Carica</button>
            </div>
          </div>
          <div class="fp-google-step-weight" hidden>
            <button type="button" class="fp-back">‹ Cambia font</button>
            <div class="fp-weight-family-name"></div>
            <div class="fp-weight-status"></div>
            <div class="fp-weight-grid"></div>
          </div>
        </div>
        <div class="fp-pane fp-pane-local" hidden>
          <div class="fp-local-intro">
            <p>Legge l'elenco dei font installati sul tuo computer (richiede Chrome o Edge).</p>
            <button type="button" class="fp-local-grant">Consenti accesso ai font locali</button>
          </div>
          <input type="search" class="fp-search-local" placeholder="Cerca…" hidden />
          <div class="fp-list fp-local-list"></div>
        </div>
        <div class="fp-pane fp-pane-upload" hidden>
          <label class="fp-dropzone">
            <input type="file" class="fp-file-input" accept=".ttf,.otf,.woff,.woff2" multiple hidden />
            Trascina un file font qui o clicca per scegliere (.ttf, .otf, .woff, .woff2)
          </label>
          <div class="fp-list fp-upload-list"></div>
        </div>
      </div>
    </div>
  `;

  const trigger = root.querySelector('.font-picker-trigger');
  const panel = root.querySelector('.font-picker-panel');
  const currentLabel = root.querySelector('.fp-current');
  const tabs = root.querySelectorAll('.fp-tab');
  const panes = {
    google: root.querySelector('.fp-pane-google'),
    local: root.querySelector('.fp-pane-local'),
    upload: root.querySelector('.fp-pane-upload'),
  };

  function select(entry) {
    currentLabel.textContent = entry.label;
    panel.hidden = true;
    onSelect(entry);
  }

  trigger.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !panel.hidden;
    if (opening) showGoogleListStep();
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) panel.hidden = true;
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.entries(panes).forEach(([key, pane]) => {
        pane.hidden = key !== tab.dataset.src;
      });
    });
  });

  // ---- Google Fonts pane: step 1, pick a family ----
  const googleList = root.querySelector('.fp-google-list');
  const search = root.querySelector('.fp-search');
  let catalog = [];

  function renderGoogleList(filter = '') {
    const q = filter.trim().toLowerCase();
    const matches = q
      ? catalog.filter((f) => f.family.toLowerCase().includes(q))
      : catalog.slice(0, 60);
    googleList.innerHTML = '';
    for (const f of matches.slice(0, 200)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'fp-item';
      item.innerHTML = `<span>${f.family}</span><span class="fp-item-meta">${f.category}</span>`;
      item.addEventListener('click', () => showGoogleWeightStep(f.family));
      googleList.appendChild(item);
    }
    if (matches.length === 0) {
      googleList.innerHTML = '<div class="fp-empty">Nessuna famiglia trovata nel catalogo curato. Prova il campo qui sotto per caricarla comunque per nome esatto.</div>';
    }
  }

  loadGoogleFontsCatalog().then((data) => {
    catalog = data;
    search.placeholder = `Cerca tra ${data.length} famiglie…`;
    renderGoogleList();
  });
  search.addEventListener('input', () => renderGoogleList(search.value));

  const exactInput = root.querySelector('.fp-exact-input');
  const exactBtn = root.querySelector('.fp-exact-btn');
  function loadExact() {
    const family = exactInput.value.trim();
    if (family) showGoogleWeightStep(family);
  }
  exactBtn.addEventListener('click', loadExact);
  exactInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadExact(); });

  // ---- Google Fonts pane: step 2, pick a weight/style for that family ----
  const stepList = root.querySelector('.fp-google-step-list');
  const stepWeight = root.querySelector('.fp-google-step-weight');
  const backBtn = root.querySelector('.fp-back');
  const weightFamilyName = root.querySelector('.fp-weight-family-name');
  const weightStatus = root.querySelector('.fp-weight-status');
  const weightGrid = root.querySelector('.fp-weight-grid');

  function showGoogleListStep() {
    stepList.hidden = false;
    stepWeight.hidden = true;
  }

  function showGoogleWeightStep(family) {
    stepList.hidden = true;
    stepWeight.hidden = false;
    weightFamilyName.textContent = family;
    weightGrid.innerHTML = '';
    weightStatus.textContent = 'Cerco i pesi disponibili…';
    fetchGoogleFontStyles(family)
      .then((styles) => {
        weightStatus.textContent = '';
        renderWeightGrid(family, styles);
      })
      .catch((err) => {
        weightStatus.textContent = err.message;
      });
  }

  function renderWeightGrid(family, styles) {
    weightGrid.innerHTML = '';
    for (const { weight, italic } of styles) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-weight-item';
      const name = WEIGHT_NAMES[weight] || weight;
      btn.textContent = `${name} ${weight}${italic ? ' · Corsivo' : ''}`;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Carico…';
        try {
          const entry = googleFontEntry(family, { weight, italic });
          await entry.getArrayBuffer();
          select(entry);
        } catch (err) {
          alert(`Impossibile caricare "${family}": ${err.message}`);
          btn.disabled = false;
          btn.textContent = original;
        }
      });
      weightGrid.appendChild(btn);
    }
  }

  backBtn.addEventListener('click', showGoogleListStep);

  // ---- Local fonts pane ----
  const localList = root.querySelector('.fp-local-list');
  const localGrantBtn = root.querySelector('.fp-local-grant');
  const localIntro = root.querySelector('.fp-local-intro');
  const localSearch = root.querySelector('.fp-search-local');
  let localFonts = [];

  function renderLocalList(filter = '') {
    const q = filter.trim().toLowerCase();
    const matches = q ? localFonts.filter((f) => f.label.toLowerCase().includes(q)) : localFonts;
    localList.innerHTML = '';
    for (const entry of matches.slice(0, 300)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'fp-item';
      item.innerHTML = `<span>${entry.label}</span>`;
      item.addEventListener('click', () => select(entry));
      localList.appendChild(item);
    }
  }

  if (!isLocalFontAccessSupported()) {
    localIntro.innerHTML = '<p>Il tuo browser non supporta l\'accesso ai font locali (Local Font Access API). Usa Chrome o Edge, oppure carica un file.</p>';
  } else {
    function showLocalFonts(fonts) {
      localFonts = fonts;
      localIntro.hidden = true;
      localSearch.hidden = false;
      renderLocalList();
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
    localSearch.addEventListener('input', () => renderLocalList(localSearch.value));

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
