// js/glyphRender.js
// Shared helpers for turning opentype.js paths into SVG, used by both tabs.

export const SVGNS = 'http://www.w3.org/2000/svg';

/** Default comparison charset: basic Latin + common Latin-1/Latin-Extended-A
 * characters, enough for European languages (incl. Italian accents). */
export const DEFAULT_CHARSET = (() => {
  const chars = [];
  for (let c = 0x21; c <= 0x7e; c++) chars.push(String.fromCharCode(c)); // ASCII 33-126
  const extra = 'àèéìòùÀÈÉÌÒÙáéíóúÁÉÍÓÚâêîôûÂÊÎÔÛäëïöüÄËÏÖÜñÑçÇ€£';
  for (const ch of extra) if (!chars.includes(ch)) chars.push(ch);
  return chars;
})();

/** Characters an opentype.js font actually has a real glyph for (not .notdef). */
export function supportedChars(otFont, charset = DEFAULT_CHARSET) {
  return charset.filter((ch) => {
    const glyph = otFont.charToGlyph(ch);
    return glyph && glyph.index !== 0;
  });
}

export function el(tag, attrs = {}) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * Builds an SVG <path> element for a single glyph or a run of text.
 * @param {opentype.Font} otFont
 * @param {string} text
 * @param {number} fontSize - in font units-independent px (opentype handles the scale)
 * @param {Object} style - { fill, stroke, strokeWidth, opacity }
 */
export function pathFor(otFont, text, fontSize, style = {}) {
  const otPath = otFont.getPath(text, 0, 0, fontSize);
  const d = otPath.toPathData(2);
  const attrs = { d };
  if (style.stroke) {
    attrs.fill = style.fill || 'none';
    attrs.stroke = style.stroke;
    attrs['stroke-width'] = style.strokeWidth ?? 1.5;
    attrs['vector-effect'] = 'non-scaling-stroke';
  } else {
    attrs.fill = style.fill || '#000';
  }
  if (style.opacity != null) attrs['fill-opacity'] = style.opacity;
  return el('path', attrs);
}

export function boundingBoxFor(otFont, text, fontSize) {
  const otPath = otFont.getPath(text, 0, 0, fontSize);
  return otPath.getBoundingBox();
}

/**
 * Builds a centered overlay of two fonts rendering the same text, as a
 * container with two stacked, independently-styled SVG layers.
 * Returns { container, svgA, svgB, width, height } so callers can restyle
 * (blend mode, colors, stroke) without re-laying-out.
 */
export function buildOverlay({ fontA, fontB, text, fontSize, padding = 24 }) {
  const boxA = boundingBoxFor(fontA, text, fontSize);
  const boxB = boundingBoxFor(fontB, text, fontSize);
  const x1 = Math.min(boxA.x1, boxB.x1);
  const y1 = Math.min(boxA.y1, boxB.y1);
  const x2 = Math.max(boxA.x2, boxB.x2);
  const y2 = Math.max(boxA.y2, boxB.y2);
  const width = (x2 - x1) + padding * 2;
  const height = (y2 - y1) + padding * 2;
  const viewBox = `${x1 - padding} ${y1 - padding} ${width} ${height}`;

  const container = document.createElement('div');
  container.className = 'overlay-stack';

  const makeLayer = (font) => {
    const svg = el('svg', { viewBox, preserveAspectRatio: 'xMidYMid meet' });
    svg.classList.add('overlay-layer');
    const path = pathFor(font, text, fontSize);
    svg.appendChild(path);
    return { svg, path };
  };

  const layerA = makeLayer(fontA);
  const layerB = makeLayer(fontB);
  container.appendChild(layerA.svg);
  container.appendChild(layerB.svg);

  return { container, layerA, layerB, viewBox, width, height };
}

export function applyLayerStyle(path, { mode, color, opacity, strokeWidth }) {
  path.removeAttribute('stroke');
  path.removeAttribute('stroke-width');
  path.removeAttribute('vector-effect');
  if (mode === 'stroke') {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth ?? 1.5);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
  } else {
    path.setAttribute('fill', color);
  }
  path.setAttribute('fill-opacity', opacity ?? 1);
  path.setAttribute('stroke-opacity', opacity ?? 1);
}

export const BLEND_MODES = [
  { value: 'multiply', label: 'Multiply (rosso/blu classico)' },
  { value: 'difference', label: 'Difference (evidenzia le differenze)' },
  { value: 'screen', label: 'Screen' },
  { value: 'normal', label: 'Normale (nessun blend)' },
];
