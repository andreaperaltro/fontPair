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
 * Lays out a run of text manually (advance widths + kerning, like
 * Font.getPath does internally) so extra letter-spacing can be inserted
 * between glyphs — opentype.js's own getPath() has no such option.
 * @param {opentype.Font} otFont
 * @param {string} text
 * @param {number} fontSize
 * @param {number} letterSpacing - extra space between glyphs, in em (same convention as CSS letter-spacing)
 */
export function pathForRun(otFont, text, fontSize, letterSpacing = 0) {
  const scale = fontSize / otFont.unitsPerEm;
  const glyphs = otFont.stringToGlyphs(text);
  const path = new opentype.Path();
  let x = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    if (i > 0) {
      try { x += otFont.getKerningValue(glyphs[i - 1], glyph) * scale; } catch { /* ignore */ }
    }
    path.extend(glyph.getPath(x, 0, fontSize));
    x += (glyph.advanceWidth || 0) * scale + letterSpacing * fontSize;
  }
  return path;
}

function layoutPath(otFont, text, fontSize, letterSpacing) {
  return letterSpacing ? pathForRun(otFont, text, fontSize, letterSpacing) : otFont.getPath(text, 0, 0, fontSize);
}

/** Per-character advance widths (glyph width + kerning + letter-spacing), in px. */
function glyphAdvances(otFont, text, fontSize, letterSpacing = 0) {
  const scale = fontSize / otFont.unitsPerEm;
  const glyphs = otFont.stringToGlyphs(text);
  const advances = [];
  for (let i = 0; i < glyphs.length; i++) {
    let w = (glyphs[i].advanceWidth || 0) * scale + letterSpacing * fontSize;
    if (i > 0) {
      try { w += otFont.getKerningValue(glyphs[i - 1], glyphs[i]) * scale; } catch { /* ignore */ }
    }
    advances.push(w);
  }
  return advances;
}

function totalWidth(otFont, text, fontSize, letterSpacing) {
  return glyphAdvances(otFont, text, fontSize, letterSpacing).reduce((a, b) => a + b, 0);
}

/** Greedy character wrap: breaks `text` wherever the next glyph would push the
 * running width past `maxWidth`. Always keeps at least one character per line
 * (a single very wide glyph just overflows that one line). */
function wrapTextByWidth(otFont, text, fontSize, letterSpacing, maxWidth) {
  if (!text.length) return [text];
  const advances = glyphAdvances(otFont, text, fontSize, letterSpacing);
  const lines = [];
  let start = 0;
  let acc = 0;
  for (let i = 0; i < text.length; i++) {
    const w = advances[i] || 0;
    if (acc + w > maxWidth && i > start) {
      lines.push(text.slice(start, i));
      start = i;
      acc = 0;
    }
    acc += w;
  }
  lines.push(text.slice(start));
  return lines;
}

/**
 * Splits `text` into lines that fit `maxWidth`, using whichever of the two
 * fonts is wider (at its own letter-spacing) as the reference for *where* to
 * break — then applies those exact same character positions to both fonts.
 * That keeps a word broken at the same letter in both, so overlaid lines
 * stay comparable even though the two fonts' own widths differ slightly.
 */
function computeSharedLines({ fontA, fontB, text, fontSize, letterSpacingA = 0, letterSpacingB = 0, maxWidth = 0 }) {
  if (!maxWidth || maxWidth <= 0) return [text];
  const widthA = totalWidth(fontA, text, fontSize, letterSpacingA);
  const widthB = totalWidth(fontB, text, fontSize, letterSpacingB);
  if (Math.max(widthA, widthB) <= maxWidth) return [text];
  const useA = widthA >= widthB;
  return wrapTextByWidth(useA ? fontA : fontB, text, fontSize, useA ? letterSpacingA : letterSpacingB, maxWidth);
}

/**
 * Builds an SVG <path> element for a single glyph or a run of text.
 * @param {opentype.Font} otFont
 * @param {string} text
 * @param {number} fontSize - in font units-independent px (opentype handles the scale)
 * @param {Object} style - { fill, stroke, strokeWidth, opacity, letterSpacing }
 */
export function pathFor(otFont, text, fontSize, style = {}) {
  const otPath = layoutPath(otFont, text, fontSize, style.letterSpacing || 0);
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

export function boundingBoxFor(otFont, text, fontSize, letterSpacing = 0) {
  const otPath = layoutPath(otFont, text, fontSize, letterSpacing);
  return otPath.getBoundingBox();
}

/**
 * Builds a centered overlay of two fonts rendering the same text, as a
 * container with two stacked, independently-styled SVG layers per line.
 * Each font can have its own letter-spacing. When the text (at the wider
 * font's width) doesn't fit `maxWidth`, it wraps onto several lines —
 * broken at the same character position for both fonts, so the two stay
 * comparable line by line, one `.overlay-stack` (a two-layer pair) per line.
 * Returns { container, layersA, layersB } — arrays (one entry per line) of
 * { svg, path } — so callers can restyle (blend mode, colors, stroke)
 * without re-laying-out.
 */
export function buildOverlay({ fontA, fontB, text, fontSize, padding = 24, letterSpacingA = 0, letterSpacingB = 0, maxWidth = 0 }) {
  const lines = computeSharedLines({ fontA, fontB, text, fontSize, letterSpacingA, letterSpacingB, maxWidth });
  const multiline = lines.length > 1;

  const outer = document.createElement('div');
  outer.className = multiline ? 'overlay-multiline' : 'overlay-stack';

  const layersA = [];
  const layersB = [];

  for (const lineText of lines) {
    const safe = lineText.length ? lineText : ' ';
    const boxA = boundingBoxFor(fontA, safe, fontSize, letterSpacingA);
    const boxB = boundingBoxFor(fontB, safe, fontSize, letterSpacingB);
    const x1 = Math.min(boxA.x1, boxB.x1);
    const y1 = Math.min(boxA.y1, boxB.y1);
    const x2 = Math.max(boxA.x2, boxB.x2);
    const y2 = Math.max(boxA.y2, boxB.y2);
    const width = (x2 - x1) + padding * 2;
    const height = (y2 - y1) + padding * 2;
    const viewBox = `${x1 - padding} ${y1 - padding} ${width} ${height}`;

    // Single line: the outer element itself is the `.overlay-stack` (same
    // shape as before). Several lines: each gets its own `.overlay-stack`
    // stacked vertically inside the outer `.overlay-multiline` column.
    const lineStack = multiline ? document.createElement('div') : outer;
    if (multiline) lineStack.className = 'overlay-stack';

    const makeLayer = (font, letterSpacing) => {
      // Explicit pixel width/height (not a CSS-stretched size) so the
      // on-screen result is the font's actual size at the chosen px value —
      // truthful to the number on the slider, not auto-scaled to fill a
      // fixed-size box. `max-width/max-height` in CSS still shrinks it down
      // if it would overflow the stage, but never enlarges a small one.
      const svg = el('svg', { viewBox, preserveAspectRatio: 'xMidYMid meet', width: Math.round(width), height: Math.round(height) });
      svg.classList.add('overlay-layer');
      const path = pathFor(font, safe, fontSize, { letterSpacing });
      svg.appendChild(path);
      return { svg, path };
    };

    const layerA = makeLayer(fontA, letterSpacingA);
    const layerB = makeLayer(fontB, letterSpacingB);
    lineStack.appendChild(layerA.svg);
    lineStack.appendChild(layerB.svg);
    if (multiline) outer.appendChild(lineStack);

    layersA.push(layerA);
    layersB.push(layerB);
  }

  return { container: outer, layersA, layersB };
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
