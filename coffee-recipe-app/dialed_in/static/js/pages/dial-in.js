import {
  beanById,
  escapeHtml,
  formatDateTime,
  formatNumber,
  iconMarkup,
  methodById,
  recipeById
} from "../core/utils.js";

const tasteLabels = {
  neutral: "Not judged / neutral",
  very_bitter: "Very bitter",
  bitter: "Bitter",
  little_bitter: "Little bitter",
  balanced: "Balanced",
  little_sour: "Little sour",
  sour: "Sour",
  very_sour: "Very sour",
  astringent: "Astringent",
  hollow: "Hollow / weak"
};

function formatOneDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(number);
}

function formatRatio(log) {
  const dose = Number(log.dose);
  const beverageYield = Number(log.beverageYield);
  if (!Number.isFinite(dose) || dose <= 0 || !Number.isFinite(beverageYield)) return "–";
  return `1:${formatNumber(beverageYield / dose, 2)}`;
}


function renderStarRating(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  if (!Number.isFinite(rating) || rating <= 0) return "–";
  const stars = Array.from({ length: 5 }, (_, index) => {
    const amount = Math.max(0, Math.min(1, rating - index));
    const stateClass = amount >= 0.99 ? "is-full" : amount >= 0.49 ? "is-half" : "";
    return `<span class="star-rating-mini-item ${stateClass}" aria-hidden="true"></span>`;
  }).join("");
  return `<span class="star-rating-mini" aria-label="${formatNumber(rating, 1)} out of 5 stars" title="${formatNumber(rating, 1)} / 5">${stars}</span>`;
}

export function createDialInPage({
  state,
  api,
  showToast,
  onAddMeasurement,
  onEditMeasurement,
  onEditRecipe,
  onRecipeChanged
}) {
  const beanSelect = document.querySelector("#dialInBeanSelect");
  const recipeSelect = document.querySelector("#dialInRecipeSelect");
  const maxStep = document.querySelector("#dialInMaxStep");
  const maxStepField = document.querySelector("#dialMaxStepField");
  const addButton = document.querySelector("#addMeasurementButton");
  const emptyAddButton = document.querySelector("#dialInEmptyAddButton");
  const calculateButton = document.querySelector("#calculateGrindButton");
  const editTargetButton = document.querySelector("#editDialTargetButton");
  const tableBody = document.querySelector("#measurementTableBody");
  const mobileList = document.querySelector("#measurementMobileList");
  const empty = document.querySelector("#dialInEmptyState");
  const targetSummary = document.querySelector("#dialTargetSummary");
  const recipeSummary = document.querySelector("#dialRecipeSummary");
  const currentGrindSummary = document.querySelector("#dialCurrentGrind");
  const currentGrindMeta = document.querySelector("#dialCurrentGrindMeta");
  const measurementSummary = document.querySelector("#dialMeasurementSummary");
  const spanSummary = document.querySelector("#dialDateSpanSummary");
  const recommended = document.querySelector("#recommendedGrind");
  const recommendationMeta = document.querySelector("#recommendationMeta");
  const recommendationCard = document.querySelector("#recommendationCard");
  const applyRecommendedButton = document.querySelector("#applyRecommendedGrindButton");
  const totalBrewCount = document.querySelector("#dialTotalBrewCount");
  const totalBrewLabel = document.querySelector("#dialTotalBrewLabel");
  const grindHeader = document.querySelector("#dialGrindHeader");
  const historyHint = document.querySelector("#dialHistoryHint");
  let recommendationRecipeId = "";
  let recommendedGrindValue = null;

  function adjustMaxStep(button) {
    if (maxStep.disabled) return;
    try {
      if (button.dataset.dialNumberStep === "up") maxStep.stepUp();
      else maxStep.stepDown();
    } catch (error) {
      const step = Number(maxStep.step) || 0.1;
      const current = maxStep.value === "" ? (Number(maxStep.min) || 0) : Number(maxStep.value);
      const next = current + (button.dataset.dialNumberStep === "up" ? step : -step);
      const minimum = maxStep.min === "" ? -Infinity : Number(maxStep.min);
      const maximum = maxStep.max === "" ? Infinity : Number(maxStep.max);
      maxStep.value = String(Math.min(maximum, Math.max(minimum, next)));
    }
    maxStep.dispatchEvent(new Event("input", { bubbles: true }));
    maxStep.dispatchEvent(new Event("change", { bubbles: true }));
    maxStep.focus({ preventScroll: true });
  }

  function dialableRecipes(beanId) {
    return state.brewRecipes.filter(recipe => recipe.beanId === beanId && methodById(state, recipe.method).supportsDialIn);
  }

  function selectedRecipe() {
    return recipeById(state, recipeSelect.value);
  }

  function selectedBean() {
    const recipe = selectedRecipe();
    return beanById(state, recipe?.beanId || beanSelect.value);
  }

  function selectedLogs() {
    return state.dialInLogs
      .filter(log => log.brewRecipeId === recipeSelect.value)
      .sort((a, b) => new Date(b.brewedAt) - new Date(a.brewedAt));
  }

  function syncSelectors() {
    const previousBean = state.selectedDialBeanId || beanSelect.value;
    beanSelect.innerHTML = state.beans.length
      ? state.beans.map(bean => `<option value="${escapeHtml(bean.id)}">${escapeHtml(bean.name)}${bean.roaster ? ` · ${escapeHtml(bean.roaster)}` : ""}${bean.isGround ? " · Pre-ground" : ""}</option>`).join("")
      : '<option value="">No beans available</option>';
    const selectedBean = [...beanSelect.options].some(option => option.value === previousBean) ? previousBean : (state.beans[0]?.id || "");
    beanSelect.value = selectedBean;
    state.selectedDialBeanId = selectedBean;

    const recipes = dialableRecipes(selectedBean);
    const previousRecipe = state.selectedDialRecipeId || recipeSelect.value;
    recipeSelect.innerHTML = recipes.length
      ? recipes.map(recipe => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</option>`).join("")
      : '<option value="">No dial-in recipe for this bean</option>';
    const selected = [...recipeSelect.options].some(option => option.value === previousRecipe) ? previousRecipe : (recipes[0]?.id || "");
    recipeSelect.value = selected;
    state.selectedDialRecipeId = selected;
  }

  function resetRecommendation() {
    recommendationRecipeId = "";
    recommendedGrindValue = null;
    recommended.textContent = "–";
    recommendationMeta.textContent = "Calculate after adding measurements";
    recommendationCard.dataset.confidence = "";
    applyRecommendedButton.classList.add("hidden");
    applyRecommendedButton.disabled = true;
    applyRecommendedButton.textContent = "Apply";
  }

  function showPreGroundRecommendation() {
    recommendationRecipeId = "";
    recommendedGrindValue = null;
    recommended.textContent = "N/A";
    recommendationMeta.textContent = "Disabled for pre-ground coffee";
    recommendationCard.dataset.confidence = "";
    applyRecommendedButton.classList.add("hidden");
    applyRecommendedButton.disabled = true;
    applyRecommendedButton.textContent = "Apply";
  }

  function rowActions(logId) {
    return `
      <div class="measurement-row-actions">
        <button class="table-edit-button" type="button" data-edit-log="${escapeHtml(logId)}" aria-label="Edit measurement" title="Edit measurement">
          ${iconMarkup("edit", { className: "app-icon--sm" })}
        </button>
        <button class="table-delete-button" type="button" data-delete-log="${escapeHtml(logId)}" aria-label="Delete measurement" title="Delete measurement">×</button>
      </div>`;
  }

  function renderTable(logs, showGrind = true) {
    tableBody.innerHTML = logs.map(log => `
      <tr class="${log.valid ? "" : "invalid-measurement"}">
        <td>${escapeHtml(formatDateTime(log.brewedAt))}${log.valid ? "" : '<small class="invalid-label">Excluded</small>'}</td>
        ${showGrind ? `<td><strong>${formatNumber(log.grind, 2)}</strong></td>` : ""}
        <td>${formatNumber(log.dose, 1)} g</td>
        <td>${formatNumber(log.beverageYield, 1)} g</td>
        <td>${formatRatio(log)}</td>
        <td>${formatNumber(log.time, 1)} s</td>
        <td>${escapeHtml(tasteLabels[log.taste] || log.taste)}</td>
        <td>${log.rating === null || log.rating === undefined ? "–" : renderStarRating(log.rating)}</td>
        <td class="measurement-actions-cell">${rowActions(log.id)}</td>
      </tr>`).join("");

    mobileList.innerHTML = logs.map(log => `
      <article class="measurement-mobile-card ${log.valid ? "" : "invalid-measurement"}">
        <div class="measurement-mobile-summary">
          <div class="measurement-mobile-date">
            <strong>${escapeHtml(formatDateTime(log.brewedAt))}</strong>
            ${log.valid ? "" : '<small class="invalid-label">Excluded</small>'}
          </div>
          ${showGrind
            ? `<div class="measurement-mobile-primary"><span>Grind</span><strong>${formatNumber(log.grind, 2)}</strong></div>`
            : `<div class="measurement-mobile-primary"><span>Ratio</span><strong>${formatRatio(log)}</strong></div>`}
          <div class="measurement-mobile-primary"><span>Time</span><strong>${formatNumber(log.time, 1)} s</strong></div>
          ${rowActions(log.id)}
        </div>
        <details class="measurement-mobile-details">
          <summary>Show all details</summary>
          <dl>
            <div><dt>Dose</dt><dd>${formatNumber(log.dose, 1)} g</dd></div>
            <div><dt>Yield</dt><dd>${formatNumber(log.beverageYield, 1)} g</dd></div>
            <div><dt>Ratio</dt><dd>${formatRatio(log)}</dd></div>
            <div><dt>Taste</dt><dd>${escapeHtml(tasteLabels[log.taste] || log.taste)}</dd></div>
            <div><dt>Rating</dt><dd>${log.rating === null || log.rating === undefined ? "–" : renderStarRating(log.rating)}</dd></div>
          </dl>
        </details>
      </article>`).join("");
  }

  function syncGrinderRange() {
    const minimum = Number(state.settings.grindMin ?? 0);
    const maximum = Number(state.settings.grindMax ?? 500);
    const span = Math.max(0.1, maximum - minimum);
    maxStep.max = String(span);
    if (Number(maxStep.value) > span) maxStep.value = String(span);
  }

  function render() {
    syncSelectors();
    syncGrinderRange();
    const totalBrews = state.dialInLogs.length;
    totalBrewCount.textContent = String(totalBrews);
    totalBrewLabel.textContent = totalBrews === 1 ? "brew logged" : "brews logged";
    const recipe = selectedRecipe();
    const bean = selectedBean();
    const isGround = Boolean(bean?.isGround);
    const method = recipe ? methodById(state, recipe.method) : null;
    const logs = selectedLogs();
    const validLogs = logs.filter(log => log.valid);
    const disabled = !recipe;
    addButton.disabled = disabled;
    calculateButton.disabled = disabled || isGround || !validLogs.length;
    calculateButton.title = isGround ? "Grind recommendations are disabled for pre-ground coffee" : "";
    emptyAddButton.disabled = disabled;
    editTargetButton.disabled = disabled;
    maxStep.disabled = disabled || isGround;
    maxStepField.classList.toggle("is-disabled", disabled || isGround);

    targetSummary.textContent = recipe?.values?.targetTime ? `${formatNumber(recipe.values.targetTime, 1)} s` : "–";
    recipeSummary.textContent = recipe
      ? `${method.name} ${isGround ? "brew log · pre-ground coffee" : "recipe"}`
      : "Create a dial-in-capable recipe first";
    currentGrindSummary.textContent = isGround
      ? "Pre-ground"
      : (recipe?.values?.grind === null || recipe?.values?.grind === undefined || recipe?.values?.grind === ""
        ? "–"
        : formatOneDecimal(recipe.values.grind));
    currentGrindMeta.textContent = isGround
      ? "No grind setting applies to this bean"
      : "Saved in the selected recipe";
    measurementSummary.textContent = String(logs.length);
    if (logs.length > 1) {
      const oldest = logs[logs.length - 1].brewedAt;
      const newest = logs[0].brewedAt;
      const days = Math.max(0, Math.round((new Date(newest) - new Date(oldest)) / 86400000));
      spanSummary.textContent = isGround
        ? `${logs.length} logged · ${days} day history`
        : `${validLogs.length} used · ${days} day history`;
    } else if (logs.length === 1) spanSummary.textContent = isGround
      ? "1 logged · first measurement"
      : `${validLogs.length} used · first measurement`;
    else spanSummary.textContent = "No history yet";
    grindHeader.classList.toggle("hidden", isGround);
    historyHint.textContent = isGround
      ? "Measurements remain available as a brew log. Grind calculations are disabled for pre-ground coffee."
      : "Invalid shots stay visible but are excluded from the calculation.";
    renderTable(logs, !isGround);
    empty.classList.toggle("hidden", logs.length > 0);
    if (isGround) showPreGroundRecommendation();
    else if (recommendationRecipeId && recommendationRecipeId !== recipe?.id) resetRecommendation();
  }

  function addMeasurement() {
    const recipe = selectedRecipe();
    if (!recipe) return showToast("Create or choose a recipe first");
    onAddMeasurement({ beanId: recipe.beanId, recipeId: recipe.id });
  }

  function editMeasurement(logId) {
    const log = state.dialInLogs.find(item => item.id === logId);
    if (!log) return showToast("Measurement not found");
    onEditMeasurement(log.id);
  }

  function editTargetTime() {
    const recipe = selectedRecipe();
    if (!recipe) return showToast("Create or choose a recipe first");
    onEditRecipe(recipe.id, { focusField: "targetTime" });
  }

  async function calculate() {
    const recipe = selectedRecipe();
    if (!recipe) return;
    if (selectedBean()?.isGround) return showToast("Grind recommendations are disabled for pre-ground coffee");
    calculateButton.disabled = true;
    calculateButton.textContent = "Calculating …";
    try {
      const result = await api("/api/dial-in/recommendation", {
        method: "POST",
        body: JSON.stringify({
          recipeId: recipe.id,
          maxStep: Number(maxStep.value) || 2.5,
          grindMin: Number(state.settings.grindMin ?? 0),
          grindMax: Number(state.settings.grindMax ?? 500)
        })
      });
      recommendationRecipeId = recipe.id;
      recommendedGrindValue = Math.round(Number(result.recommendedGrind) * 10) / 10;
      recommended.textContent = formatOneDecimal(recommendedGrindValue);
      applyRecommendedButton.classList.remove("hidden");
      applyRecommendedButton.disabled = false;
      applyRecommendedButton.textContent = "Apply";
      const confidence = String(result.confidence || "low");
      recommendationMeta.textContent = `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`;
      recommendationCard.dataset.confidence = result.confidence;
    } catch (error) {
      showToast(error.message);
    } finally {
      calculateButton.textContent = "Calculate grind";
      calculateButton.disabled = Boolean(selectedBean()?.isGround) || !selectedLogs().some(log => log.valid);
    }
  }

  async function applyRecommendedGrind() {
    const recipe = selectedRecipe();
    if (selectedBean()?.isGround) return showToast("Grind settings cannot be applied to pre-ground coffee");
    if (!recipe || recommendationRecipeId !== recipe.id || !Number.isFinite(recommendedGrindValue)) {
      return showToast("Calculate a grind recommendation first");
    }

    applyRecommendedButton.disabled = true;
    applyRecommendedButton.textContent = "Applying …";
    try {
      const saved = await api(`/api/brew-recipes/${recipe.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...recipe,
          values: { ...recipe.values, grind: recommendedGrindValue }
        })
      });
      const index = state.brewRecipes.findIndex(item => item.id === recipe.id);
      if (index >= 0) state.brewRecipes[index] = saved;
      onRecipeChanged?.();
      applyRecommendedButton.textContent = "Applied";
      applyRecommendedButton.disabled = true;
      showToast(`Grind ${formatOneDecimal(recommendedGrindValue)} applied to recipe`);
    } catch (error) {
      applyRecommendedButton.textContent = "Apply";
      applyRecommendedButton.disabled = false;
      showToast(error.message);
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

  function handleLogAction(event) {
    const editButton = event.target.closest("[data-edit-log]");
    if (editButton) {
      editMeasurement(editButton.dataset.editLog);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-log]");
    if (deleteButton) deleteLog(deleteButton.dataset.deleteLog);
  }

  document.querySelector(".dial-max-step-control")?.addEventListener("click", event => {
    const button = event.target.closest("[data-dial-number-step]");
    if (button) adjustMaxStep(button);
  });

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
  applyRecommendedButton.addEventListener("click", applyRecommendedGrind);
  editTargetButton.addEventListener("click", editTargetTime);
  tableBody.addEventListener("click", handleLogAction);
  mobileList.addEventListener("click", handleLogAction);
  return { render, selectRecipe, invalidateRecommendation: resetRecommendation };
}
