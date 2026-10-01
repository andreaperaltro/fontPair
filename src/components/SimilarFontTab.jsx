// "Similar Font" tab: overlay two fonts to compare their shapes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FontPicker } from '@/components/FontPicker.jsx';
import { buildOverlay, applyLayerStyle, BLEND_MODES, DEFAULT_CHARSET, supportedChars } from '@/lib/glyphRender.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

function defaultLayer(color, opacity) {
  return { color, renderMode: 'fill', strokeWidth: 1.5, opacity, letterSpacing: 0 };
}

export function SimilarFontTab() {
  const [fontA, setFontA] = useState(null);
  const [fontB, setFontB] = useState(null);
  const [otA, setOtA] = useState(null);
  const [otB, setOtB] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [mode, setMode] = useState('word');
  const [text, setText] = useState('Hamburgefonstiv');
  const [glyphChar, setGlyphChar] = useState('g');
  const [fontSize, setFontSize] = useState(220);
  const [blend, setBlend] = useState('multiply');
  const [showCurves, setShowCurves] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [layerA, setLayerA] = useState(defaultLayer('#e0342d', 1));
  const [layerB, setLayerB] = useState(defaultLayer('#2f6fed', 0.85));

  const stageRef = useRef(null);
  const [zoomed, setZoomed] = useState(false);

  // Parse both fonts with opentype.js whenever the selected entries change.
  useEffect(() => {
    let cancelled = false;
    if (!fontA || !fontB) { setOtA(null); setOtB(null); return; }
    setLoadError('');
    Promise.all([fontA.getOpentypeFont(), fontB.getOpentypeFont()])
      .then(([a, b]) => { if (!cancelled) { setOtA(a); setOtB(b); } })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [fontA, fontB]);

  function styleOverlay(layersA, layersB) {
    for (const l of layersA) {
      applyLayerStyle(l.path, { mode: layerA.renderMode, color: layerA.color, opacity: layerA.opacity, strokeWidth: layerA.strokeWidth });
      l.svg.style.mixBlendMode = 'normal';
      if (l.curveGroup) l.curveGroup.style.color = layerA.color;
    }
    for (const l of layersB) {
      applyLayerStyle(l.path, { mode: layerB.renderMode, color: layerB.color, opacity: layerB.opacity, strokeWidth: layerB.strokeWidth });
      l.svg.style.mixBlendMode = blend;
      if (l.curveGroup) l.curveGroup.style.color = layerB.color;
    }
  }

  // Imperative render into the stage — buildOverlay() builds real SVG/DOM
  // nodes (ported as-is from the vanilla version), so it's mounted via a
  // ref rather than translated into JSX.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!otA || !otB) {
      stage.innerHTML = loadError
        ? `<p class="sf-placeholder" style="color:hsl(var(--destructive))">Errore nel caricare i font: ${loadError}</p>`
        : '<p class="sf-placeholder text-muted-foreground">Scegli due font per iniziare il confronto.</p>';
      setZoomed(false);
      return;
    }

    stage.innerHTML = '';

    if (mode === 'all') {
      setZoomed(false);
      const charsA = new Set(supportedChars(otA));
      const charsB = new Set(supportedChars(otB));
      const shared = DEFAULT_CHARSET.filter((c) => charsA.has(c) && charsB.has(c));
      if (shared.length === 0) {
        stage.innerHTML = '<p class="sf-placeholder text-muted-foreground">Nessun glifo in comune tra i due font nel set di confronto.</p>';
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'sf-grid';
      // The grid adapts to the chosen size, not the other way around.
      const tileSize = Math.max(50, fontSize / 1.6);
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${Math.round(tileSize + 20)}px, 1fr))`;
      for (const ch of shared) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'sf-tile';
        tile.title = `${ch} — clic per ingrandire`;
        const { container, layersA, layersB } = buildOverlay({
          fontA: otA, fontB: otB, text: ch, fontSize: tileSize, padding: 10,
          letterSpacingA: layerA.letterSpacing, letterSpacingB: layerB.letterSpacing,
        });
        styleOverlay(layersA, layersB);
        tile.appendChild(container);
        tile.addEventListener('click', () => { setMode('glyph'); setGlyphChar(ch); });
        grid.appendChild(tile);
      }
      stage.appendChild(grid);
      return;
    }

    const safeText = mode === 'glyph' ? (glyphChar || 'g') : (text || ' ');
    const effectiveSize = fontSize * zoom;
    const maxWidth = Math.max((stage.clientWidth || 900) - 64, 120);
    const { container, layersA, layersB } = buildOverlay({
      fontA: otA, fontB: otB, text: safeText, fontSize: effectiveSize,
      letterSpacingA: layerA.letterSpacing, letterSpacingB: layerB.letterSpacing,
      maxWidth, showCurves,
      markerBaseSize: fontSize, // un-zoomed, deliberately — see buildCurveMarkers.
    });
    styleOverlay(layersA, layersB);
    container.classList.add('sf-single');
    setZoomed(zoom > 1);
    stage.appendChild(container);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otA, otB, loadError, mode, text, glyphChar, fontSize, blend, showCurves, zoom, layerA, layerB]);

  const modeIsAll = mode === 'all';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
      <div className="space-y-5">
        <FontPicker label="Font A" onSelect={setFontA} />
        <LayerControls layer={layerA} onChange={setLayerA} />
        <FontPicker label="Font B" onSelect={setFontB} />
        <LayerControls layer={layerB} onChange={setLayerB} />
      </div>

      <div className="space-y-5 min-w-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Impostazioni generali</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-6 gap-y-4">
            <div className="min-w-[160px] space-y-1.5">
              <Label>Modalità</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">Parola personalizzata</SelectItem>
                  <SelectItem value="glyph">Glifo singolo</SelectItem>
                  <SelectItem value="all">Tutti i glifi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'word' && (
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label>Testo</Label>
                <Input value={text} onChange={(e) => setText(e.target.value)} />
              </div>
            )}
            {mode === 'glyph' && (
              <div className="min-w-[100px] space-y-1.5">
                <Label>Carattere</Label>
                <Input maxLength={2} value={glyphChar} onChange={(e) => setGlyphChar(e.target.value.slice(0, 1) || 'g')} />
              </div>
            )}

            <div className="min-w-[200px] space-y-1.5">
              <Label>Dimensione glifi: <span className="tabular-nums">{fontSize}</span>px</Label>
              <Slider min={8} max={600} step={1} value={[fontSize]} onValueChange={([v]) => setFontSize(v)} />
            </div>

            <div className="min-w-[200px] space-y-1.5">
              <Label>Blend (tra i due font)</Label>
              <Select value={blend} onValueChange={setBlend}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLEND_MODES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!modeIsAll && (
              <div className="flex items-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={showCurves} onCheckedChange={(v) => setShowCurves(Boolean(v))} />
                  Mostra curve di Bézier
                </label>
              </div>
            )}

            {!modeIsAll && (
              <div className="min-w-[200px] space-y-1.5">
                <Label>Zoom: <span className="tabular-nums">{Math.round(zoom * 100)}</span>%</Label>
                <Slider min={0.5} max={6} step={0.1} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div ref={stageRef} className={`sf-stage ${zoomed ? 'sf-zoomed' : ''}`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LayerControls({ layer, onChange }) {
  function set(patch) { onChange({ ...layer, ...patch }); }
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
        <div className="col-span-2 flex items-center justify-between">
          <Label className="text-muted-foreground">Colore</Label>
          <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value })} className="h-8 w-11 cursor-pointer rounded border border-input bg-transparent p-0.5" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-muted-foreground">Resa</Label>
          <Select value={layer.renderMode} onValueChange={(v) => set({ renderMode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fill">Riempimento</SelectItem>
              <SelectItem value="stroke">Solo contorno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {layer.renderMode === 'stroke' && (
          <div className="col-span-2 space-y-1.5">
            <Label className="text-muted-foreground">Spessore contorno</Label>
            <div className="flex items-center gap-2">
              <Slider min={0.5} max={6} step={0.5} value={[layer.strokeWidth]} onValueChange={([v]) => set({ strokeWidth: v })} />
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{layer.strokeWidth}</span>
            </div>
          </div>
        )}
        <div className="col-span-2 space-y-1.5">
          <Label className="text-muted-foreground">Opacità</Label>
          <div className="flex items-center gap-2">
            <Slider min={0.1} max={1} step={0.05} value={[layer.opacity]} onValueChange={([v]) => set({ opacity: v })} />
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{layer.opacity}</span>
          </div>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-muted-foreground">Spaziatura</Label>
          <div className="flex items-center gap-2">
            <Slider min={-0.05} max={0.5} step={0.01} value={[layer.letterSpacing]} onValueChange={([v]) => set({ letterSpacing: v })} />
            <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{layer.letterSpacing}em</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
