import { escapeHtml, iconMarkup, methodById, methodIconMarkup, originLabel, recipeMetricSummary, statusLabel } from "../core/utils.js";
import { flavorNotePillMarkup } from "../data/flavor-notes.js";

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
  const flavorNotes = Array.isArray(bean.flavorNotes) ? bean.flavorNotes : [];
  const strength = Number(bean.strength) > 0
    ? beanStrengthMarkup(bean.strength)
    : '<strong class="bean-profile-value bean-profile-value--empty">Not set</strong>';
  const tasteLabel = bean.tasteBalance && TASTE_BALANCE_LABELS[bean.tasteBalance]
    ? TASTE_BALANCE_LABELS[bean.tasteBalance]
    : "Not set";
  const origin = originLabel(bean) === "Origin not set" ? "Not set" : originLabel(bean);

  const compactDetails = `
    <div class="dashboard-bean-profile" aria-label="Bean profile">
      <div><small>Blend</small><strong class="${bean.blend ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.blend || "Not set")}</strong></div>
      <div><small>Roast</small><strong class="${bean.roast ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.roast || "Not set")}</strong></div>
      <div class="dashboard-strength"><small>Strength</small>${strength}</div>
    </div>`;

  const fullDetails = `
    <div class="bean-origin-detail">
      <small>Origin</small>
      <p class="${origin === "Not set" ? "bean-profile-value--empty" : ""}">${escapeHtml(origin)}</p>
    </div>
    <div class="bean-profile-grid" aria-label="Bean profile">
      <div class="bean-profile-detail"><small>Blend</small><strong class="bean-profile-value ${bean.blend ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.blend || "Not set")}</strong></div>
      <div class="bean-profile-detail"><small>Roast</small><strong class="bean-profile-value ${bean.roast ? "" : "bean-profile-value--empty"}">${escapeHtml(bean.roast || "Not set")}</strong></div>
      <div class="bean-profile-detail bean-profile-strength"><small>Strength</small>${strength}</div>
      <div class="bean-profile-detail bean-profile-taste"><small>Acidity / bitterness</small><strong class="bean-profile-value ${tasteLabel === "Not set" ? "bean-profile-value--empty" : ""}">${escapeHtml(tasteLabel)}</strong></div>
    </div>
    ${bean.decaf ? '<span class="bean-decaf-badge">Decaf</span>' : ""}
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
