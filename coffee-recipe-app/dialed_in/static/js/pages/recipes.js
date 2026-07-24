import { brewRecipeCardHtml } from "../components/brew-recipe-card.js";
import { beanById, escapeHtml, methodById } from "../core/utils.js";

export function createRecipesPage({ state, onEdit, onFavorite, onAdd, onOpenDialIn }) {
  const grid = document.querySelector("#brewRecipeGrid");
  const empty = document.querySelector("#recipeEmptyState");
  const search = document.querySelector("#recipeSearchInput");
  const beanFilter = document.querySelector("#recipeBeanFilter");
  const methodFilter = document.querySelector("#recipeMethodFilter");
  const favorites = document.querySelector("#recipeFavoritesFilter");

  function syncFilters() {
    const selectedBean = beanFilter.value || "all";
    const selectedMethod = methodFilter.value || "all";
    beanFilter.innerHTML = '<option value="all">All beans</option>' + state.beans
      .map(bean => `<option value="${bean.id}">${escapeHtml(bean.name)}</option>`).join("");
    methodFilter.innerHTML = '<option value="all">All methods</option>' + state.brewingMethods
      .map(method => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.name)}</option>`).join("");
    beanFilter.value = [...beanFilter.options].some(option => option.value === selectedBean) ? selectedBean : "all";
    methodFilter.value = [...methodFilter.options].some(option => option.value === selectedMethod) ? selectedMethod : "all";
  }

  function filteredRecipes() {
    const query = search.value.trim().toLocaleLowerCase("en");
    return [...state.brewRecipes].filter(recipe => {
      const bean = beanById(state, recipe.beanId);
      const method = methodById(state, recipe.method);
      const haystack = [recipe.name, recipe.notes, bean?.name, bean?.roaster, method.name].join(" ").toLocaleLowerCase("en");
      return (!query || haystack.includes(query))
        && (beanFilter.value === "all" || recipe.beanId === beanFilter.value)
        && (methodFilter.value === "all" || recipe.method === methodFilter.value)
        && (!favorites.checked || recipe.favorite);
    }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function render() {
    syncFilters();
    const recipes = filteredRecipes();
    grid.innerHTML = recipes.map(recipe => brewRecipeCardHtml(recipe, state)).join("");
    empty.classList.toggle("hidden", recipes.length > 0);
  }

  [search, beanFilter, methodFilter, favorites].forEach(input => input.addEventListener("input", render));
  document.querySelectorAll("#recipesAddButton, #recipeEmptyAddButton").forEach(button => button?.addEventListener("click", () => onAdd()));
  grid.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-recipe]");
    const favorite = event.target.closest("[data-toggle-recipe-favorite]");
    const dial = event.target.closest("[data-open-dial-in]");
    if (edit) onEdit(edit.dataset.editRecipe);
    if (favorite) onFavorite(favorite.dataset.toggleRecipeFavorite);
    if (dial) onOpenDialIn(dial.dataset.openDialIn);
  });
  return { render };
}
