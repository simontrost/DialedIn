import { api } from "./core/api.js";
import { applyServerState, state } from "./core/state.js";
import { showToast } from "./core/toast.js";
import { createNavigation } from "./components/navigation.js";
import { createBeanForm } from "./features/bean-form.js";
import { createBrewRecipeForm } from "./features/brew-recipe-form.js";
import { createDialInLogForm } from "./features/dial-in-log-form.js";
import { createQuickAdd } from "./features/quick-add.js";
import { createSettings } from "./features/settings.js";
import { createOriginEditorEnhancer } from "./features/origin-editor.js";
import { createOverviewPage } from "./pages/overview.js";
import { createBeansPage } from "./pages/beans.js";
import { createRecipesPage } from "./pages/recipes.js";
import { createDialInPage } from "./pages/dial-in.js";
import { createOriginsPage } from "./pages/origins.js";

let overviewPage;
let beansPage;
let recipesPage;
let dialInPage;
let originsPage;
let navigation;
let quickAdd;

function renderAll() {
  overviewPage?.render();
  beansPage?.render();
  recipesPage?.render();
  dialInPage?.render();
  originsPage?.render();
  brewRecipeForm?.syncOptions();
}

async function loadState() {
  try {
    applyServerState(await api("/api/state"));
    renderAll();
  } catch (error) {
    showToast("Server unavailable");
    console.error(error);
  }
}

const beanForm = createBeanForm({ state, api, showToast, onChanged: renderAll });
const brewRecipeForm = createBrewRecipeForm({ state, api, showToast, onChanged: renderAll });
const dialInLogForm = createDialInLogForm({
  state,
  api,
  showToast,
  onChanged() {
    dialInPage?.invalidateRecommendation();
    renderAll();
  }
});
const settings = createSettings({ state, api, showToast, reloadState: loadState, onChanged: renderAll });

createOriginEditorEnhancer();

navigation = createNavigation({
  onPageChange(page) {
    state.activePage = page;
    if (page === "dial-in") dialInPage?.render();
    if (page === "origins") originsPage?.activate();
  },
  onOpenSettings: settings.open
});

function editBean(beanId) {
  const bean = state.beans.find(item => item.id === beanId);
  if (bean) beanForm.open(bean);
}
function toggleBeanFavorite(beanId) {
  const bean = state.beans.find(item => item.id === beanId);
  if (bean) beanForm.toggleFavorite(bean).catch(error => showToast(error.message));
}
function addBean() { beanForm.open(); }
function editRecipe(recipeId, options = {}) {
  const recipe = state.brewRecipes.find(item => item.id === recipeId);
  if (recipe) brewRecipeForm.open(recipe, options);
}
function addRecipe(defaults = {}) { brewRecipeForm.open(null, defaults); }
function addMeasurement(defaults = {}) { dialInLogForm.open(defaults); }
function editMeasurement(logId) {
  const log = state.dialInLogs.find(item => item.id === logId);
  if (log) dialInLogForm.open({ log });
}
function openDialIn(recipeId) {
  dialInPage.selectRecipe(recipeId);
  navigation.showPage("dial-in");
}

overviewPage = createOverviewPage({
  state,
  onEditBean: editBean,
  onToggleBeanFavorite: toggleBeanFavorite,
  onAddBean: addBean,
  onEditRecipe: editRecipe,
  onAddRecipe: addRecipe
});
beansPage = createBeansPage({ state, onEdit: editBean, onFavorite: toggleBeanFavorite, onAdd: addBean });
recipesPage = createRecipesPage({
  state,
  onEdit: editRecipe,
  onFavorite: brewRecipeForm.toggleFavorite,
  onAdd: addRecipe,
  onOpenDialIn: openDialIn
});
dialInPage = createDialInPage({
  state,
  api,
  showToast,
  onAddMeasurement: addMeasurement,
  onEditMeasurement: editMeasurement,
  onEditRecipe: editRecipe
});
originsPage = createOriginsPage({ state, onEditBean: editBean, showToast });

quickAdd = createQuickAdd({
  onAddBean: addBean,
  onAddRecipe: () => addRecipe(),
  onAddMeasurement: () => {
    navigation.showPage("dial-in");
    dialInPage.render();
    addMeasurement();
  }
});
document.querySelector("#mobileAddButton")?.addEventListener("click", quickAdd.open);

const initialPage = location.hash.slice(1) || "overview";
navigation.showPage(initialPage, { updateHash: !location.hash });
void loadState();
