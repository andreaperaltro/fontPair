// Reusable "choose a font" widget: local system fonts, Google Fonts catalog,
// or an uploaded file. Shared stores (sharedFontStores.js) mean a font loaded
// from one picker (local fonts list, uploaded files) is instantly available
// in every other picker on the page. Family and weight/style are always
// visible (no click-to-open panel) for every source.
import { useEffect, useMemo, useState, useSyncExternalStore, useRef } from 'react';
import {
  isLocalFontAccessSupported,
  getLocalFontsPermissionState,
  loadGoogleFontsCatalog,
  googleFontEntry,
  analyzeGoogleFontWeights,
  getVariableAxes,
  uploadFontEntry,
} from '@/lib/fontSources.js';
import { localFontsStore, ensureLocalFontsLoaded, uploadedFontsStore, addUploadedFonts } from '@/lib/sharedFontStores.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra-Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'Extra-Bold', 900: 'Black',
};
const weightName = (w) => WEIGHT_NAMES[w] || `${w}`;

export function FontPicker({ label, onSelect }) {
  const [activeTab, setActiveTab] = useState('google');
  const [selectedLabel, setSelectedLabel] = useState('');

  function select(entry) {
    setSelectedLabel(entry.label);
    onSelect(entry);
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{label}</CardTitle>
          {selectedLabel && <Badge variant="secondary" className="max-w-[60%] truncate">{selectedLabel}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google">Google Fonts</TabsTrigger>
            <TabsTrigger value="local">Sistema</TabsTrigger>
            <TabsTrigger value="upload">File</TabsTrigger>
          </TabsList>
          <TabsContent value="google">
            <GooglePane onSelect={select} />
          </TabsContent>
          <TabsContent value="local">
            <LocalPane onSelect={select} />
          </TabsContent>
          <TabsContent value="upload">
            <UploadPane onSelect={select} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------- //
// Google Fonts pane
// ---------------------------------------------------------------------- //

function GooglePane({ onSelect }) {
  const [catalog, setCatalog] = useState([]);
  const [family, setFamily] = useState('');
  const [exactValue, setExactValue] = useState('');
  const [currentFamily, setCurrentFamily] = useState(null);
  const [status, setStatus] = useState('');
  const [weightInfo, setWeightInfo] = useState(null); // { variable, discrete, hasItalic }
  const [sliderIdx, setSliderIdx] = useState(0);
  const [sliderSteps, setSliderSteps] = useState([]);
  const [discreteValue, setDiscreteValue] = useState(''); // "weight|italic"
  const [italic, setItalic] = useState(false);

  useEffect(() => {
    loadGoogleFontsCatalog().then(setCatalog);
  }, []);

  async function commit(weight, isItalic, famOverride) {
    const fam = famOverride ?? currentFamily;
    try {
      const entry = googleFontEntry(fam, { weight, italic: isItalic });
      await entry.getArrayBuffer();
      onSelect(entry);
    } catch (err) {
      alert(`Impossibile caricare "${fam}": ${err.message}`);
    }
  }

  async function openWeightStep(fam) {
    setCurrentFamily(fam);
    setWeightInfo(null);
    setItalic(false);
    setStatus('Cerco i pesi disponibili…');
    try {
      const info = await analyzeGoogleFontWeights(fam);
      setStatus('');
      setWeightInfo(info);
      if (info.variable) {
        // Canonical stops only: Google's css2 API only reliably returns a
        // genuine, distinct static instance for the standard 100-step
        // weights it actually has — an off-grid weight in between often
        // silently comes back as the family's default instance instead, so
        // the slider is index-based over these confirmed-good stops.
        const steps = Array.from(new Set(info.discrete.filter((s) => !s.italic).map((s) => s.weight))).sort((a, b) => a - b);
        const finalSteps = steps.length ? steps : [info.min];
        setSliderSteps(finalSteps);
        let startIdx = 0;
        for (let i = 0; i < finalSteps.length; i++) {
          if (Math.abs(finalSteps[i] - 400) < Math.abs(finalSteps[startIdx] - 400)) startIdx = i;
        }
        setSliderIdx(startIdx);
        commit(finalSteps[startIdx], false, fam);
      } else {
        const upright = info.discrete.filter((s) => !s.italic);
        const preferred = (upright.length ? upright : info.discrete)
          .reduce((best, s) => (Math.abs(s.weight - 400) < Math.abs(best.weight - 400) ? s : best));
        const val = `${preferred.weight}|${preferred.italic ? 1 : 0}`;
        setDiscreteValue(val);
        commit(preferred.weight, preferred.italic, fam);
      }
    } catch (err) {
      setStatus(err.message);
    }
  }

  function loadExact() {
    const fam = exactValue.trim();
    if (fam) {
      setFamily('');
      openWeightStep(fam);
    }
  }

  const sliderWeight = sliderSteps[sliderIdx] ?? sliderSteps[0];

  return (
    <div className="space-y-4 pt-3">
      <div className="space-y-1.5">
        <Label>Famiglia</Label>
        <Select
          value={family}
          onValueChange={(v) => { setFamily(v); openWeightStep(v); }}
        >
          <SelectTrigger>
            <SelectValue placeholder={catalog.length ? 'Scegli una famiglia…' : 'Cerco famiglie…'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {catalog.map((f) => (
              <SelectItem key={f.family} value={f.family}>{f.family} — {f.category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="…oppure scrivi il nome esatto di una famiglia"
          value={exactValue}
          onChange={(e) => setExactValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadExact(); }}
        />
        <Button type="button" variant="outline" onClick={loadExact}>Carica</Button>
      </div>

      {(status || weightInfo) && (
        <div className="space-y-3 border-t pt-3">
          <Label>Peso</Label>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          {weightInfo && weightInfo.variable && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={Math.max(sliderSteps.length - 1, 0)}
                  step={1}
                  value={[sliderIdx]}
                  onValueChange={([v]) => setSliderIdx(v)}
                  onValueCommit={([v]) => commit(sliderSteps[v], italic)}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{sliderWeight}</span>
              </div>
              <div className="flex justify-between px-0.5 text-[0.68rem] text-muted-foreground">
                {sliderSteps.map((w) => <span key={w}>{w}</span>)}
              </div>
            </div>
          )}
          {weightInfo && !weightInfo.variable && (
            <Select
              value={discreteValue}
              onValueChange={(v) => {
                setDiscreteValue(v);
                const [w, i] = v.split('|');
                commit(Number(w), i === '1');
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {weightInfo.discrete.map((s) => (
                  <SelectItem key={`${s.weight}|${s.italic ? 1 : 0}`} value={`${s.weight}|${s.italic ? 1 : 0}`}>
                    {weightName(s.weight)} {s.weight}{s.italic ? ' · Corsivo' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {weightInfo && weightInfo.variable && weightInfo.hasItalic && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={italic}
                onCheckedChange={(v) => { setItalic(Boolean(v)); commit(sliderWeight, Boolean(v)); }}
              />
              Corsivo
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- //
// Local system fonts pane
// ---------------------------------------------------------------------- //

function LocalPane({ onSelect }) {
  const state = useSyncExternalStore(localFontsStore.subscribe, localFontsStore.get);
  const [family, setFamily] = useState('');
  const [weightStatus, setWeightStatus] = useState('');
  const [styleOptions, setStyleOptions] = useState(null); // array of entries, when >1 style
  const [styleIdx, setStyleIdx] = useState('0');
  const [variableAxis, setVariableAxis] = useState(null); // { min, max, default }
  const [variableWeight, setVariableWeight] = useState(400);
  const [grantPending, setGrantPending] = useState(false);
  const currentGroupRef = useRef(null);

  // The browser remembers the Local Font Access permission across visits:
  // skip the button and load straight away if it was already granted.
  useEffect(() => {
    if (!isLocalFontAccessSupported() || state.status !== 'idle') return;
    getLocalFontsPermissionState().then((perm) => {
      if (perm === 'granted') ensureLocalFontsLoaded().catch(() => {});
    });
  }, [state.status]);

  async function grant() {
    setGrantPending(true);
    try {
      await ensureLocalFontsLoaded();
    } catch (err) {
      alert(err.message);
    } finally {
      setGrantPending(false);
    }
  }

  async function openWeightStep(group) {
    currentGroupRef.current = group;
    setWeightStatus('');
    setStyleOptions(null);
    setVariableAxis(null);

    if (group.entries.length > 1) {
      setStyleOptions(group.entries);
      setStyleIdx('0');
      onSelect(group.entries[0]);
      return;
    }

    const entry = group.entries[0];
    setWeightStatus('Controllo se è un font variabile…');
    try {
      const otFont = await entry.getOpentypeFont();
      const axes = getVariableAxes(otFont);
      setWeightStatus('');
      if (axes && axes.wght) {
        const def = Math.round(axes.wght.default);
        setVariableAxis({ min: Math.round(axes.wght.min), max: Math.round(axes.wght.max) });
        setVariableWeight(def);
        applyVariable(entry, def);
      } else {
        onSelect(entry);
      }
    } catch {
      setWeightStatus('');
      onSelect(entry);
    }
  }

  function applyVariable(entry, weight) {
    entry.meta.variableWeight = weight;
    entry.label = `${entry.meta.family} · ${weight} (variabile)`;
    onSelect(entry);
  }

  if (!isLocalFontAccessSupported()) {
    return (
      <p className="pt-3 text-sm text-muted-foreground">
        Il tuo browser non supporta l'accesso ai font locali (Local Font Access API). Usa Chrome o Edge, oppure carica un file.
      </p>
    );
  }

  if (state.status !== 'ready') {
    return (
      <div className="space-y-3 pt-3">
        <p className="text-sm text-muted-foreground">Legge l'elenco dei font installati sul tuo computer (richiede Chrome o Edge).</p>
        <Button type="button" variant="outline" onClick={grant} disabled={grantPending || state.status === 'loading'}>
          {grantPending || state.status === 'loading' ? 'Attendo permesso…' : 'Consenti accesso ai font locali'}
        </Button>
        {state.status === 'error' && <p className="text-sm text-destructive">{state.error?.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="space-y-1.5">
        <Label>Famiglia</Label>
        <Select value={family} onValueChange={(v) => { setFamily(v); const g = state.families.find((f) => f.family === v); if (g) openWeightStep(g); }}>
          <SelectTrigger><SelectValue placeholder="Scegli una famiglia…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {state.families.map((g) => <SelectItem key={g.family} value={g.family}>{g.family}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(weightStatus || styleOptions || variableAxis) && (
        <div className="space-y-2 border-t pt-3">
          <Label>Peso</Label>
          {weightStatus && <p className="text-sm text-muted-foreground">{weightStatus}</p>}
          {styleOptions && (
            <Select value={styleIdx} onValueChange={(v) => { setStyleIdx(v); onSelect(styleOptions[Number(v)]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {styleOptions.map((entry, i) => (
                  <SelectItem key={i} value={String(i)}>{entry.meta.style || entry.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {variableAxis && (
            <div className="flex items-center gap-3">
              <Slider
                min={variableAxis.min}
                max={variableAxis.max}
                step={1}
                value={[variableWeight]}
                onValueChange={([v]) => setVariableWeight(v)}
                onValueCommit={([v]) => applyVariable(currentGroupRef.current.entries[0], v)}
              />
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{variableWeight}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- //
// Upload pane
// ---------------------------------------------------------------------- //

function UploadPane({ onSelect }) {
  const uploaded = useSyncExternalStore(uploadedFontsStore.subscribe, uploadedFontsStore.get);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => /\.(ttf|otf|woff2?|)$/i.test(f.name));
    if (files.length) addUploadedFonts(files.map(uploadFontEntry));
  }

  return (
    <div className="space-y-3 pt-3">
      <label
        className={`fp-file-input block cursor-pointer rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground transition-colors ${dragging ? 'border-ring text-foreground' : 'border-input'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          multiple
          hidden
          className="fp-file-input"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        Trascina un file font qui o clicca per scegliere (.ttf, .otf, .woff, .woff2)
      </label>

      <div className="fp-upload-list max-h-56 space-y-0.5 overflow-y-auto">
        {uploaded.length === 0 && <p className="text-sm text-muted-foreground">Nessun file caricato ancora.</p>}
        {uploaded.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="fp-item flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => onSelect(entry)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
