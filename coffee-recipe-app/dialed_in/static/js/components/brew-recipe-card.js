import { beanById, escapeHtml, methodById, methodIconMarkup, recipeMetricSummary, iconMarkup } from "../core/utils.js";

export function brewRecipeCardHtml(recipe, state) {
  const bean = beanById(state, recipe.beanId);
  const method = methodById(state, recipe.method);
  const metrics = recipeMetricSummary(recipe, method);
  const stepCount = Array.isArray(recipe.steps) ? recipe.steps.length : 0;
  return `
    <article class="brew-recipe-card">
      <div class="brew-recipe-icon" aria-hidden="true">${methodIconMarkup(method)}</div>
      <div class="brew-recipe-body">
        <div class="card-top">
          <span class="method-chip">${escapeHtml(method.name)}</span>
          <button class="favorite-button ${recipe.favorite ? "active" : ""}" type="button" data-toggle-recipe-favorite="${recipe.id}">${iconMarkup(recipe.favorite ? "heart-filled" : "heart", { group: "ui" })}</button>
        </div>
        <h3>${escapeHtml(recipe.name)}</h3>
        <p class="recipe-bean-name">${escapeHtml(bean?.name || "Missing bean")} · ${escapeHtml(bean?.roaster || "Roaster not set")}</p>
        <div class="recipe-card-metrics">${metrics.map(metric => `<span><b>${escapeHtml(metric.value)}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ""}</b><small>${escapeHtml(metric.label)}</small></span>`).join("")}</div>
        ${stepCount ? `<p class="step-count">${stepCount} saved recipe step${stepCount === 1 ? "" : "s"}</p>` : ""}
        ${recipe.notes ? `<p class="notes-preview">${escapeHtml(recipe.notes)}</p>` : ""}
      </div>
      <footer class="brew-recipe-footer">
        <button class="edit-button button-with-icon" type="button" data-edit-recipe="${recipe.id}" aria-label="Edit recipe" title="Edit recipe">${iconMarkup("edit", { group: "ui" })}<span>Edit recipe</span></button>
        ${method.supportsDialIn ? `<button class="secondary-button button-with-icon" type="button" data-open-dial-in="${recipe.id}">${iconMarkup("dial-in", { group: "navigation" })}<span>Dial in</span></button>` : ""}
      </footer>
    </article>`;
}
