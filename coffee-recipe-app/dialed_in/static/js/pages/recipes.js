import { recipeCardTemplate } from "../components/recipe-card.js";

export function createRecipesPage({ state, onEdit, onFavorite, onAdd }) {
  const grid = document.querySelector("#recipeGrid");
  const empty = document.querySelector("#emptyState");
  const search = document.querySelector("#searchInput");
  const roastFilter = document.querySelector("#roastFilter");
  const statusFilter = document.querySelector("#statusFilter");
  const favoritesFilter = document.querySelector("#favoritesFilter");

  function filteredRecipes() {
    const query = search.value.trim().toLocaleLowerCase("en");
    const roast = roastFilter.value;
    const status = statusFilter.value;
    const favoritesOnly = favoritesFilter.checked;

    return [...state.recipes]
      .filter(recipe => {
        const haystack = [
          recipe.name,
          recipe.roaster,
          recipe.originCountry,
          recipe.originRegion,
          recipe.blend,
          recipe.notes
        ].join(" ").toLocaleLowerCase("en");
        return (!query || haystack.includes(query))
          && (roast === "all" || recipe.roast === roast)
          && (status === "all" || recipe.status === status)
          && (!favoritesOnly || recipe.favorite);
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function render() {
    const recipes = filteredRecipes();
    grid.innerHTML = recipes.map(recipe => recipeCardTemplate(recipe)).join("");
    empty.classList.toggle("hidden", recipes.length > 0);
  }

  [search, roastFilter, statusFilter, favoritesFilter].forEach(input => input.addEventListener("input", render));
  document.querySelectorAll("#recipesAddButton, #emptyAddButton")
    .forEach(button => button?.addEventListener("click", onAdd));

  grid.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-favorite-id]");
    const editButton = event.target.closest("[data-edit-id]");
    if (favoriteButton) onFavorite(favoriteButton.dataset.favoriteId);
    if (editButton) onEdit(editButton.dataset.editId);
  });

  return { render };
}
