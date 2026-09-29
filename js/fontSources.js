// js/fontSources.js
// Unified font source layer: local system fonts (Local Font Access API),
// Google Fonts (fetched live as real font files), and user-uploaded files.
// Every FontEntry exposes the same interface so the rest of the app never
// has to care where the bytes came from.

const otFontCache = new WeakMap();

export class FontEntry {
  /**
   * @param {Object} opts
   * @param {string} opts.id - stable unique id
   * @param {string} opts.label - human readable label
   * @param {'local'|'google'|'upload'} opts.source
   * @param {() => Promise<ArrayBuffer>} opts.getArrayBuffer
   */
  constructor({ id, label, source, getArrayBuffer, meta = {} }) {
    this.id = id;
    this.label = label;
    this.source = source;
    this.meta = meta;
    this._getArrayBuffer = getArrayBuffer;
    this._bufferPromise = null;
  }

  getArrayBuffer() {
    if (!this._bufferPromise) this._bufferPromise = this._getArrayBuffer();
    return this._bufferPromise;
  }

  async getOpentypeFont() {
    const buf = await this.getArrayBuffer();
    if (otFontCache.has(buf)) return otFontCache.get(buf);
    const font = opentype.parse(buf.slice(0));
    otFontCache.set(buf, font);
    return font;
  }

  /** Register (or reuse) a CSS FontFace under the given family name and return it. */
  async loadFontFace(cssFamilyName) {
    if (this._faceFamily === cssFamilyName && this._face) return this._face;
    const buf = await this.getArrayBuffer();
    const face = new FontFace(cssFamilyName, buf.slice(0));
    await face.load();
    document.fonts.add(face);
    this._face = face;
    this._faceFamily = cssFamilyName;
    return face;
  }
}

// ---------- Local fonts (Local Font Access API) ----------

export function isLocalFontAccessSupported() {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}

export async function loadLocalFonts() {
  if (!isLocalFontAccessSupported()) {
    throw new Error('Local Font Access non è supportato in questo browser (usa Chrome o Edge).');
  }
  const fonts = await window.queryLocalFonts();
  return fonts
    .map((f) => new FontEntry({
      id: `local:${f.postscriptName}`,
      label: `${f.fullName}`,
      source: 'local',
      meta: { family: f.family, style: f.style, postscriptName: f.postscriptName },
      getArrayBuffer: async () => {
        const blob = await f.blob();
        return blob.arrayBuffer();
      },
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- Google Fonts ----------

function buildCss2Url(family, { weight = 400, italic = false } = {}) {
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const familyParam = `${encodeURIComponent(family)}:${axis}`;
  return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
}

/** Parses a Google Fonts css2 response into per-subset @font-face descriptors. */
function parseCss2(cssText) {
  const blocks = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(cssText))) {
    const [, subset, body] = m;
    const urlMatch = body.match(/src:\s*url\((https:[^)]+)\)\s*format\('([^']+)'\)/);
    if (!urlMatch) continue;
    blocks.push({ subset, url: urlMatch[1], format: urlMatch[2] });
  }
  if (blocks.length === 0) {
    // Some responses (very small charset fonts) have no comment markers.
    const urlMatch = cssText.match(/src:\s*url\((https:[^)]+)\)\s*format\('([^']+)'\)/);
    if (urlMatch) blocks.push({ subset: 'default', url: urlMatch[1], format: urlMatch[2] });
  }
  return blocks;
}

async function fetchGoogleFontFile(family, opts) {
  const cssUrl = buildCss2Url(family, opts);
  const cssRes = await fetch(cssUrl);
  if (!cssRes.ok) throw new Error(`Google Fonts non ha una famiglia chiamata "${family}".`);
  const cssText = await cssRes.text();
  const blocks = parseCss2(cssText);
  if (blocks.length === 0) throw new Error(`Nessun file font trovato per "${family}".`);
  const preferred = blocks.find((b) => b.subset === 'latin') || blocks[0];
  const fileRes = await fetch(preferred.url);
  if (!fileRes.ok) throw new Error(`Impossibile scaricare il file del font per "${family}".`);
  return fileRes.arrayBuffer();
}

export function googleFontEntry(family, { weight = 400, italic = false } = {}) {
  const styleLabel = `${weight}${italic ? ' Italic' : ''}`;
  return new FontEntry({
    id: `google:${family}:${weight}${italic ? 'i' : ''}`,
    label: `${family} · ${styleLabel}`,
    source: 'google',
    meta: { family, weight, italic },
    getArrayBuffer: () => fetchGoogleFontFile(family, { weight, italic }),
  });
}

let _catalogPromise = null;
export function loadGoogleFontsCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = fetch('data/google-fonts.json').then((r) => r.json());
  }
  return _catalogPromise;
}

// ---------- Uploaded font files ----------

export function uploadFontEntry(file) {
  return new FontEntry({
    id: `upload:${file.name}:${file.size}:${file.lastModified}`,
    label: file.name.replace(/\.(ttf|otf|woff2?|)$/i, ''),
    source: 'upload',
    meta: { fileName: file.name },
    getArrayBuffer: () => file.arrayBuffer(),
  });
}
