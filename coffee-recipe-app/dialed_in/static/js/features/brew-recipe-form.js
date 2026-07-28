import { beanById, escapeHtml, methodById, methodIconMarkup } from "../core/utils.js";

export function createBrewRecipeForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#brewRecipeDialog");
  const form = document.querySelector("#brewRecipeForm");
  const title = document.querySelector("#brewRecipeDialogTitle");
  const beanInput = document.querySelector("#brewRecipeBeanInput");
  const methodInput = document.querySelector("#brewRecipeMethodInput");
  const methodPicker = document.querySelector("#brewRecipeMethodPicker");
  const methodTrigger = document.querySelector("#brewRecipeMethodTrigger");
  const methodMenu = document.querySelector("#brewRecipeMethodMenu");
  const methodIcon = document.querySelector("#brewRecipeMethodIcon");
  const methodLabel = document.querySelector("#brewRecipeMethodLabel");
  const nameInput = document.querySelector("#brewRecipeNameInput");
  const description = document.querySelector("#methodDescription");
  const fieldsContainer = document.querySelector("#dynamicRecipeFields");
  const notesInput = document.querySelector("#brewRecipeNotesInput");
  const favoriteInput = document.querySelector("#brewRecipeFavoriteInput");
  const deleteButton = document.querySelector("#deleteBrewRecipeButton");
  const stepsSection = document.querySelector("#recipeStepsSection");
  const stepList = document.querySelector("#recipeStepList");
  const addStepButton = document.querySelector("#addRecipeStepButton");

  let draftSteps = [];

  function methodIconUrl(method) {
    const icon = method?.icon || method?.id || "custom-method";
    return `/static/icons/methods/${encodeURIComponent(icon)}.svg`;
  }

  function closeMethodMenu() {
    methodPicker.classList.remove("is-open");
    methodMenu.classList.add("hidden");
    methodTrigger.setAttribute("aria-expanded", "false");
  }

  function syncMethodPicker() {
    const selected = methodById(state, methodInput.value);
    methodMenu.innerHTML = state.brewingMethods.map(method => {
      const active = method.id === methodInput.value;
      return `<button class="method-select-option" type="button" role="option" aria-selected="${active}" data-method-value="${escapeHtml(method.id)}">
        <span class="app-icon" style="--app-icon:url('${methodIconUrl(method)}')" aria-hidden="true"></span>
        <span>${escapeHtml(method.name)}</span>
        <span class="method-select-check" aria-hidden="true">✓</span>
      </button>`;
    }).join("");
    if (selected) {
      methodLabel.textContent = selected.name;
      methodIcon.style.setProperty("--app-icon", `url('${methodIconUrl(selected)}')`);
    }
  }

  function applyMethodSelection(methodId, { resetFields = true } = {}) {
    if (![...methodInput.options].some(option => option.value === methodId)) return;
    methodInput.value = methodId;
    syncMethodPicker();
    if (!resetFields) return;
    const method = methodById(state, methodId);
    draftSteps = method.defaultSteps?.map(step => ({ ...step })) || [];
    if (!state.editingBrewRecipeId) nameInput.value = defaultRecipeName(method.id);
    renderMethodFields({});
  }

  function fillSelects({ beanId = beanInput.value, methodId = methodInput.value } = {}) {
    beanInput.innerHTML = state.beans.length
      ? state.beans.map(bean => `<option value="${bean.id}">${escapeHtml(bean.name)}${bean.roaster ? ` · ${escapeHtml(bean.roaster)}` : ""}</option>`).join("")
      : '<option value="">Add a bean first</option>';
    methodInput.innerHTML = state.brewingMethods
      .map(method => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.name)}</option>`)
      .join("");

    if ([...beanInput.options].some(option => option.value === beanId)) beanInput.value = beanId;
    if ([...methodInput.options].some(option => option.value === methodId)) methodInput.value = methodId;
    syncMethodPicker();
  }

  function fieldHtml(field, value) {
    const help = field.help ? `<small class="field-help">${escapeHtml(field.help)}</small>` : "";
    if (field.type === "select") {
      return `<label class="field dynamic-field">
        <span>${escapeHtml(field.label)}</span>
        <select data-recipe-field="${escapeHtml(field.key)}">
          ${(field.options || []).map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>${help}
      </label>`;
    }
    return `<label class="metric-input dynamic-field">
      <span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>
      <div>
        <input data-recipe-field="${escapeHtml(field.key)}" type="number"
          ${field.min !== null && field.min !== undefined ? `min="${field.min}"` : ""}
          ${field.max !== null && field.max !== undefined ? `max="${field.max}"` : ""}
          step="${field.step ?? 1}" value="${value ?? ""}" ${field.required ? "required" : ""}>
        ${field.unit ? `<small>${escapeHtml(field.unit)}</small>` : ""}
      </div>${help}
    </label>`;
  }

  function renderMethodFields(values = {}) {
    const method = methodById(state, methodInput.value);
    description.innerHTML = `<span class="method-icon-shell" aria-hidden="true">${methodIconMarkup(method)}</span><div><strong>${escapeHtml(method.name)}</strong><p>${escapeHtml(method.description || "")}</p></div>`;
    fieldsContainer.innerHTML = (method.fields || []).map(field => {
      const value = Object.prototype.hasOwnProperty.call(values, field.key) ? values[field.key] : field.default;
      return fieldHtml(field, value);
    }).join("");
    stepsSection.classList.toggle("hidden", !method.supportsSteps);
    renderSteps();
  }

  function renderSteps() {
    stepList.innerHTML = draftSteps.map((step, index) => `
      <article class="recipe-step-row" data-step-index="${index}">
        <span class="step-number">${index + 1}</span>
        <label class="field"><span>Step name</span><input data-step-key="title" maxlength="80" value="${escapeHtml(step.title || `Step ${index + 1}`)}"></label>
        <label class="metric-input compact-metric"><span>Water</span><div><input data-step-key="waterAmount" type="number" min="0" max="5000" step="1" value="${Number(step.waterAmount || 0)}"><small>g</small></div></label>
        <label class="metric-input compact-metric"><span>Wait after</span><div><input data-step-key="waitSeconds" type="number" min="0" max="3600" step="1" value="${Number(step.waitSeconds || 0)}"><small>sec</small></div></label>
        <label class="field step-note"><span>Instruction</span><input data-step-key="note" maxlength="300" value="${escapeHtml(step.note || "")}" placeholder="Pour pattern, agitation, target water level …"></label>
        <button class="remove-step-button" type="button" data-remove-step="${index}" aria-label="Remove step">×</button>
      </article>`).join("");
  }

  function defaultRecipeName(methodId) {
    const method = methodById(state, methodId);
    const bean = beanById(state, beanInput.value);
    return bean ? `${method.name} · ${bean.name}` : method.name;
  }

  function open(recipe = null, defaults = {}) {
    if (!state.beans.length) {
      showToast("Add a bean before creating a recipe");
      return false;
    }
    state.editingBrewRecipeId = recipe?.id || null;
    fillSelects({
      beanId: recipe?.beanId || defaults.beanId || state.beans[0]?.id || "",
      methodId: recipe?.method || defaults.method || "espresso"
    });
    title.textContent = recipe ? "Edit recipe" : "New recipe";
    nameInput.value = recipe?.name || defaultRecipeName(methodInput.value);
    notesInput.value = recipe?.notes || "";
    favoriteInput.checked = Boolean(recipe?.favorite);
    deleteButton.classList.toggle("hidden", !recipe);
    draftSteps = recipe?.steps?.map(step => ({ ...step })) || methodById(state, methodInput.value).defaultSteps?.map(step => ({ ...step })) || [];
    renderMethodFields(recipe?.values || {});
    dialog.showModal();
    if (defaults.focusField) {
      requestAnimationFrame(() => {
        const field = fieldsContainer.querySelector(`[data-recipe-field="${CSS.escape(defaults.focusField)}"]`);
        if (!field) return;
        field.focus();
        if (typeof field.select === "function") field.select();
      });
    }
    return true;
  }

  function valuesPayload() {
    const values = {};
    fieldsContainer.querySelectorAll("[data-recipe-field]").forEach(input => {
      values[input.dataset.recipeField] = input.type === "number"
        ? (input.value === "" ? null : Number(input.value))
        : input.value;
    });
    return values;
  }

  async function save(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const payload = {
      beanId: beanInput.value,
      method: methodInput.value,
      name: nameInput.value.trim(),
      values: valuesPayload(),
      steps: draftSteps,
      notes: notesInput.value.trim(),
      favorite: favoriteInput.checked
    };
    try {
      const editingId = state.editingBrewRecipeId;
      const saved = await api(editingId ? `/api/brew-recipes/${editingId}` : "/api/brew-recipes", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      const index = state.brewRecipes.findIndex(item => item.id === saved.id);
      if (index >= 0) state.brewRecipes[index] = saved;
      else state.brewRecipes.unshift(saved);
      state.editingBrewRecipeId = null;
      dialog.close();
      onChanged();
      showToast(editingId ? "Recipe updated" : "Recipe created");
    } catch (error) {
      alert(error.message);
    }
  }

  async function remove() {
    const recipeId = state.editingBrewRecipeId;
    if (!recipeId || !confirm("Delete this recipe and all of its dial-in measurements?")) return;
    try {
      await api(`/api/brew-recipes/${recipeId}`, { method: "DELETE" });
      state.brewRecipes = state.brewRecipes.filter(recipe => recipe.id !== recipeId);
      state.dialInLogs = state.dialInLogs.filter(log => log.brewRecipeId !== recipeId);
      state.editingBrewRecipeId = null;
      dialog.close();
      onChanged();
      showToast("Recipe deleted");
    } catch (error) {
      alert(error.message);
    }
  }

  async function toggleFavorite(recipeId) {
    const recipe = state.brewRecipes.find(item => item.id === recipeId);
    if (!recipe) return;
    try {
      const saved = await api(`/api/brew-recipes/${recipe.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...recipe, favorite: !recipe.favorite })
      });
      state.brewRecipes[state.brewRecipes.findIndex(item => item.id === recipeId)] = saved;
      onChanged();
    } catch (error) {
      showToast(error.message);
    }
  }

  methodTrigger.addEventListener("click", () => {
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
  methodMenu.addEventListener("click", event => {
    const option = event.target.closest("[data-method-value]");
    if (!option) return;
    closeMethodMenu();
    applyMethodSelection(option.dataset.methodValue);
  });
  document.addEventListener("click", event => {
    if (!methodPicker.contains(event.target)) closeMethodMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMethodMenu();
  });
  beanInput.addEventListener("change", () => {
    if (!state.editingBrewRecipeId) nameInput.value = defaultRecipeName(methodInput.value);
  });
  stepList.addEventListener("input", event => {
    const row = event.target.closest("[data-step-index]");
    const key = event.target.dataset.stepKey;
    if (!row || !key) return;
    const index = Number(row.dataset.stepIndex);
    draftSteps[index][key] = event.target.type === "number" ? Number(event.target.value || 0) : event.target.value;
  });
  stepList.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-step]");
    if (!button) return;
    draftSteps.splice(Number(button.dataset.removeStep), 1);
    renderSteps();
  });
  addStepButton.addEventListener("click", () => {
    draftSteps.push({ title: `Step ${draftSteps.length + 1}`, waterAmount: 0, waitSeconds: 0, note: "" });
    renderSteps();
  });
  form.addEventListener("submit", save);
  deleteButton.addEventListener("click", remove);
  document.querySelectorAll("[data-close-brew-recipe-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));

  return { open, toggleFavorite, syncOptions: fillSelects };
}
