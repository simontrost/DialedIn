import { beanById, methodById, recipeById, toLocalDateTimeInput } from "../core/utils.js";

export function createDialInLogForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#dialInLogDialog");
  const form = document.querySelector("#dialInLogForm");
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
  let currentBeanId = "";
  let currentRecipeId = "";

  function open({ beanId = state.selectedDialBeanId, recipeId = state.selectedDialRecipeId } = {}) {
    const recipe = recipeById(state, recipeId);
    const bean = beanById(state, beanId || recipe?.beanId);
    if (!recipe || !bean) {
      showToast("Choose a bean and recipe first");
      return false;
    }
    currentBeanId = bean.id;
    currentRecipeId = recipe.id;
    const method = methodById(state, recipe.method);
    context.textContent = `${bean.name} · ${method.name} · ${recipe.name}`;
    brewedAt.value = toLocalDateTimeInput();
    grind.value = recipe.values?.grind ?? "";
    time.value = recipe.values?.targetTime ?? "";
    dose.value = recipe.values?.dose ?? "";
    beverageYield.value = recipe.values?.beverageYield ?? recipe.values?.waterAmount ?? "";
    taste.value = "neutral";
    rating.value = "";
    notes.value = "";
    valid.checked = true;
    dialog.showModal();
    return true;
  }

  async function save(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const saved = await api("/api/dial-in-logs", {
        method: "POST",
        body: JSON.stringify({
          beanId: currentBeanId,
          brewRecipeId: currentRecipeId,
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
      dialog.close();
      onChanged(saved);
      showToast("Measurement saved");
    } catch (error) {
      alert(error.message);
    }
  }

  form.addEventListener("submit", save);
  document.querySelectorAll("[data-close-dial-log-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));
  return { open };
}
