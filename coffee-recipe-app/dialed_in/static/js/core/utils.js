export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
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

export function originLabel(bean) {
  const parts = [bean?.originCountry, bean?.originRegion].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Origin not set";
}

export function methodById(state, methodId) {
  return state.brewingMethods.find(method => method.id === methodId) || {
    id: methodId,
    name: methodId || "Unknown method",
    icon: "☕",
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
