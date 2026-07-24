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

export function formatNumber(value, decimals = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(number);
}

export function recipeRatio(recipe) {
  const dose = Number(recipe.dose);
  const output = Number(recipe.yield);
  return dose > 0 && output > 0 ? output / dose : 0;
}

export function ratingStars(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return `${formatNumber(rating, 1)} ★`;
}

export function statusLabel(status) {
  return ({ active: "Active", empty: "Out of beans", wishlist: "Wishlist" })[status] || "Active";
}

export function originLabel(recipe) {
  const values = [recipe.originCountry, recipe.originRegion].filter(Boolean);
  return values.length ? values.join(" · ") : "Origin not set";
}

export function blendLabel(recipe) {
  return recipe.blend || "Composition not set";
}

export function normalizeBarcode(value = "") {
  return String(value).replace(/\D/g, "");
}
