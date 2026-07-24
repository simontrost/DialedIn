import { recipeCardTemplate } from "../components/recipe-card.js";
import { formatNumber, recipeRatio } from "../core/utils.js";

export function createOverviewPage({ state, onEdit, onFavorite, onAdd }) {
  const grid = document.querySelector("#overviewRecipeGrid");
  const empty = document.querySelector("#overviewEmptyState");
  const count = document.querySelector("#recipeCount");
  const avgRatio = document.querySelector("#averageRatio");
  const avgTime = document.querySelector("#averageTime");
  const machineLabel = document.querySelector("#machineLabel");
  const grinderLabel = document.querySelector("#grinderLabel");

  function setGreeting() {
    const hour = new Date().getHours();
    document.querySelector("#greeting").textContent =
      hour < 11 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function render() {
    const recent = [...state.recipes]
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 3);

    grid.innerHTML = recent.map(recipe => recipeCardTemplate(recipe, { compact: true })).join("");
    empty.classList.toggle("hidden", recent.length > 0);

    const active = state.recipes.filter(recipe => recipe.status === "active");
    const ratios = active.map(recipeRatio).filter(Boolean);
    const times = active.map(recipe => Number(recipe.time)).filter(Number.isFinite);

    count.textContent = state.recipes.length;
    avgRatio.textContent = ratios.length
      ? `1:${formatNumber(ratios.reduce((sum, value) => sum + value, 0) / ratios.length, 2)}`
      : "–";
    avgTime.textContent = times.length
      ? `${formatNumber(times.reduce((sum, value) => sum + value, 0) / times.length, 0)} s`
      : "–";

    machineLabel.textContent = state.settings.machine;
    grinderLabel.textContent = state.settings.grinder;
  }

  grid.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-favorite-id]");
    const editButton = event.target.closest("[data-edit-id]");
    if (favoriteButton) onFavorite(favoriteButton.dataset.favoriteId);
    if (editButton) onEdit(editButton.dataset.editId);
  });

  document.querySelectorAll("#addRecipeButton, #overviewAddButton")
    .forEach(button => button?.addEventListener("click", onAdd));
  setGreeting();
  return { render };
}
