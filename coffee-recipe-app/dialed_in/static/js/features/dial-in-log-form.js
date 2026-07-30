import { beanById, escapeHtml, methodById, recipeById, toLocalDateTimeInput } from "../core/utils.js";

const legacyTasteLabels = {
  astringent: "Astringent (legacy)",
  hollow: "Hollow / weak (legacy)"
};

export function createDialInLogForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#dialInLogDialog");
  const form = document.querySelector("#dialInLogForm");
  const eyebrow = document.querySelector("#dialInLogEyebrow");
  const title = document.querySelector("#dialInLogTitle");
  const submitButton = document.querySelector("#saveDialInLogButton");
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
  let editingLogId = "";

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
      ? recipes.map(recipe => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</option>`).join("")
      : '<option value="">No dial-in recipe for this bean</option>';
    recipeInput.value = [...recipeInput.options].some(option => option.value === preferredRecipeId)
      ? preferredRecipeId
      : (recipes[0]?.id || "");
    recipeInput.disabled = !recipes.length;
  }

  function updateContext() {
    const recipe = recipeById(state, recipeInput.value);
    const bean = beanById(state, beanInput.value || recipe?.beanId);
    if (!recipe || !bean) {
      context.textContent = "Choose a bean with a dial-in-capable recipe.";
      return null;
    }
    context.textContent = `${bean.name} · ${recipe.name}`;
    return { recipe, bean };
  }

  function applyRecipeDefaults({ overwrite = true } = {}) {
    const selected = updateContext();
    if (!selected) return;
    const { recipe } = selected;
    if (overwrite || grind.value === "") grind.value = recipe.values?.grind ?? "";
    if (overwrite || time.value === "") time.value = recipe.values?.targetTime ?? "";
    if (overwrite || dose.value === "") dose.value = recipe.values?.dose ?? "";
    if (overwrite || beverageYield.value === "") {
      beverageYield.value = recipe.values?.beverageYield ?? recipe.values?.waterAmount ?? "";
    }
  }

  function setTasteValue(value = "neutral") {
    taste.querySelectorAll("option[data-legacy-taste]").forEach(option => option.remove());
    const hasValue = [...taste.options].some(option => option.value === value);
    if (!hasValue && legacyTasteLabels[value]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = legacyTasteLabels[value];
      option.dataset.legacyTaste = "true";
      taste.append(option);
    }
    taste.value = [...taste.options].some(option => option.value === value) ? value : "neutral";
  }

  function setDialogMode(isEditing) {
    eyebrow.textContent = isEditing ? "Stored measurement" : "Brew measurement";
    title.textContent = isEditing ? "Edit measurement" : "Add to dial-in history";
    submitButton.textContent = isEditing ? "Save changes" : "Save measurement";
  }

  function open({ beanId = "", recipeId = "", log = null, logId = "" } = {}) {
    const existingLog = log || state.dialInLogs.find(item => item.id === logId) || null;
    editingLogId = existingLog?.id || "";
    setDialogMode(Boolean(existingLog));

    const preferredRecipe = recipeById(state, existingLog?.brewRecipeId || recipeId);
    const preferredBeanId = existingLog?.beanId || beanId || preferredRecipe?.beanId || state.selectedDialBeanId || "";
    const preferredRecipeId = existingLog?.brewRecipeId || recipeId || (preferredBeanId === state.selectedDialBeanId ? state.selectedDialRecipeId : "") || "";

    syncBeanOptions(preferredBeanId);
    syncRecipeOptions(preferredRecipeId);
    if (!recipeInput.value) {
      showToast("Create a dial-in-capable recipe first");
      return false;
    }

    if (existingLog) {
      brewedAt.value = toLocalDateTimeInput(existingLog.brewedAt);
      grind.value = existingLog.grind ?? "";
      time.value = existingLog.time ?? "";
      dose.value = existingLog.dose ?? "";
      beverageYield.value = existingLog.beverageYield ?? "";
      setTasteValue(existingLog.taste || "neutral");
      rating.value = existingLog.rating ?? "";
      notes.value = existingLog.notes || "";
      valid.checked = existingLog.valid !== false;
      updateContext();
    } else {
      brewedAt.value = toLocalDateTimeInput();
      grind.value = "";
      time.value = "";
      dose.value = "";
      beverageYield.value = "";
      setTasteValue("neutral");
      rating.value = "";
      notes.value = "";
      valid.checked = true;
      applyRecipeDefaults();
    }

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

    const wasEditing = Boolean(editingLogId);
    const endpoint = wasEditing ? `/api/dial-in-logs/${editingLogId}` : "/api/dial-in-logs";
    try {
      const saved = await api(endpoint, {
        method: wasEditing ? "PUT" : "POST",
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

      if (wasEditing) {
        const index = state.dialInLogs.findIndex(item => item.id === saved.id);
        if (index >= 0) state.dialInLogs[index] = saved;
        else state.dialInLogs.unshift(saved);
      } else {
        state.dialInLogs.unshift(saved);
      }
      state.selectedDialBeanId = bean.id;
      state.selectedDialRecipeId = recipe.id;
      dialog.close();
      onChanged(saved, { edited: wasEditing });
      showToast(wasEditing ? "Measurement updated" : "Measurement saved");
    } catch (error) {
      alert(error.message);
    }
  }

  beanInput.addEventListener("change", () => {
    syncRecipeOptions();
    if (editingLogId) updateContext();
    else applyRecipeDefaults();
  });
  recipeInput.addEventListener("change", () => {
    if (editingLogId) updateContext();
    else applyRecipeDefaults();
  });
  form.addEventListener("submit", save);
  dialog.addEventListener("close", () => { editingLogId = ""; });
  document.querySelectorAll("[data-close-dial-log-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));
  return { open };
}
