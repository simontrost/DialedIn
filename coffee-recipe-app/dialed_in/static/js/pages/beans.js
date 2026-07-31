import { beanCardHtml } from "../components/bean-card.js";
import { FLAVOR_NOTE_CATEGORIES, FLAVOR_NOTES, canonicalFlavorNoteName } from "../data/flavor-notes.js";

const PREDEFINED_FLAVOR_NAMES = new Set(
  FLAVOR_NOTES.map(note => note.name.toLocaleLowerCase("en"))
);

function normalizedFlavorName(value = "") {
  return canonicalFlavorNoteName(value).toLocaleLowerCase("en");
}

export function createBeansPage({ state, onEdit, onFavorite, onAdd }) {
  const grid = document.querySelector("#beanGrid");
  const empty = document.querySelector("#beanEmptyState");
  const search = document.querySelector("#beanSearchInput");
  const roast = document.querySelector("#beanRoastFilter");
  const status = document.querySelector("#beanStatusFilter");
  const flavor = document.querySelector("#beanFlavorFilter");
  const sort = document.querySelector("#beanSortSelect");
  const favorites = document.querySelector("#beanFavoritesFilter");

  function syncFlavorFilterOptions() {
    const selectedValue = flavor.value || "all";
    const fragment = document.createDocumentFragment();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All flavor notes";
    fragment.append(allOption);

    FLAVOR_NOTE_CATEGORIES.forEach(category => {
      const group = document.createElement("optgroup");
      group.label = category.name;
      category.notes.forEach(([name]) => {
        const option = document.createElement("option");
        option.value = normalizedFlavorName(name);
        option.textContent = name;
        group.append(option);
      });
      fragment.append(group);
    });

    const customNotes = [...new Set(
      state.beans
        .flatMap(bean => Array.isArray(bean.flavorNotes) ? bean.flavorNotes : [])
        .map(note => canonicalFlavorNoteName(note))
        .filter(note => note && !PREDEFINED_FLAVOR_NAMES.has(note.toLocaleLowerCase("en")))
    )].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

    if (customNotes.length) {
      const customGroup = document.createElement("optgroup");
      customGroup.label = "Custom";
      customNotes.forEach(name => {
        const option = document.createElement("option");
        option.value = normalizedFlavorName(name);
        option.textContent = name;
        customGroup.append(option);
      });
      fragment.append(customGroup);
    }

    flavor.replaceChildren(fragment);
    flavor.value = [...flavor.options].some(option => option.value === selectedValue)
      ? selectedValue
      : "all";
  }

  function filteredBeans() {
    const query = search.value.trim().toLocaleLowerCase("en");
    const selectedFlavor = flavor.value;

    const beans = [...state.beans].filter(bean => {
      const flavorNotes = Array.isArray(bean.flavorNotes) ? bean.flavorNotes : [];
      const haystack = [
        bean.name,
        bean.roaster,
        bean.originCountry,
        bean.originRegion,
        bean.blend,
        bean.notes,
        ...flavorNotes
      ].join(" ").toLocaleLowerCase("en");

      const hasSelectedFlavor = selectedFlavor === "all"
        || flavorNotes.some(note => normalizedFlavorName(note) === selectedFlavor);

      return (!query || haystack.includes(query))
        && (roast.value === "all" || bean.roast === roast.value)
        && (status.value === "all" || bean.status === status.value)
        && hasSelectedFlavor
        && (!favorites.checked || bean.favorite);
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
    return beans.sort(comparators[sort.value] || comparators.favorites_recent);
  }

  function render() {
    syncFlavorFilterOptions();
    const beans = filteredBeans();
    grid.innerHTML = beans.map(bean => beanCardHtml(bean, state)).join("");
    empty.classList.toggle("hidden", beans.length > 0);
  }

  [search, roast, status, flavor, sort, favorites].forEach(input => input.addEventListener("input", render));
  document.querySelectorAll("#beansAddButton, #beanEmptyAddButton").forEach(button => button?.addEventListener("click", onAdd));
  grid.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-bean]");
    const favorite = event.target.closest("[data-toggle-bean-favorite]");
    if (edit) onEdit(edit.dataset.editBean);
    if (favorite) onFavorite(favorite.dataset.toggleBeanFavorite);
  });
  return { render };
}
