import { escapeHtml, formatNumber, iconMarkup, methodById, methodIconMarkup, recipeMetricSummary, recipePreInfusionSummary, statusLabel } from "../core/utils.js";
import { flavorNotePillMarkup } from "../data/flavor-notes.js";


function splitOriginList(value, { preserveEmpty = false } = {}) {
  const items = String(value || "")
    .split(/\s*[;,]\s*/)
    .map(item => item.trim());
  return preserveEmpty ? items : items.filter(Boolean);
}

function beanOriginWithAltitude(bean) {
  const countries = splitOriginList(bean?.originCountry);
  const regions = splitOriginList(bean?.originRegion, { preserveEmpty: true });
  const altitudes = splitOriginList(bean?.originAltitude, { preserveEmpty: true });
  const labels = countries.map((country, index) => {
    const parts = [country];
    if (regions[index]) parts.push(regions[index]);
    if (altitudes[index]) parts.push(`${altitudes[index]} m`);
    return parts.filter(Boolean).join(" · ");
  }).filter(Boolean);
  if (labels.length) return labels.join(", ");
  const standaloneRegions = regions.filter(Boolean);
  return standaloneRegions.length ? standaloneRegions.join(", ") : "Not set";
}

function scaScoreLabel(value) {
  if (value === null || value === undefined || value === "") return "Not set";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not set";
  return `${formatNumber(number, 1)} / 100`;
}

const TASTE_BALANCE_LABELS = Object.freeze({
  very_acidic: "Very acidic",
  acidic: "Acidic",
  little_acidic: "Slightly acidic",
  balanced: "Balanced",
  little_bitter: "Slightly bitter",
  bitter: "Bitter",
  very_bitter: "Very bitter"
});

function beanStrengthMarkup(value = 0) {
  const strength = Math.max(0, Math.min(5, Math.round((Number(value) || 0) * 2) / 2));
  return `<span class="bean-strength-mini" aria-label="Strength ${strength} of 5">${Array.from({ length: 5 }, (_, index) => {
    const amount = Math.max(0, Math.min(1, strength - index));
    const className = amount >= 1 ? "is-full" : amount === .5 ? "is-half" : "";
    return `<span class="bean-strength-mini-item ${className}" aria-hidden="true"></span>`;
  }).join("")}</span>`;
}

export function beanCardHtml(bean, state, { dashboardMethod = "", showRecipe = false, compactBeanDetails = false } = {}) {
  const recipe = showRecipe
    ? state.brewRecipes.find(item => item.beanId === bean.id && item.method === dashboardMethod)
    : null;
  const method = methodById(state, dashboardMethod);
  const metrics = recipeMetricSummary(recipe, method);
  const preInfusion = recipePreInfusionSummary(recipe);
  const flavorNotes = Array.isArray(bean.flavorNotes) ? bean.flavorNotes : [];
  const strength = Number(bean.strength) > 0
    ? beanStrengthMarkup(bean.strength)
    : '<strong class="bean-profile-value bean-profile-value--empty">Not set</strong>';
  const tasteLabel = bean.tasteBalance && TASTE_BALANCE_LABELS[bean.tasteBalance]
    ? TASTE_BALANCE_LABELS[bean.tasteBalance]
    : "Not set";
  const detailedOrigin = beanOriginWithAltitude(bean);
  const scaScore = scaScoreLabel(bean.scaScore);
  const profileBadges = [
    bean.decaf ? '<span class="bean-profile-badge">Decaf</span>' : "",
    bean.isGround ? '<span class="bean-profile-badge bean-ground-badge">Pre-ground</span>' : ""
  ].filter(Boolean).join("");

  const compactDetails = `
    <div class="dashboard-bean-profile" aria-label="Bean profile">
      <div><small>Blend</small><strong class="${bean.blend ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.blend || "Not set")}</strong></div>
      <div><small>Roast</small><strong class="${bean.roast ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.roast || "Not set")}</strong></div>
      <div class="dashboard-strength"><small>Strength</small>${strength}</div>
    </div>`;

  const fullDetails = `
    <div class="bean-origin-detail">
      <small>Origin</small>
      <p class="${detailedOrigin === "Not set" ? "bean-profile-value--empty" : ""}">${escapeHtml(detailedOrigin)}</p>
    </div>
    <div class="bean-profile-grid" aria-label="Bean profile">
      <div class="bean-profile-detail"><small>Blend</small><strong class="bean-profile-value ${bean.blend ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.blend || "Not set")}</strong></div>
      <div class="bean-profile-detail"><small>Roast</small><strong class="bean-profile-value ${bean.roast ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.roast || "Not set")}</strong></div>
      <div class="bean-profile-detail bean-profile-strength"><small>Strength</small>${strength}</div>
      <div class="bean-profile-detail bean-profile-taste"><small>Acidity / bitterness</small><strong class="bean-profile-value ${tasteLabel === "Not set" ? "bean-profile-value--empty" : ""}">${escapeHtml(tasteLabel)}</strong></div>
      <div class="bean-profile-detail bean-profile-score"><small>SCA score</small><strong class="bean-profile-value ${scaScore === "Not set" ? "bean-profile-value--empty" : ""}">${escapeHtml(scaScore)}</strong></div>
    </div>
    ${profileBadges ? `<div class="bean-profile-badges">${profileBadges}</div>` : ""}
    ${flavorNotes.length ? `
      <div class="bean-flavor-section">
        <small class="bean-flavor-heading">Flavor notes</small>
        <div class="bean-flavor-notes" aria-label="Flavor notes">
          ${flavorNotes.map(note => flavorNotePillMarkup(note)).join("")}
        </div>
      </div>` : ""}`;

  const recipeBlock = showRecipe ? `
    <div class="bean-recipe-preview ${recipe ? "" : "missing"}">
      <div class="bean-recipe-heading">
        <span class="method-chip">${methodIconMarkup(method)} ${escapeHtml(method.name)}</span>
        ${recipe ? `<button class="inline-edit-button" type="button" data-edit-recipe="${recipe.id}" aria-label="Edit recipe" title="Edit recipe">${iconMarkup("edit", { group: "ui" })}</button>` : `<button type="button" data-add-recipe-for-bean="${bean.id}" data-method="${escapeHtml(dashboardMethod)}">Add recipe</button>`}
      </div>
      ${recipe ? `
        <strong>${escapeHtml(recipe.name)}</strong>
        <div class="preview-metrics">${metrics.map(metric => `<span><b>${escapeHtml(metric.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ""}</b><small>${escapeHtml(metric.label)}</small></span>`).join("")}</div>
        ${preInfusion ? `<div class="recipe-preinfusion-summary recipe-preinfusion-summary--compact"><span class="app-icon" style="--app-icon:url('/static/icons/recipe-fields/pre-infusion.svg')" aria-hidden="true"></span><span><strong>${escapeHtml(preInfusion.label)}</strong><small>${escapeHtml(preInfusion.value)}</small></span></div>` : ""}
      ` : `<p>No ${escapeHtml(method.name)} recipe stored for this bean.</p>`}
    </div>` : "";

  return `
    <article class="bean-card ${compactBeanDetails ? "bean-card--dashboard" : "bean-card--library"}" data-roast="${escapeHtml(bean.roast)}">
      <div class="bean-card-accent"></div>
      <div class="bean-card-body">
        <div class="card-top">
          <span class="card-status" data-status="${escapeHtml(bean.status)}">${escapeHtml(statusLabel(bean.status))}</span>
          <button class="favorite-button ${bean.favorite ? "active" : ""}" type="button" data-toggle-bean-favorite="${bean.id}" aria-label="Toggle favorite">${iconMarkup(bean.favorite ? "heart-filled" : "heart", { group: "ui" })}</button>
        </div>
        <h3>${escapeHtml(bean.name)}</h3>
        <p class="bean-roaster">${escapeHtml(bean.roaster || "Roaster not set")}</p>
        ${compactBeanDetails ? compactDetails : fullDetails}
        <div class="bean-card-lower">${recipeBlock}</div>
      </div>
      <footer class="bean-card-footer">
        <button class="edit-button button-with-icon" type="button" data-edit-bean="${bean.id}" aria-label="Edit bean" title="Edit bean">${iconMarkup("edit", { group: "ui" })}<span>Edit bean</span></button>
        ${bean.orderUrl ? `<a class="order-link button-with-icon" href="${escapeHtml(bean.orderUrl)}" target="_blank" rel="noopener">${iconMarkup("reorder", { group: "ui" })}<span>Reorder</span></a>` : ""}
      </footer>
    </article>`;
}
