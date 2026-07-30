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
  const strength = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return `<span class="bean-strength-mini" aria-label="Strength ${strength} of 5">${Array.from({ length: 5 }, (_, index) => iconMarkup("coffee-bean", { group: "ui", className: index < strength ? "is-active" : "" })).join("")}</span>`;
}

export function beanCardHtml(bean, state, { dashboardMethod = "", showRecipe = false } = {}) {
  const recipe = showRecipe
    ? state.brewRecipes.find(item => item.beanId === bean.id && item.method === dashboardMethod)
    : null;
  const method = methodById(state, dashboardMethod);
  const metrics = recipeMetricSummary(recipe, method);
  const flavorNotes = Array.isArray(bean.flavorNotes) ? bean.flavorNotes : [];
  const profileItems = [];
  if (Number(bean.strength) > 0) profileItems.push(`<span class="bean-profile-chip"><b>Strength</b>${beanStrengthMarkup(bean.strength)}</span>`);
  if (bean.tasteBalance && TASTE_BALANCE_LABELS[bean.tasteBalance]) profileItems.push(`<span class="bean-profile-chip">${escapeHtml(TASTE_BALANCE_LABELS[bean.tasteBalance])}</span>`);
  if (bean.decaf) profileItems.push(`<span class="bean-profile-chip">Decaf</span>`);
  const profileBlock = profileItems.length ? `<div class="bean-profile-row">${profileItems.join("")}</div>` : "";
  const flavorNotesBlock = flavorNotes.length ? `
    <div class="bean-flavor-notes" aria-label="Flavor notes">
      ${flavorNotes.map(note => flavorNotePillMarkup(note)).join("")}
    </div>` : "";
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
    <article class="bean-card" data-roast="${escapeHtml(bean.roast)}">
      <div class="bean-card-accent"></div>
      <div class="bean-card-body">
        <div class="card-top">
          <span class="card-status" data-status="${escapeHtml(bean.status)}">${escapeHtml(statusLabel(bean.status))}</span>
          <button class="favorite-button ${bean.favorite ? "active" : ""}" type="button" data-toggle-bean-favorite="${bean.id}" aria-label="Toggle favorite">${iconMarkup(bean.favorite ? "heart-filled" : "heart", { group: "ui" })}</button>
        </div>
        <h3>${escapeHtml(bean.name)}</h3>
        <p class="bean-roaster">${escapeHtml(bean.roaster || "Roaster not set")}</p>
        <div class="coffee-tags">
          <span><b>Origin</b>${escapeHtml(originLabel(bean))}</span>
          <span><b>Blend</b>${escapeHtml(bean.blend || "Not specified")}</span>
          <span><b>Roast</b>${escapeHtml(bean.roast)}</span>
        </div>
        ${profileBlock}
        ${flavorNotesBlock}
        <div class="bean-card-lower">${recipeBlock}</div>
      </div>
      <footer class="bean-card-footer">
        <button class="edit-button button-with-icon" type="button" data-edit-bean="${bean.id}" aria-label="Edit bean" title="Edit bean">${iconMarkup("edit", { group: "ui" })}<span>Edit bean</span></button>
        ${bean.orderUrl ? `<a class="order-link button-with-icon" href="${escapeHtml(bean.orderUrl)}" target="_blank" rel="noopener">${iconMarkup("reorder", { group: "ui" })}<span>Reorder</span></a>` : ""}
      </footer>
    </article>`;
}
