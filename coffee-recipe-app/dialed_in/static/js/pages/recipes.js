import { brewRecipeCardHtml } from "../components/brew-recipe-card.js";
import { beanById, escapeHtml, methodById } from "../core/utils.js";

export function createRecipesPage({ state, onEdit, onFavorite, onAdd, onOpenDialIn, onStart }) {
  const grid = document.querySelector("#brewRecipeGrid");
  const empty = document.querySelector("#recipeEmptyState");
  const search = document.querySelector("#recipeSearchInput");
  const beanFilter = document.querySelector("#recipeBeanFilter");
  const methodFilter = document.querySelector("#recipeMethodFilter");
  const sort = document.querySelector("#recipeSortSelect");
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
    const recipes = [...state.brewRecipes].filter(recipe => {
      const bean = beanById(state, recipe.beanId);
      const method = methodById(state, recipe.method);
      const haystack = [recipe.name, recipe.notes, bean?.name, bean?.roaster, method.name].join(" ").toLocaleLowerCase("en");
      return (!query || haystack.includes(query))
        && (beanFilter.value === "all" || recipe.beanId === beanFilter.value)
        && (methodFilter.value === "all" || recipe.method === methodFilter.value)
        && (!favorites.checked || recipe.favorite);
    });

    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" });
    const byDate = (key, direction = -1) => (a, b) => direction * (new Date(a[key] || 0) - new Date(b[key] || 0));
    const comparators = {
      created_desc: byDate("createdAt", -1),
      created_asc: byDate("createdAt", 1),
      name_asc: byName,
      name_desc: (a, b) => byName(b, a),
      favorites_recent: (a, b) => Number(b.favorite) - Number(a.favorite) || byDate("updatedAt", -1)(a, b)
    };
    return recipes.sort(comparators[sort.value] || comparators.favorites_recent);
  }

  function render() {
    syncFilters();
    const recipes = filteredRecipes();
    grid.innerHTML = recipes.map(recipe => brewRecipeCardHtml(recipe, state)).join("");
    empty.classList.toggle("hidden", recipes.length > 0);
  }

  [search, beanFilter, methodFilter, sort, favorites].forEach(input => input.addEventListener("input", render));
  document.querySelectorAll("#recipesAddButton, #recipeEmptyAddButton").forEach(button => button?.addEventListener("click", () => onAdd()));
  grid.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-recipe]");
    const favorite = event.target.closest("[data-toggle-recipe-favorite]");
    const dial = event.target.closest("[data-open-dial-in]");
    const start = event.target.closest("[data-start-recipe]");
    if (edit) onEdit(edit.dataset.editRecipe);
    if (favorite) onFavorite(favorite.dataset.toggleRecipeFavorite);
    if (dial) onOpenDialIn(dial.dataset.openDialIn);
    if (start) onStart?.(start.dataset.startRecipe);
  });
  return { render };
}
