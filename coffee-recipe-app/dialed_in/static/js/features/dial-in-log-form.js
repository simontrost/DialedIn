import { beanById, escapeHtml, methodById, recipeById, toLocalDateTimeInput } from "../core/utils.js";

export function createDialInLogForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#dialInLogDialog");
  const form = document.querySelector("#dialInLogForm");
  const beanInput = document.querySelector("#logBeanInput");
  const recipeInput = document.querySelector("#logRecipeInput");
  const context = document.querySelector("#selectedLogContext");
  const brewedAt = document.querySelector("#logBrewedAtInput");
  const grind = document.querySelector("#logGrindInput");
  const time = document.querySelector("#logTimeInput");
  const dose = document.querySelector("#logDoseInput");
  const beverageYield = document.querySelector("#logYieldInput");
  const taste = document.querySelector("#logTasteInput");
  const rating = document.querySelector("#logRatingInput");
  const notes = document.querySelector("#logNotesInput");
  const valid = document.querySelector("#logValidInput");

  function dialableRecipes(beanId) {
    return state.brewRecipes.filter(recipe => recipe.beanId === beanId && methodById(state, recipe.method)?.supportsDialIn);
  }

  function syncBeanOptions(preferredBeanId = "") {
    beanInput.innerHTML = state.beans.length
      ? state.beans.map(bean => `<option value="${escapeHtml(bean.id)}">${escapeHtml(bean.name)}${bean.roaster ? ` · ${escapeHtml(bean.roaster)}` : ""}</option>`).join("")
      : '<option value="">No beans available</option>';
    beanInput.value = [...beanInput.options].some(option => option.value === preferredBeanId)
      ? preferredBeanId
      : (state.beans[0]?.id || "");
  }

  function syncRecipeOptions(preferredRecipeId = "") {
    const recipes = dialableRecipes(beanInput.value);
    recipeInput.innerHTML = recipes.length
      ? recipes.map(recipe => {
        const method = methodById(state, recipe.method);
        return `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)} · ${escapeHtml(method?.name || recipe.method)}</option>`;
      }).join("")
      : '<option value="">No dial-in recipe for this bean</option>';
    recipeInput.value = [...recipeInput.options].some(option => option.value === preferredRecipeId)
      ? preferredRecipeId
      : (recipes[0]?.id || "");
    recipeInput.disabled = !recipes.length;
  }

  function applyRecipeDefaults({ overwrite = true } = {}) {
    const recipe = recipeById(state, recipeInput.value);
    const bean = beanById(state, beanInput.value || recipe?.beanId);
    if (!recipe || !bean) {
      context.textContent = "Choose a bean with a dial-in-capable recipe.";
      return;
    }
    const method = methodById(state, recipe.method);
    context.textContent = `${bean.name} · ${method?.name || recipe.method} · ${recipe.name}`;
    if (overwrite || grind.value === "") grind.value = recipe.values?.grind ?? "";
    if (overwrite || time.value === "") time.value = recipe.values?.targetTime ?? "";
    if (overwrite || dose.value === "") dose.value = recipe.values?.dose ?? "";
    if (overwrite || beverageYield.value === "") {
      beverageYield.value = recipe.values?.beverageYield ?? recipe.values?.waterAmount ?? "";
    }
  }

  function open({ beanId = "", recipeId = "" } = {}) {
    const preferredRecipe = recipeById(state, recipeId);
    const preferredBeanId = beanId || preferredRecipe?.beanId || state.selectedDialBeanId || "";
    const preferredRecipeId = recipeId || (preferredBeanId === state.selectedDialBeanId ? state.selectedDialRecipeId : "") || "";

    syncBeanOptions(preferredBeanId);
    syncRecipeOptions(preferredRecipeId);
    if (!recipeInput.value) {
      showToast("Create a dial-in-capable recipe first");
      return false;
    }

    brewedAt.value = toLocalDateTimeInput();
    grind.value = "";
    time.value = "";
    dose.value = "";
    beverageYield.value = "";
    taste.value = "neutral";
    rating.value = "";
    notes.value = "";
    valid.checked = true;
    applyRecipeDefaults();
    dialog.showModal();
    return true;
  }

  async function save(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const recipe = recipeById(state, recipeInput.value);
    const bean = beanById(state, beanInput.value);
    if (!recipe || !bean) {
      showToast("Choose a bean and recipe");
      return;
    }
    try {
      const saved = await api("/api/dial-in-logs", {
        method: "POST",
        body: JSON.stringify({
          beanId: bean.id,
          brewRecipeId: recipe.id,
          brewedAt: new Date(brewedAt.value).toISOString(),
          grind: Number(grind.value),
          time: Number(time.value),
          dose: dose.value === "" ? null : Number(dose.value),
          beverageYield: beverageYield.value === "" ? null : Number(beverageYield.value),
          taste: taste.value,
          rating: rating.value === "" ? null : Number(rating.value),
          notes: notes.value.trim(),
          valid: valid.checked
        })
      });
      state.dialInLogs.unshift(saved);
      state.selectedDialBeanId = bean.id;
      state.selectedDialRecipeId = recipe.id;
      dialog.close();
      onChanged(saved);
      showToast("Measurement saved");
    } catch (error) {
      alert(error.message);
    }
  }

  beanInput.addEventListener("change", () => {
    syncRecipeOptions();
    applyRecipeDefaults();
  });
  recipeInput.addEventListener("change", () => applyRecipeDefaults());
  form.addEventListener("submit", save);
  document.querySelectorAll("[data-close-dial-log-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));
  return { open };
}
