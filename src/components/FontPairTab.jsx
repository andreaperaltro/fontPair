// "Font Pair" tab: glyph sets + type-scale role assignment.
import { useEffect, useRef, useState } from 'react';
import { FontPicker } from '@/components/FontPicker.jsx';
import { DEFAULT_CHARSET, supportedChars } from '@/lib/glyphRender.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Standard type-scale pattern (~1.25 "major third" ratio, rounded to clean
// values). Sizes stay editable per role — this is just the sensible
// starting point.
const DEFAULT_ROLES = [
  { id: 'eyebrow', name: 'Eyebrow / Overline', text: 'CATEGORIA', size: 12, assign: 'A', uppercase: true, letterSpacing: 0.14 },
  { id: 'display', name: 'Display', text: 'Grande titolo', size: 48, assign: 'A', letterSpacing: 0 },
  { id: 'title', name: 'Title (H1)', text: 'Un titolo che cattura l’attenzione', size: 32, assign: 'A', letterSpacing: 0 },
  { id: 'subtitle', name: 'Subtitle (H2)', text: 'Un sottotitolo che spiega meglio il contesto', size: 20, assign: 'B', letterSpacing: 0 },
  { id: 'body', name: 'Body', text: 'Questo è un paragrafo di prova per valutare la leggibilità dell’abbinamento tra i due font scelti, su più righe di testo continuo.', size: 16, assign: 'B', letterSpacing: 0 },
  { id: 'caption', name: 'Caption', text: 'Didascalia o nota a piè di pagina', size: 13, assign: 'B', letterSpacing: 0 },
  { id: 'button', name: 'Button / Label', text: 'SCOPRI DI PIÙ', size: 14, assign: 'A', uppercase: true, letterSpacing: 0.06 },
];

export function FontPairTab() {
  const [fontA, setFontA] = useState(null);
  const [fontB, setFontB] = useState(null);
  const [facesReady, setFacesReady] = useState(false);
  const [roles, setRoles] = useState(DEFAULT_ROLES.map((r) => ({ ...r })));
  const [glyphsA, setGlyphsA] = useState(null);
  const [glyphsB, setGlyphsB] = useState(null);
  const [exportStatus, setExportStatus] = useState('');

  const ready = Boolean(fontA && fontB && facesReady);

  useEffect(() => {
    let cancelled = false;
    setFacesReady(false);
    (async () => {
      if (fontA) { try { await fontA.loadFontFace('FP-FontA'); } catch (err) { console.error(err); } }
      if (fontB) { try { await fontB.loadFontFace('FP-FontB'); } catch (err) { console.error(err); } }
      if (!cancelled) setFacesReady(true);
    })();
    return () => { cancelled = true; };
  }, [fontA, fontB]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fontA) { setGlyphsA(null); return; }
      const otFont = await fontA.getOpentypeFont();
      if (!cancelled) setGlyphsA(supportedChars(otFont, DEFAULT_CHARSET));
    })();
    return () => { cancelled = true; };
  }, [fontA]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fontB) { setGlyphsB(null); return; }
      const otFont = await fontB.getOpentypeFont();
      if (!cancelled) setGlyphsB(supportedChars(otFont, DEFAULT_CHARSET));
    })();
    return () => { cancelled = true; };
  }, [fontB]);

  function familyFor(assign) {
    return assign === 'A' ? 'FP-FontA' : 'FP-FontB';
  }
  function variationFor(assign) {
    const entry = assign === 'A' ? fontA : fontB;
    const w = entry?.meta?.variableWeight;
    return w ? `'wght' ${w}` : 'normal';
  }

  function updateRole(id, patch) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function buildCssSnippet() {
    const lines = ['/* Font Pair — abbinamento generato con fontPair */'];
    for (const [label, entry] of [['Font A', fontA], ['Font B', fontB]]) {
      if (!entry) continue;
      lines.push('');
      if (entry.source === 'google') {
        const { family, weight, italic } = entry.meta;
        const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
        lines.push(`/* ${label}: Google Fonts — aggiungi nel <head>: */`);
        lines.push(`/* <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&display=swap"> */`);
        lines.push(`/* poi usa font-family: '${family}', sans-serif; */`);
      } else {
        lines.push(`/* ${label}: font ${entry.source === 'local' ? 'locale' : 'caricato'} ("${entry.label}") — self-hostalo e aggiorna il src qui sotto */`);
        lines.push(`@font-face {`);
        lines.push(`  font-family: '${label === 'Font A' ? 'FontA' : 'FontB'}';`);
        lines.push(`  src: url('./fonts/${entry.label.replace(/\s+/g, '-')}.woff2') format('woff2');`);
        lines.push(`}`);
      }
    }
    lines.push('');
    for (const role of roles) {
      const familyName = role.assign === 'A'
        ? (fontA?.source === 'google' ? fontA.meta.family : 'FontA')
        : (fontB?.source === 'google' ? fontB.meta.family : 'FontB');
      lines.push(`.${role.id} {`);
      lines.push(`  font-family: '${familyName}', sans-serif;`);
      lines.push(`  font-size: ${role.size}px;`);
      if (role.uppercase) lines.push(`  text-transform: uppercase;`);
      if (role.letterSpacing) lines.push(`  letter-spacing: ${role.letterSpacing}em;`);
      lines.push(`}`);
    }
    return lines.join('\n');
  }

  async function handleExport() {
    const css = buildCssSnippet();
    try {
      await navigator.clipboard.writeText(css);
      setExportStatus('CSS copiato negli appunti ✓');
    } catch {
      setExportStatus("Copia non riuscita: apri la console per il CSS.");
      console.log(css);
    }
    setTimeout(() => setExportStatus(''), 3000);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FontPicker label="Font A" onSelect={setFontA} />
        <FontPicker label="Font B" onSelect={setFontB} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Set di glifi</CardTitle>
          {!ready && <CardDescription>Scegli due font per vedere i caratteri disponibili in ciascuno.</CardDescription>}
        </CardHeader>
        {ready && (
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <GlyphColumn label="Font A" entry={fontA} glyphs={glyphsA} family="FP-FontA" />
            <GlyphColumn label="Font B" entry={fontB} glyphs={glyphsB} family="FP-FontB" />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Scala tipografica</CardTitle>
          <CardDescription>
            Scala standard (rapporto ~1.25), pensata per leggersi come una pagina: cambia font e dimensione a sinistra, il testo a destra è modificabile direttamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ready && <p className="pb-3 text-sm text-muted-foreground">Scegli due font per vedere l'anteprima combinata.</p>}
          <div className="divide-y rounded-lg bg-muted/30">
            {roles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                ready={ready}
                familyFor={familyFor}
                variationFor={variationFor}
                onChange={(patch) => updateRole(role.id, patch)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleExport}>Copia CSS dell'abbinamento</Button>
        <span className="text-sm text-muted-foreground">{exportStatus}</span>
      </div>
    </div>
  );
}

function GlyphColumn({ label, entry, glyphs, family }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">
        {label} — {entry.label}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          ({glyphs ? glyphs.length : '…'}/{DEFAULT_CHARSET.length} caratteri)
        </span>
      </h4>
      <div
        className="glyph-set"
        style={{
          fontFamily: `'${family}', sans-serif`,
          fontVariationSettings: entry.meta?.variableWeight ? `'wght' ${entry.meta.variableWeight}` : 'normal',
        }}
      >
        {(glyphs || []).map((ch, i) => (
          <span key={i} className="glyph-cell">{ch}</span>
        ))}
      </div>
    </div>
  );
}

function RoleRow({ role, ready, familyFor, variationFor, onChange }) {
  const previewRef = useRef(null);

  // contentEditable's own text is the source of truth while the user types —
  // only re-sync from state when it actually differs (role.text changed
  // from elsewhere), so typing doesn't get its caret reset every render.
  useEffect(() => {
    if (previewRef.current && previewRef.current.textContent !== role.text) {
      previewRef.current.textContent = role.text;
    }
  }, [role.text]);

  return (
    <div className="grid grid-cols-[150px_1fr] items-start gap-4 px-4 py-3">
      <div className="space-y-2 pt-0.5">
        <div className="text-[0.72rem] uppercase tracking-wide text-muted-foreground">{role.name}</div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={role.assign === 'A' ? 'default' : 'outline'}
            className="h-7 w-7 p-0"
            onClick={() => onChange({ assign: 'A' })}
          >A</Button>
          <Button
            type="button"
            size="sm"
            variant={role.assign === 'B' ? 'default' : 'outline'}
            className="h-7 w-7 p-0"
            onClick={() => onChange({ assign: 'B' })}
          >B</Button>
        </div>
        <label className="block space-y-1">
          <span className="text-[0.68rem] uppercase tracking-wide text-muted-foreground/75">Dimensione</span>
          <span className="flex items-center gap-1">
            <Input
              type="number"
              min={8}
              max={140}
              value={role.size}
              onChange={(e) => onChange({ size: Number(e.target.value) || role.size })}
              className="h-7 w-16 px-2 text-xs"
            />px
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-[0.68rem] uppercase tracking-wide text-muted-foreground/75">Spaziatura</span>
          <span className="flex items-center gap-1">
            <Input
              type="number"
              step={0.01}
              value={role.letterSpacing ?? 0}
              onChange={(e) => onChange({ letterSpacing: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="h-7 w-16 px-2 text-xs"
            />em
          </span>
        </label>
      </div>
      <div className="min-w-0">
        <div
          ref={previewRef}
          className="role-preview-text"
          contentEditable={ready}
          suppressContentEditableWarning
          spellCheck={false}
          style={{
            fontFamily: ready ? `'${familyFor(role.assign)}', sans-serif` : 'inherit',
            fontVariationSettings: ready ? variationFor(role.assign) : 'normal',
            fontSize: `${role.size}px`,
            textTransform: role.uppercase ? 'uppercase' : 'none',
            letterSpacing: `${role.letterSpacing ?? 0}em`,
          }}
          onInput={(e) => { role.text = e.currentTarget.textContent; }}
          onBlur={(e) => { if (!e.currentTarget.textContent.trim()) e.currentTarget.textContent = role.text; }}
        />
      </div>
    </div>
  );
}
