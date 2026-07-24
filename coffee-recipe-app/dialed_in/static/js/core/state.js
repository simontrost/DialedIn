export const defaultSettings = Object.freeze({
  machine: "Gaggia Classic Evo Pro E24",
  grinder: "Turin G-Micron DF64P"
});

export const state = {
  recipes: [],
  settings: { ...defaultSettings },
  activePage: "overview",
  editingId: null,
  scrapeTimer: null,
  lastScrapedUrl: "",
  scrapeInProgress: false,
  barcodeInProgress: false,
  barcodeScanner: null,
  barcodeScanHandled: false
};

export function applyServerState(payload = {}) {
  state.recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
  state.settings = { ...defaultSettings, ...(payload.settings || {}) };
}
