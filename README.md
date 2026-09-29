# fontPair

Strumento personale per confrontare font per somiglianza e creare abbinamenti tipografici, direttamente nel browser — nessun backend, nessuna build.

Vivo su GitHub Pages: apri `index.html` (o l'URL pubblicato) in **Chrome o Edge** per tutte le funzionalità.

## Le due sezioni

### Similar Font
Sovrappone due font per confrontarne la forma. Ogni colonna (Font A / Font B) ha i propri controlli — colore, resa (riempimento o solo contorno, con spessore visibile solo in modalità contorno) e opacità — perché sono aspetti del singolo font. Sono generali, perché riguardano il confronto nel suo insieme: modalità (**parola personalizzata**, **glifo singolo** o **tutti i glifi**), dimensione dei glifi e blend mode tra i due layer (**Multiply**, **Difference**, **Screen**, nessuno).

### Font Pair
- Mostra il set di glifi disponibili in ciascuno dei due font.
- Scala tipografica in uno stack verticale continuo (Eyebrow, Display, Title, Subtitle, Body, Caption, Button), con dimensioni di partenza su un pattern standard (~1.25): a sinistra scegli font (A/B) e dimensione per ogni stile, a destra il testo è modificabile direttamente sul posto — lo stack stesso funge da anteprima combinata.
- Pulsante **"Copia CSS dell'abbinamento"** per portare via la combinazione.

## Fonti dei font

- **Font locali**: via [Local Font Access API](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts) (`window.queryLocalFonts()`), disponibile solo su **Chrome/Edge**, richiede permesso esplicito la prima volta. Su altri browser questa scheda mostra un avviso e resta comunque disponibile il caricamento manuale.
- **Google Fonts**: i file reali (woff2) vengono scaricati al volo da `fonts.gstatic.com`, quindi l'accesso ai glifi è completo (non è solo CSS). Poiché i file arrivano in formato WOFF2 e la libreria di parsing (opentype.js) non lo sa decomprimere da sola, `js/vendor/woff2-decompress.js` (build WASM del decoder WOFF2 di Google) li converte al volo in sfnt prima del parsing — font locali e file caricati di solito sono già sfnt e non passano da questo step. Il catalogo mostrato nel picker (`data/google-fonts.json`) è una selezione curata di ~280 famiglie popolari; puoi scrivere il nome esatto di **qualsiasi** famiglia Google Fonts nel campo "scrivi il nome esatto" e verrà caricata comunque. Per avere l'elenco *completo* (~2000 famiglie) nel picker, esegui una volta:
  ```
  node scripts/update-google-fonts.mjs
  ```
  (va lanciato dal tuo computer, non da un ambiente con rete ristretta — usa lo stesso endpoint pubblico di fonts.google.com, senza API key).
- **Carica un file**: `.ttf` / `.otf` / `.woff` / `.woff2` dal tuo computer — utile per font acquistati da foundry che non si possono scaricare/incorporare da altri siti.

## Cosa manca volutamente

- **Adobe Fonts (Typekit)**: non esiste un'API pubblica per sfogliare il catalogo; Adobe serve i font solo tramite un "kit" legato a un dominio autorizzato. Non è integrato.
- **Foundry esterne** (la lista dalla tua board Notion): niente iframe/embedding — per il confronto dei glifi serve il file del font vero e proprio, quindi se compri un font da una foundry, caricalo con "Carica file".

## Sviluppo

Nessuna build: apri `index.html` con un server statico qualsiasi (serve HTTPS o `localhost` per Local Font Access). Ad esempio:
```
npx serve .
```

## Struttura

```
index.html
css/styles.css
js/
  vendor/opentype.min.js       # parsing dei font e path dei glifi
  vendor/woff2-decompress.js   # decoder WOFF2 → sfnt (WASM), necessario per Google Fonts
  fontSources.js           # accesso a font locali / Google Fonts / upload
  fontPicker.js            # widget di selezione font condiviso dalle due tab
  glyphRender.js           # utility di rendering SVG condivise
  similarFont.js           # tab "Similar Font"
  fontPair.js              # tab "Font Pair"
  main.js                  # bootstrap
data/google-fonts.json     # catalogo curato di famiglie Google Fonts
scripts/update-google-fonts.mjs  # rigenera il catalogo completo
```
