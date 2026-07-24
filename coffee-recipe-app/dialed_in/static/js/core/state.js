export const defaultSettings = Object.freeze({
  machine: "Gaggia Classic Evo Pro E24",
  grinder: "Turin G-Micron DF64P"
});

export const state = {
  beans: [],
  brewRecipes: [],
  dialInLogs: [],
  brewingMethods: [],
  settings: { ...defaultSettings },
  activePage: "overview",
  editingBeanId: null,
  editingBrewRecipeId: null,
  selectedDialBeanId: "",
  selectedDialRecipeId: "",
  scrapeTimer: null,
  lastScrapedUrl: "",
  scrapeInProgress: false,
  barcodeInProgress: false,
  barcodeScanner: null,
  barcodeScanHandled: false
};

export function applyServerState(payload = {}) {
  state.beans = Array.isArray(payload.beans) ? payload.beans : [];
  state.brewRecipes = Array.isArray(payload.brewRecipes) ? payload.brewRecipes : [];
  state.dialInLogs = Array.isArray(payload.dialInLogs) ? payload.dialInLogs : [];
  state.brewingMethods = Array.isArray(payload.brewingMethods) ? payload.brewingMethods : [];
  state.settings = { ...defaultSettings, ...(payload.settings || {}) };
}
