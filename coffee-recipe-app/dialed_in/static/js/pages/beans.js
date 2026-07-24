import { beanCardHtml } from "../components/bean-card.js";

export function createBeansPage({ state, onEdit, onFavorite, onAdd }) {
  const grid = document.querySelector("#beanGrid");
  const empty = document.querySelector("#beanEmptyState");
  const search = document.querySelector("#beanSearchInput");
  const roast = document.querySelector("#beanRoastFilter");
  const status = document.querySelector("#beanStatusFilter");
  const favorites = document.querySelector("#beanFavoritesFilter");

  function filteredBeans() {
    const query = search.value.trim().toLocaleLowerCase("en");
    return [...state.beans].filter(bean => {
      const haystack = [bean.name, bean.roaster, bean.originCountry, bean.originRegion, bean.blend, bean.notes].join(" ").toLocaleLowerCase("en");
      return (!query || haystack.includes(query))
        && (roast.value === "all" || bean.roast === roast.value)
        && (status.value === "all" || bean.status === status.value)
        && (!favorites.checked || bean.favorite);
    }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function render() {
    const beans = filteredBeans();
    grid.innerHTML = beans.map(bean => beanCardHtml(bean, state)).join("");
    empty.classList.toggle("hidden", beans.length > 0);
  }

  [search, roast, status, favorites].forEach(input => input.addEventListener("input", render));
  document.querySelectorAll("#beansAddButton, #beanEmptyAddButton").forEach(button => button?.addEventListener("click", onAdd));
  grid.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-bean]");
    const favorite = event.target.closest("[data-toggle-bean-favorite]");
    if (edit) onEdit(edit.dataset.editBean);
    if (favorite) onFavorite(favorite.dataset.toggleBeanFavorite);
  });
  return { render };
}
