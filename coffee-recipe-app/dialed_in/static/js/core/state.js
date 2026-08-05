export const defaultSettings = Object.freeze({
  machine: "Gaggia Classic Evo Pro E24",
  grinder: "Turin G-Micron DF64P",
  grindMin: 1,
  grindMax: 50,
  machineTemperatureControl: false,
  machinePressureControl: false,
  machineFlowControl: false,
  theme: "light"
});

export const state = {
  profile: null,
  profiles: [],
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

function resetProfileSelections() {
  state.editingBeanId = null;
  state.editingBrewRecipeId = null;
  state.selectedDialBeanId = "";
  state.selectedDialRecipeId = "";
}

export function applyServerState(payload = {}) {
  const previousProfileId = state.profile?.id || null;
  state.profile = payload.profile || state.profile || null;
  state.beans = Array.isArray(payload.beans) ? payload.beans : [];
  state.brewRecipes = Array.isArray(payload.brewRecipes) ? payload.brewRecipes : [];
  state.dialInLogs = Array.isArray(payload.dialInLogs) ? payload.dialInLogs : [];
  state.brewingMethods = Array.isArray(payload.brewingMethods) ? payload.brewingMethods : [];
  state.settings = { ...defaultSettings, ...(payload.settings || {}) };
  if (previousProfileId !== (state.profile?.id || null)) resetProfileSelections();
}

export function clearProfileState() {
  state.profile = null;
  state.beans = [];
  state.brewRecipes = [];
  state.dialInLogs = [];
  state.brewingMethods = [];
  state.settings = { ...defaultSettings };
  resetProfileSelections();
}
