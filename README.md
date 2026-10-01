# fontPair

Strumento personale per confrontare font per somiglianza e creare abbinamenti tipografici, nel browser.

Costruito con **React + Vite + Tailwind CSS + shadcn/ui**: comandi raggruppati in card chiare (Font A, Font B, Impostazioni generali, …) invece che sparsi in una toolbar unica.

## Sviluppo

Richiede Node.js. La prima volta:

```
npm install
npm run dev
```

poi apri l'indirizzo locale che stampa Vite (serve HTTPS o `localhost` per Local Font Access). Per la build di produzione:

```
npm run build
```

genera `dist/`, che è quanto Vercel (o qualsiasi host statico) pubblica — Vercel riconosce automaticamente un progetto Vite da `vite.config.js` e `package.json`, nessuna configurazione aggiuntiva necessaria.

## Le due sezioni

### Similar Font
Sovrappone due font per confrontarne la forma. Ogni colonna (Font A / Font B) ha la propria card di controlli — colore, resa (riempimento o solo contorno, con spessore visibile solo in modalità contorno), opacità, spaziatura — perché sono aspetti del singolo font. La card "Impostazioni generali" raccoglie tutto ciò che riguarda il confronto nel suo insieme: modalità (**parola personalizzata**, **glifo singolo** o **tutti i glifi**), dimensione dei glifi, blend mode tra i due layer, overlay delle curve di Bézier e zoom dedicato per ispezionarle da vicino.

### Font Pair
- Mostra il set di glifi disponibili in ciascuno dei due font.
- Scala tipografica in uno stack verticale continuo (Eyebrow, Display, Title, Subtitle, Body, Caption, Button), con dimensioni di partenza su un pattern standard (~1.25): a sinistra scegli font (A/B) e dimensione per ogni stile, a destra il testo è modificabile direttamente sul posto.
- Pulsante **"Copia CSS dell'abbinamento"** per portare via la combinazione.

## Fonti dei font

- **Font locali**: via [Local Font Access API](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts) (`window.queryLocalFonts()`), disponibile solo su **Chrome/Edge**, richiede permesso esplicito la prima volta.
- **Google Fonts**: i file reali (woff2) vengono scaricati al volo da `fonts.gstatic.com`. `public/vendor/woff2-decompress.js` (build WASM del decoder WOFF2 di Google) li converte in sfnt prima del parsing con opentype.js. Il catalogo (`public/data/google-fonts.json`) è una selezione curata; scrivi il nome esatto di **qualsiasi** famiglia Google Fonts nel campo apposito per caricarla comunque. Per il catalogo *completo* (~2000 famiglie):
  ```
  node scripts/update-google-fonts.mjs
  ```
- **Carica un file**: `.ttf` / `.otf` / `.woff` / `.woff2` dal tuo computer.

## Cosa manca volutamente

- **Adobe Fonts (Typekit)**: nessuna API pubblica per sfogliare il catalogo.
- **Foundry esterne**: niente iframe/embedding — carica il file del font con "Carica file".

## Struttura

```
index.html
src/
  main.jsx               # bootstrap React
  App.jsx                # tab nav (Similar Font / Font Pair)
  index.css              # Tailwind + variabili tema + CSS dell'overlay SVG
  lib/
    fontSources.js        # accesso a font locali / Google Fonts / upload (invariato dalla versione vanilla)
    glyphRender.js         # utility di rendering SVG/Bézier condivise (invariato)
    sharedFontStores.js     # stato condiviso tra i FontPicker (permesso font locali, file caricati)
    utils.js               # helper `cn()` per shadcn/ui
  components/
    FontPicker.jsx          # widget di selezione font (Google/Sistema/File)
    SimilarFontTab.jsx
    FontPairTab.jsx
    ui/                    # primitive shadcn/ui (Button, Card, Select, Slider, Checkbox, Tabs, …)
public/
  vendor/opentype.min.js       # parsing dei font e path dei glifi
  vendor/woff2-decompress.js   # decoder WOFF2 → sfnt (WASM)
  data/google-fonts.json       # catalogo curato di famiglie Google Fonts
scripts/update-google-fonts.mjs  # rigenera il catalogo completo
```
