// Shared, page-wide state for the two font sources whose data must stay in
// sync across every FontPicker instance on the page (Font A, Font B, …):
// Local Font Access permission is per-origin (granted once, not per-picker),
// and an uploaded file should immediately show up as a choice everywhere.
// Exposed as tiny external stores so each component can subscribe via
// React's useSyncExternalStore instead of prop-drilling or a context
// provider that would force unrelated re-renders.
import { loadLocalFonts, groupLocalFontsByFamily } from './fontSources.js';

function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      for (const fn of listeners) fn();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// ---------- Local system fonts ----------
export const localFontsStore = createStore({ status: 'idle', families: [] }); // 'idle' | 'loading' | 'ready' | 'error'
let localFontsPromise = null;

export function ensureLocalFontsLoaded() {
  if (!localFontsPromise) {
    localFontsStore.set({ ...localFontsStore.get(), status: 'loading' });
    localFontsPromise = loadLocalFonts()
      .then((fonts) => {
        const families = groupLocalFontsByFamily(fonts);
        localFontsStore.set({ status: 'ready', families });
        return fonts;
      })
      .catch((err) => {
        localFontsStore.set({ status: 'error', families: [], error: err });
        localFontsPromise = null;
        throw err;
      });
  }
  return localFontsPromise;
}

// ---------- Uploaded fonts ----------
export const uploadedFontsStore = createStore([]);

export function addUploadedFonts(entries) {
  uploadedFontsStore.set([...uploadedFontsStore.get(), ...entries]);
}
