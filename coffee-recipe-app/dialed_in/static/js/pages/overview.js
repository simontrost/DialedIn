import { beanCardHtml } from "../components/bean-card.js";
import { escapeHtml } from "../core/utils.js";

const METHOD_ICON_BASE = "/static/icons/methods/";

function methodIconUrl(method) {
  const icon = method?.icon || method?.id || "custom-method";
  return `${METHOD_ICON_BASE}${encodeURIComponent(icon)}.svg`;
}

export function createOverviewPage({ state, onEditBean, onToggleBeanFavorite, onAddBean, onEditRecipe, onAddRecipe }) {
  const grid = document.querySelector("#overviewBeanGrid");
  const empty = document.querySelector("#overviewEmptyState");
  const methodPicker = document.querySelector("#overviewMethodPicker");
  const methodTrigger = document.querySelector("#overviewMethodTrigger");
  const methodMenu = document.querySelector("#overviewMethodMenu");
  const methodIcon = document.querySelector("#overviewMethodIcon");
  const methodLabel = document.querySelector("#overviewMethodLabel");
  const beanCount = document.querySelector("#beanCount");
  const recipeCount = document.querySelector("#brewRecipeCount");
  const measurementCount = document.querySelector("#measurementCount");
  const machineLabel = document.querySelector("#machineLabel");
  const grinderLabel = document.querySelector("#grinderLabel");
  let selectedMethodId = "espresso";

  function setGreeting() {
    const hour = new Date().getHours();
    document.querySelector("#greeting").textContent = hour < 11 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function selectedMethod() {
    return state.brewingMethods.find(method => method.id === selectedMethodId) || state.brewingMethods[0];
  }

  function closeMethodMenu() {
    methodPicker?.classList.remove("is-open");
    methodMenu?.classList.add("hidden");
    methodTrigger?.setAttribute("aria-expanded", "false");
  }

  function updateMethodTrigger() {
    const method = selectedMethod();
    if (!method) return;
    selectedMethodId = method.id;
    methodLabel.textContent = method.name;
    methodIcon.style.setProperty("--app-icon", `url('${methodIconUrl(method)}')`);
  }

  function syncMethodOptions() {
    if (!state.brewingMethods.some(method => method.id === selectedMethodId)) {
      selectedMethodId = state.brewingMethods[0]?.id || "";
    }
    methodMenu.innerHTML = state.brewingMethods.map(method => {
      const active = method.id === selectedMethodId;
      return `<button class="method-select-option" type="button" role="option" aria-selected="${active}" data-method-value="${escapeHtml(method.id)}">
        <span class="app-icon" style="--app-icon:url('${methodIconUrl(method)}')" aria-hidden="true"></span>
        <span>${escapeHtml(method.name)}</span>
        <span class="method-select-check" aria-hidden="true">✓</span>
      </button>`;
    }).join("");
    updateMethodTrigger();
  }

  function render() {
    syncMethodOptions();
    const beans = [...state.beans]
      .filter(bean => bean.status !== "wishlist")
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
    grid.innerHTML = beans.map(bean => beanCardHtml(bean, state, {
      dashboardMethod: selectedMethodId,
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

  methodTrigger?.addEventListener("click", () => {
    const willOpen = methodMenu.classList.contains("hidden");
    if (willOpen) {
      methodPicker.classList.add("is-open");
      methodMenu.classList.remove("hidden");
      methodTrigger.setAttribute("aria-expanded", "true");
      methodMenu.querySelector('[aria-selected="true"]')?.focus();
    } else {
      closeMethodMenu();
    }
  });

  methodMenu?.addEventListener("click", event => {
    const option = event.target.closest("[data-method-value]");
    if (!option) return;
    selectedMethodId = option.dataset.methodValue;
    closeMethodMenu();
    render();
  });

  document.addEventListener("click", event => {
    if (methodPicker && !methodPicker.contains(event.target)) closeMethodMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMethodMenu();
  });

  document.querySelectorAll("#overviewAddBeanButton, #overviewEmptyAddButton").forEach(button => button?.addEventListener("click", onAddBean));
  setGreeting();
  return { render };
}
