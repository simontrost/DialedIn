import {
  blendLabel,
  escapeHtml,
  formatNumber,
  normalizeUrl,
  originLabel,
  ratingStars,
  recipeRatio,
  statusLabel
} from "../core/utils.js";

export function recipeCardTemplate(recipe, { compact = false } = {}) {
  const safeUrl = normalizeUrl(recipe.orderUrl);
  return `
    <article class="recipe-card ${compact ? "recipe-card-compact" : ""}" data-roast="${escapeHtml(recipe.roast)}">
      <div class="card-body">
        <div class="card-top">
          <div>
            <span class="card-status" data-status="${escapeHtml(recipe.status)}">${statusLabel(recipe.status)}</span>
            <h3 class="recipe-title">${escapeHtml(recipe.name)}</h3>
          </div>
          <button class="favorite-button ${recipe.favorite ? "active" : ""}" type="button"
            data-favorite-id="${escapeHtml(recipe.id)}" aria-label="${recipe.favorite ? "Remove from favorites" : "Add to favorites"}">
            ${recipe.favorite ? "♥" : "♡"}
          </button>
        </div>
        <p class="recipe-meta">${escapeHtml(recipe.roaster || "No roaster")}</p>
        <div class="coffee-tags">
          <span><b>Origin</b>${escapeHtml(originLabel(recipe))}</span>
          <span><b>Beans</b>${escapeHtml(blendLabel(recipe))}</span>
        </div>
        <div class="recipe-metrics">
          <div><strong>${formatNumber(recipe.dose)} g</strong><small>In</small></div>
          <div><strong>${formatNumber(recipe.yield)} g</strong><small>Out</small></div>
          <div><strong>${formatNumber(recipe.time, 0)} s</strong><small>Time</small></div>
        </div>
        <div class="card-secondary">
          <div class="mini-metric"><span>Ratio</span><strong>1:${formatNumber(recipeRatio(recipe), 2)}</strong></div>
          <div class="mini-metric"><span>Grind</span><strong>${escapeHtml(recipe.grind || "–")}</strong></div>
          <div class="mini-metric"><span>Temperature</span><strong>${recipe.temp ? `${formatNumber(recipe.temp)} °C` : "–"}</strong></div>
          <div class="mini-metric"><span>Rating</span><strong>${ratingStars(recipe.rating)}</strong></div>
        </div>
        <p class="notes-preview">${escapeHtml(recipe.notes || "No notes added yet.")}</p>
      </div>
      <div class="card-footer">
        <button class="edit-button" type="button" data-edit-id="${escapeHtml(recipe.id)}">Edit recipe</button>
        <a class="order-link ${safeUrl ? "" : "disabled"}" href="${safeUrl || "#"}" target="_blank" rel="noopener noreferrer"
          aria-label="${safeUrl ? "Reorder beans" : "No reorder link added"}">Reorder</a>
      </div>
    </article>`;
}
