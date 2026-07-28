import { beanById, escapeHtml, formatDateTime, formatNumber, methodById, recipeById } from "../core/utils.js";

const tasteLabels = {
  very_sour: "Very sour", sour: "Sour", neutral: "Neutral", balanced: "Balanced",
  bitter: "Bitter", very_bitter: "Very bitter", astringent: "Astringent", hollow: "Hollow"
};

export function createDialInPage({ state, api, showToast, onAddMeasurement, onEditRecipe }) {
  const beanSelect = document.querySelector("#dialInBeanSelect");
  const recipeSelect = document.querySelector("#dialInRecipeSelect");
  const maxStep = document.querySelector("#dialInMaxStep");
  const addButton = document.querySelector("#addMeasurementButton");
  const emptyAddButton = document.querySelector("#dialInEmptyAddButton");
  const calculateButton = document.querySelector("#calculateGrindButton");
  const editTargetButton = document.querySelector("#editDialTargetButton");
  const tableBody = document.querySelector("#measurementTableBody");
  const mobileList = document.querySelector("#measurementMobileList");
  const empty = document.querySelector("#dialInEmptyState");
  const targetSummary = document.querySelector("#dialTargetSummary");
  const recipeSummary = document.querySelector("#dialRecipeSummary");
  const measurementSummary = document.querySelector("#dialMeasurementSummary");
  const spanSummary = document.querySelector("#dialDateSpanSummary");
  const recommended = document.querySelector("#recommendedGrind");
  const recommendationMeta = document.querySelector("#recommendationMeta");
  const recommendationCard = document.querySelector("#recommendationCard");
  let recommendationRecipeId = "";

  function dialableRecipes(beanId) {
    return state.brewRecipes.filter(recipe => recipe.beanId === beanId && methodById(state, recipe.method).supportsDialIn);
  }

  function selectedRecipe() {
    return recipeById(state, recipeSelect.value);
  }

  function selectedLogs() {
    return state.dialInLogs
      .filter(log => log.brewRecipeId === recipeSelect.value)
      .sort((a, b) => new Date(b.brewedAt) - new Date(a.brewedAt));
  }

  function syncSelectors() {
    const previousBean = state.selectedDialBeanId || beanSelect.value;
    beanSelect.innerHTML = state.beans.length
      ? state.beans.map(bean => `<option value="${bean.id}">${escapeHtml(bean.name)}${bean.roaster ? ` · ${escapeHtml(bean.roaster)}` : ""}</option>`).join("")
      : '<option value="">No beans available</option>';
    const selectedBean = [...beanSelect.options].some(option => option.value === previousBean) ? previousBean : (state.beans[0]?.id || "");
    beanSelect.value = selectedBean;
    state.selectedDialBeanId = selectedBean;

    const recipes = dialableRecipes(selectedBean);
    const previousRecipe = state.selectedDialRecipeId || recipeSelect.value;
    recipeSelect.innerHTML = recipes.length
      ? recipes.map(recipe => {
        const method = methodById(state, recipe.method);
        return `<option value="${recipe.id}">${escapeHtml(recipe.name)} · ${escapeHtml(method.name)}</option>`;
      }).join("")
      : '<option value="">No dial-in recipe for this bean</option>';
    const selected = [...recipeSelect.options].some(option => option.value === previousRecipe) ? previousRecipe : (recipes[0]?.id || "");
    recipeSelect.value = selected;
    state.selectedDialRecipeId = selected;
  }

  function resetRecommendation() {
    recommendationRecipeId = "";
    recommended.textContent = "–";
    recommendationMeta.textContent = "Calculate after adding measurements";
    recommendationCard.dataset.confidence = "";
  }

  function renderTable(logs) {
    tableBody.innerHTML = logs.map(log => `
      <tr class="${log.valid ? "" : "invalid-measurement"}">
        <td>${escapeHtml(formatDateTime(log.brewedAt))}${log.valid ? "" : '<small class="invalid-label">Excluded</small>'}</td>
        <td><strong>${formatNumber(log.grind, 2)}</strong></td>
        <td>${formatNumber(log.dose, 1)} g</td>
        <td>${formatNumber(log.beverageYield, 1)} g</td>
        <td>${formatNumber(log.time, 1)} s</td>
        <td>${escapeHtml(tasteLabels[log.taste] || log.taste)}</td>
        <td>${log.rating === null || log.rating === undefined ? "–" : `${formatNumber(log.rating, 1)} / 5`}</td>
        <td><button class="table-delete-button" type="button" data-delete-log="${log.id}" aria-label="Delete measurement">×</button></td>
      </tr>`).join("");

    mobileList.innerHTML = logs.map(log => `
      <article class="measurement-mobile-card ${log.valid ? "" : "invalid-measurement"}">
        <div class="measurement-mobile-summary">
          <div class="measurement-mobile-date">
            <strong>${escapeHtml(formatDateTime(log.brewedAt))}</strong>
            ${log.valid ? "" : '<small class="invalid-label">Excluded</small>'}
          </div>
          <div class="measurement-mobile-primary"><span>Grind</span><strong>${formatNumber(log.grind, 2)}</strong></div>
          <div class="measurement-mobile-primary"><span>Time</span><strong>${formatNumber(log.time, 1)} s</strong></div>
          <button class="table-delete-button" type="button" data-delete-log="${log.id}" aria-label="Delete measurement">×</button>
        </div>
        <details class="measurement-mobile-details">
          <summary>Show all details</summary>
          <dl>
            <div><dt>Dose</dt><dd>${formatNumber(log.dose, 1)} g</dd></div>
            <div><dt>Yield</dt><dd>${formatNumber(log.beverageYield, 1)} g</dd></div>
            <div><dt>Taste</dt><dd>${escapeHtml(tasteLabels[log.taste] || log.taste)}</dd></div>
            <div><dt>Rating</dt><dd>${log.rating === null || log.rating === undefined ? "–" : `${formatNumber(log.rating, 1)} / 5`}</dd></div>
          </dl>
        </details>
      </article>`).join("");
  }

  function render() {
    syncSelectors();
    const recipe = selectedRecipe();
    const method = recipe ? methodById(state, recipe.method) : null;
    const logs = selectedLogs();
    const validLogs = logs.filter(log => log.valid);
    const disabled = !recipe;
    addButton.disabled = disabled;
    calculateButton.disabled = disabled || !validLogs.length;
    emptyAddButton.disabled = disabled;
    editTargetButton.disabled = disabled;

    targetSummary.textContent = recipe?.values?.targetTime ? `${formatNumber(recipe.values.targetTime, 1)} s` : "–";
    recipeSummary.textContent = recipe ? `${method.name} · target grind ${formatNumber(recipe.values?.grind, 2)}` : "Create a dial-in-capable recipe first";
    measurementSummary.textContent = String(logs.length);
    if (logs.length > 1) {
      const oldest = logs[logs.length - 1].brewedAt;
      const newest = logs[0].brewedAt;
      const days = Math.max(0, Math.round((new Date(newest) - new Date(oldest)) / 86400000));
      spanSummary.textContent = `${validLogs.length} used · ${days} day history`;
    } else if (logs.length === 1) spanSummary.textContent = `${validLogs.length} used · first measurement`;
    else spanSummary.textContent = "No history yet";
    renderTable(logs);
    empty.classList.toggle("hidden", logs.length > 0);
    if (recommendationRecipeId && recommendationRecipeId !== recipe?.id) resetRecommendation();
  }

  function addMeasurement() {
    const recipe = selectedRecipe();
    if (!recipe) return showToast("Create or choose a recipe first");
    onAddMeasurement({ beanId: recipe.beanId, recipeId: recipe.id });
  }

  function editTargetTime() {
    const recipe = selectedRecipe();
    if (!recipe) return showToast("Create or choose a recipe first");
    onEditRecipe(recipe.id, { focusField: "targetTime" });
  }

  async function calculate() {
    const recipe = selectedRecipe();
    if (!recipe) return;
    calculateButton.disabled = true;
    calculateButton.textContent = "Calculating …";
    try {
      const result = await api("/api/dial-in/recommendation", {
        method: "POST",
        body: JSON.stringify({ recipeId: recipe.id, maxStep: Number(maxStep.value) || 2.5 })
      });
      recommendationRecipeId = recipe.id;
      recommended.textContent = formatNumber(result.recommendedGrind, 3);
      const confidence = String(result.confidence || "low");
      recommendationMeta.textContent = `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`;
      recommendationCard.dataset.confidence = result.confidence;
    } catch (error) {
      showToast(error.message);
    } finally {
      calculateButton.textContent = "Calculate grind";
      calculateButton.disabled = !selectedLogs().some(log => log.valid);
    }
  }

  async function deleteLog(logId) {
    if (!confirm("Delete this measurement permanently?")) return;
    try {
      await api(`/api/dial-in-logs/${logId}`, { method: "DELETE" });
      state.dialInLogs = state.dialInLogs.filter(log => log.id !== logId);
      resetRecommendation();
      render();
      showToast("Measurement deleted");
    } catch (error) {
      showToast(error.message);
    }
  }

  function selectRecipe(recipeId) {
    const recipe = recipeById(state, recipeId);
    if (!recipe) return;
    state.selectedDialBeanId = recipe.beanId;
    state.selectedDialRecipeId = recipe.id;
    resetRecommendation();
    render();
  }

  beanSelect.addEventListener("change", () => {
    state.selectedDialBeanId = beanSelect.value;
    state.selectedDialRecipeId = "";
    resetRecommendation();
    render();
  });
  recipeSelect.addEventListener("change", () => {
    state.selectedDialRecipeId = recipeSelect.value;
    resetRecommendation();
    render();
  });
  addButton.addEventListener("click", addMeasurement);
  emptyAddButton.addEventListener("click", addMeasurement);
  calculateButton.addEventListener("click", calculate);
  editTargetButton.addEventListener("click", editTargetTime);
  function handleDeleteClick(event) {
    const button = event.target.closest("[data-delete-log]");
    if (button) deleteLog(button.dataset.deleteLog);
  }
  tableBody.addEventListener("click", handleDeleteClick);
  mobileList.addEventListener("click", handleDeleteClick);
  return { render, selectRecipe };
}
