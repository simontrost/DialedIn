import { beanCardHtml } from "../components/bean-card.js";
import { escapeHtml } from "../core/utils.js";

export function createOverviewPage({ state, onEditBean, onToggleBeanFavorite, onAddBean, onEditRecipe, onAddRecipe }) {
  const grid = document.querySelector("#overviewBeanGrid");
  const empty = document.querySelector("#overviewEmptyState");
  const methodFilter = document.querySelector("#overviewMethodFilter");
  const beanCount = document.querySelector("#beanCount");
  const recipeCount = document.querySelector("#brewRecipeCount");
  const measurementCount = document.querySelector("#measurementCount");
  const machineLabel = document.querySelector("#machineLabel");
  const grinderLabel = document.querySelector("#grinderLabel");

  function setGreeting() {
    const hour = new Date().getHours();
    document.querySelector("#greeting").textContent = hour < 11 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function syncMethodOptions() {
    const selected = methodFilter.value || "espresso";
    methodFilter.innerHTML = state.brewingMethods
      .map(method => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.name)}</option>`)
      .join("");
    methodFilter.value = [...methodFilter.options].some(option => option.value === selected) ? selected : (state.brewingMethods[0]?.id || "");
  }

  function render() {
    syncMethodOptions();
    const beans = [...state.beans]
      .filter(bean => bean.status !== "wishlist")
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
    grid.innerHTML = beans.map(bean => beanCardHtml(bean, state, {
      dashboardMethod: methodFilter.value,
      showRecipe: true
    })).join("");
    empty.classList.toggle("hidden", beans.length > 0);
    beanCount.textContent = state.beans.length;
    recipeCount.textContent = state.brewRecipes.length;
    measurementCount.textContent = state.dialInLogs.length;
    machineLabel.textContent = state.settings.machine;
    grinderLabel.textContent = state.settings.grinder;
  }

  grid.addEventListener("click", event => {
    const editBean = event.target.closest("[data-edit-bean]");
    const favorite = event.target.closest("[data-toggle-bean-favorite]");
    const editRecipe = event.target.closest("[data-edit-recipe]");
    const addRecipe = event.target.closest("[data-add-recipe-for-bean]");
    if (editBean) onEditBean(editBean.dataset.editBean);
    if (favorite) onToggleBeanFavorite(favorite.dataset.toggleBeanFavorite);
    if (editRecipe) onEditRecipe(editRecipe.dataset.editRecipe);
    if (addRecipe) onAddRecipe({ beanId: addRecipe.dataset.addRecipeForBean, method: addRecipe.dataset.method });
  });
  methodFilter.addEventListener("change", render);
  document.querySelectorAll("#overviewAddBeanButton, #overviewEmptyAddButton").forEach(button => button?.addEventListener("click", onAddBean));
  setGreeting();
  return { render };
}
