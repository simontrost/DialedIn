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

  const machineBasedMethods = new Set(["espresso", "americano", "flat_white", "cappuccino", "latte"]);

  function visibleMethodFields(method) {
    return (method.fields || []).filter(field => {
      if (field.key === "grind") return true;
      if (!machineBasedMethods.has(method.id)) return true;
      if (field.key === "temperature") return Boolean(state.settings.machineTemperatureControl);
      if (field.key === "pressure") return Boolean(state.settings.machinePressureControl);
      if (field.key === "flowRate") return Boolean(state.settings.machineFlowControl);
      return true;
    });
  }

  function configuredField(field) {
    if (field.key !== "grind") return field;
    return { ...field, min: Number(state.settings.grindMin ?? field.min ?? 0), max: Number(state.settings.grindMax ?? field.max ?? 500) };
  }


  const recipeFieldIcons = {
    dose: "dose",
    beverageYield: "yield",
    targetTime: "time",
    grind: "grind",
    temperature: "temperature",
    pressure: "pressure",
    flowRate: "flow",
    addedWater: "water",
    waterTemperature: "temperature",
    servingOrder: "serving-order",
    milkAmount: "milk",
    milkTemperature: "temperature",
    cupVolume: "cup",
    milkTexture: "foam",
    waterAmount: "water",
    dripperSize: "dripper",
    bloomWater: "bloom",
    bloomTime: "time",
    filterType: "filter",
    agitation: "agitation",
    orientation: "orientation",
    stirTime: "agitation",
    pressTime: "time",
    heatLevel: "heat",
    stopPoint: "stop",
    brewStyle: "brew-style",
    dilution: "ratio"
  };

  function recipeFieldIconUrl(icon) {
    return `/static/icons/recipe-fields/${encodeURIComponent(icon || "settings")}.svg`;
  }

  function recipeFieldIcon(field) {
    if (recipeFieldIcons[field.key]) return recipeFieldIcons[field.key];
    const label = String(field.label || "").toLocaleLowerCase("en");
    if (label.includes("time") || label.includes("steep")) return "time";
    if (label.includes("temperature")) return "temperature";
    if (label.includes("water")) return "water";
    if (label.includes("coffee") || label.includes("dose")) return "dose";
    if (label.includes("yield")) return "yield";
    return "settings";
  }

  function fieldLabelHtml(label, icon, { required = false } = {}) {
    return `<span class="recipe-field-label">
      <span class="app-icon" style="--app-icon:url('${recipeFieldIconUrl(icon)}')" aria-hidden="true"></span>
      <span>${escapeHtml(label)}${required ? " *" : ""}</span>
    </span>`;
  }

  function numberStepperHtml(label) {
    const safeLabel = escapeHtml(label);
    return `<span class="number-stepper">
      <button type="button" data-number-step="up" aria-label="Increase ${safeLabel}"></button>
      <button type="button" data-number-step="down" aria-label="Decrease ${safeLabel}"></button>
    </span>`;
  }

  function adjustNumberInput(button) {
    const input = button.closest(".metric-control")?.querySelector('input[type="number"]');
    if (!input) return;
    try {
      if (button.dataset.numberStep === "up") input.stepUp();
      else input.stepDown();
    } catch (error) {
      const step = Number(input.step) || 1;
      const current = input.value === "" ? (Number(input.min) || 0) : Number(input.value);
      const next = current + (button.dataset.numberStep === "up" ? step : -step);
      const minimum = input.min === "" ? -Infinity : Number(input.min);
      const maximum = input.max === "" ? Infinity : Number(input.max);
      input.value = String(Math.min(maximum, Math.max(minimum, next)));
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus({ preventScroll: true });
  }

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
    const icon = recipeFieldIcon(field);
    const inputId = `recipe-field-${field.key}`;
    if (field.type === "select") {
      return `<label class="field dynamic-field" for="${escapeHtml(inputId)}">
        ${fieldLabelHtml(field.label, icon)}
        <select id="${escapeHtml(inputId)}" data-recipe-field="${escapeHtml(field.key)}">
          ${(field.options || []).map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>${help}
      </label>`;
    }
    return `<div class="metric-input recipe-metric-input dynamic-field">
      <label for="${escapeHtml(inputId)}">${fieldLabelHtml(field.label, icon, { required: field.required })}</label>
      <div class="metric-control">
        <input id="${escapeHtml(inputId)}" data-recipe-field="${escapeHtml(field.key)}" type="number"
          ${field.min !== null && field.min !== undefined ? `min="${field.min}"` : ""}
          ${field.max !== null && field.max !== undefined ? `max="${field.max}"` : ""}
          step="${field.step ?? 1}" value="${value ?? ""}" ${field.required ? "required" : ""}>
        ${field.unit ? `<small class="metric-unit">${escapeHtml(field.unit)}</small>` : ""}
        ${numberStepperHtml(field.label)}
      </div>${help}
    </div>`;
  }

  function renderMethodFields(values = {}) {
    const method = methodById(state, methodInput.value);
    description.innerHTML = `<span class="method-icon-shell" aria-hidden="true">${methodIconMarkup(method)}</span><div><strong>${escapeHtml(method.name)}</strong><p>${escapeHtml(method.description || "")}</p></div>`;
    fieldsContainer.innerHTML = visibleMethodFields(method).map(rawField => {
      const field = configuredField(rawField);
      const value = Object.prototype.hasOwnProperty.call(values, field.key) ? values[field.key] : field.default;
      return fieldHtml(field, value);
    }).join("");
    stepsSection.classList.toggle("hidden", !method.supportsSteps);
    renderSteps();
  }

  function renderSteps() {
    stepList.innerHTML = draftSteps.map((step, index) => {
      const title = step.title || `Step ${index + 1}`;
      const titleId = `recipe-step-${index}-title`;
      const waterId = `recipe-step-${index}-water`;
      const waitId = `recipe-step-${index}-wait`;
      const noteId = `recipe-step-${index}-note`;
      return `<article class="recipe-step-row" data-step-index="${index}">
        <header class="recipe-step-heading">
          <div class="step-heading-copy">
            <span class="step-number">${index + 1}</span>
            <div><small>Recipe step</small><strong class="step-heading-title">${escapeHtml(title)}</strong></div>
          </div>
          <button class="remove-step-button" type="button" data-remove-step="${index}" aria-label="Remove step ${index + 1}">×</button>
        </header>
        <div class="recipe-step-fields">
          <label class="field step-title" for="${titleId}">
            ${fieldLabelHtml("Step name", "step")}
            <input id="${titleId}" data-step-key="title" maxlength="80" value="${escapeHtml(title)}">
          </label>
          <div class="metric-input recipe-metric-input compact-metric step-water">
            <label for="${waterId}">${fieldLabelHtml("Water", "water")}</label>
            <div class="metric-control">
              <input id="${waterId}" data-step-key="waterAmount" type="number" min="0" max="5000" step="1" value="${Number(step.waterAmount || 0)}">
              <small class="metric-unit">g</small>
              ${numberStepperHtml("water")}
            </div>
          </div>
          <div class="metric-input recipe-metric-input compact-metric step-wait">
            <label for="${waitId}">${fieldLabelHtml("Wait after", "time")}</label>
            <div class="metric-control">
              <input id="${waitId}" data-step-key="waitSeconds" type="number" min="0" max="3600" step="1" value="${Number(step.waitSeconds || 0)}">
              <small class="metric-unit">sec</small>
              ${numberStepperHtml("wait time")}
            </div>
          </div>
          <label class="field step-note" for="${noteId}">
            ${fieldLabelHtml("Instruction", "instruction")}
            <input id="${noteId}" data-step-key="note" maxlength="300" value="${escapeHtml(step.note || "")}" placeholder="Pour pattern, agitation, target water level …">
          </label>
        </div>
      </article>`;
    }).join("");
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
  fieldsContainer.addEventListener("click", event => {
    const stepper = event.target.closest("[data-number-step]");
    if (stepper) adjustNumberInput(stepper);
  });
  stepList.addEventListener("input", event => {
    const row = event.target.closest("[data-step-index]");
    const key = event.target.dataset.stepKey;
    if (!row || !key) return;
    const index = Number(row.dataset.stepIndex);
    draftSteps[index][key] = event.target.type === "number" ? Number(event.target.value || 0) : event.target.value;
    if (key === "title") {
      row.querySelector(".step-heading-title").textContent = event.target.value.trim() || `Step ${index + 1}`;
    }
  });
  stepList.addEventListener("click", event => {
    const stepper = event.target.closest("[data-number-step]");
    if (stepper) {
      adjustNumberInput(stepper);
      return;
    }
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
