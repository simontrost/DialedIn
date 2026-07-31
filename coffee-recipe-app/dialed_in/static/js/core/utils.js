export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}
const ICON_NAME_PATTERN = /^[a-z0-9-]+$/;
const ICON_GROUP_FALLBACKS = Object.freeze({
  methods: "custom-method",
  navigation: "overview",
  notes: "custom",
  ui: "add"
});

export function iconMarkup(name, { group = "ui", className = "", label = "" } = {}) {
  const safeGroup = Object.hasOwn(ICON_GROUP_FALLBACKS, group) ? group : "ui";
  const fallback = ICON_GROUP_FALLBACKS[safeGroup];
  const safeName = ICON_NAME_PATTERN.test(String(name || "")) ? String(name) : fallback;
  const classes = ["app-icon", className].filter(Boolean).join(" ");
  const aria = label ? `role="img" aria-label="${escapeHtml(label)}"` : 'aria-hidden="true"';
  return `<span class="${classes}" style="--app-icon:url('/static/icons/${safeGroup}/${safeName}.svg')" ${aria}></span>`;
}

export function methodIconMarkup(method, className = "") {
  return iconMarkup(method?.icon || "custom-method", { group: "methods", className });
}

export function normalizeUrl(value = "") {
  let trimmed = String(value).trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed) && /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeBarcode(value = "") {
  return String(value).replace(/\D/g, "");
}

export function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(number);
}

export function statusLabel(status) {
  return ({ active: "Active", empty: "Out of beans", wishlist: "Wishlist" })[status] || "Active";
}

function splitOriginList(value, { preserveEmpty = false } = {}) {
  const items = String(value || "")
    .split(/\s*[;,]\s*/)
    .map(item => item.trim());
  return preserveEmpty ? items : items.filter(Boolean);
}

export function originLabel(bean) {
  const countries = splitOriginList(bean?.originCountry);
  const regions = splitOriginList(bean?.originRegion, { preserveEmpty: true });

  const labels = countries.map((country, index) => {
    const region = regions[index] || "";
    return region ? `${country} · ${region}` : country;
  }).filter(Boolean);

  if (labels.length) return labels.join(", ");

  const standaloneRegions = regions.filter(Boolean);
  return standaloneRegions.length ? standaloneRegions.join(", ") : "Origin not set";
}

export function methodById(state, methodId) {
  return state.brewingMethods.find(method => method.id === methodId) || {
    id: methodId,
    name: methodId || "Unknown method",
    icon: "custom-method",
    fields: [],
    supportsSteps: false,
    supportsDialIn: true
  };
}

export function beanById(state, beanId) {
  return state.beans.find(bean => bean.id === beanId) || null;
}

export function recipeById(state, recipeId) {
  return state.brewRecipes.find(recipe => recipe.id === recipeId) || null;
}

export function recipesForBean(state, beanId, method = "") {
  return state.brewRecipes.filter(recipe => recipe.beanId === beanId && (!method || recipe.method === method));
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

export function toLocalDateTimeInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function recipeMetricSummary(recipe, method) {
  const values = recipe?.values || {};
  const preferred = ["dose", "beverageYield", "waterAmount", "targetTime", "grind", "temperature", "pressure"];
  const fieldMap = new Map((method?.fields || []).map(field => [field.key, field]));
  return preferred
    .filter(key => values[key] !== null && values[key] !== undefined && fieldMap.has(key))
    .slice(0, 4)
    .map(key => {
      const field = fieldMap.get(key);
      return { label: field.label, value: formatNumber(values[key], 2), unit: field.unit || "" };
    });
}

export function recipePreInfusionSummary(recipe) {
  const values = recipe?.values || {};
  if (!values.preInfusionEnabled) return null;

  const parts = [];
  const time = values.preInfusionTime === null || values.preInfusionTime === undefined || values.preInfusionTime === ""
    ? NaN
    : Number(values.preInfusionTime);
  const pressure = values.preInfusionPressure === null || values.preInfusionPressure === undefined || values.preInfusionPressure === ""
    ? NaN
    : Number(values.preInfusionPressure);
  if (Number.isFinite(time)) parts.push(`${formatNumber(time, 1)} sec`);
  if (Number.isFinite(pressure)) parts.push(`${formatNumber(pressure, 1)} bar`);
  return { label: "Pre-infusion", value: parts.join(" · ") || "Enabled" };
}
