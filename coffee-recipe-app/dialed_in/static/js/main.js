import { api } from "./core/api.js";
import { applyServerState, state } from "./core/state.js";
import { showToast } from "./core/toast.js";
import { createNavigation } from "./components/navigation.js";
import { createRecipeForm } from "./features/recipe-form.js";
import { createSettings } from "./features/settings.js";
import { createOverviewPage } from "./pages/overview.js";
import { createRecipesPage } from "./pages/recipes.js";
import { createDialInPage } from "./pages/dial-in.js";

let overviewPage;
let recipesPage;
let dialInPage;
let navigation;

function renderAll() {
  overviewPage?.render();
  recipesPage?.render();
  dialInPage?.render();
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

const recipeForm = createRecipeForm({
  state,
  api,
  showToast,
  onChanged: renderAll
});

const settings = createSettings({
  state,
  api,
  showToast,
  reloadState: loadState,
  onChanged: renderAll
});

navigation = createNavigation({
  onPageChange(page) {
    state.activePage = page;
    if (page === "dial-in") dialInPage?.render();
  },
  onOpenSettings: settings.open
});

const editRecipe = id => {
  const recipe = state.recipes.find(item => item.id === id);
  if (recipe) recipeForm.open(recipe);
};

const addRecipe = () => recipeForm.open();

overviewPage = createOverviewPage({
  state,
  onEdit: editRecipe,
  onFavorite: recipeForm.toggleFavorite,
  onAdd: addRecipe
});

recipesPage = createRecipesPage({
  state,
  onEdit: editRecipe,
  onFavorite: recipeForm.toggleFavorite,
  onAdd: addRecipe
});

dialInPage = createDialInPage({ state });

document.querySelector("#mobileAddButton")?.addEventListener("click", addRecipe);

const initialPage = location.hash.slice(1) || "overview";
navigation.showPage(initialPage, { updateHash: !location.hash });
void loadState();
