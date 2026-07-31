import { escapeHtml, normalizeUrl } from "../core/utils.js";
import { createCoffeeImport } from "./coffee-import.js";
import { createBarcodeScanner } from "./barcode-scanner.js";
import { createFillRatingControl } from "../components/rating-control.js";
import {
  FLAVOR_NOTE_CATEGORIES,
  canonicalFlavorNoteName,
  flavorNoteIconMarkup,
  flavorNotePillMarkup
} from "../data/flavor-notes.js";

export function createBeanForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#beanDialog");
  const form = document.querySelector("#beanForm");
  const title = document.querySelector("#beanDialogTitle");
  const deleteButton = document.querySelector("#deleteBeanButton");
  const customBlendFields = document.querySelector("#customBlendFields");
  const arabicaBar = document.querySelector("#arabicaBar");
  const blendSum = document.querySelector("#blendSum");
  const flavorNoteAddButton = document.querySelector("#flavorNoteAddButton");
  const flavorNotePills = document.querySelector("#flavorNotePills");
  const flavorNotePicker = document.querySelector("#flavorNotePicker");
  const flavorNoteSearchInput = document.querySelector("#flavorNoteSearchInput");
  const flavorNoteOptions = document.querySelector("#flavorNoteOptions");
  const flavorNoteCustomButton = document.querySelector("#flavorNoteCustomButton");
  const strengthInput = document.querySelector("#beanStrengthInput");
  const strengthControlRoot = document.querySelector("#beanStrengthControl");
  const balanceInput = document.querySelector("#beanBalanceInput");
  const balanceControl = document.querySelector("#beanBalanceControl");
  const decafInput = document.querySelector("#beanDecafInput");
  const groundInput = document.querySelector("#beanGroundInput");
  const groundDescription = document.querySelector("#beanGroundDescription");
  const strengthControl = createFillRatingControl({ root: strengthControlRoot, input: strengthInput, itemLabel: "strength" });
  let selectedFlavorNotes = [];

  const fields = {
    name: document.querySelector("#beanNameInput"),
    roaster: document.querySelector("#beanRoasterInput"),
    originCountry: document.querySelector("#beanOriginCountryInput"),
    originRegion: document.querySelector("#beanOriginRegionInput"),
    originAltitude: document.querySelector("#beanOriginAltitudeInput"),
    blend: document.querySelector("#beanBlendInput"),
    scaScore: document.querySelector("#beanScaScoreInput"),
    arabica: document.querySelector("#arabicaInput"),
    robusta: document.querySelector("#robustaInput"),
    roast: document.querySelector("#beanRoastInput"),
    status: document.querySelector("#beanStatusInput"),
    orderUrl: document.querySelector("#beanOrderUrlInput"),
    barcode: document.querySelector("#barcodeInput"),
    notes: document.querySelector("#beanNotesInput"),
    favorite: document.querySelector("#beanFavoriteInput")
  };

  function hasFlavorNote(name) {
    const key = String(name).trim().toLocaleLowerCase();
    return selectedFlavorNotes.some(note => note.toLocaleLowerCase() === key);
  }

  function renderFlavorNotePills() {
    flavorNotePills.innerHTML = selectedFlavorNotes.length
      ? selectedFlavorNotes.map(note => flavorNotePillMarkup(note, { removable: true })).join("")
      : '<span class="flavor-notes-empty">No flavor notes selected yet.</span>';
  }

  function renderFlavorNoteOptions() {
    const query = flavorNoteSearchInput.value.trim().toLocaleLowerCase();
    const groups = FLAVOR_NOTE_CATEGORIES.map(category => {
      const options = category.notes
        .filter(([name]) => !query || name.toLocaleLowerCase().includes(query) || category.name.toLocaleLowerCase().includes(query))
        .map(([name]) => {
          const selected = hasFlavorNote(name);
          return `<button class="flavor-note-option ${selected ? "selected" : ""}" type="button" data-add-flavor-note="${escapeHtml(name)}" ${selected ? "disabled" : ""}>${flavorNoteIconMarkup(name)}<span>${escapeHtml(name)}</span>${selected ? '<small>Added</small>' : ""}</button>`;
        }).join("");
      return options ? `<section><h4>${escapeHtml(category.name)}</h4><div>${options}</div></section>` : "";
    }).join("");

    flavorNoteOptions.innerHTML = groups || '<p class="flavor-note-no-results">No predefined flavor note matches your search.</p>';

    const customName = canonicalFlavorNoteName(flavorNoteSearchInput.value);
    const exactPredefined = FLAVOR_NOTE_CATEGORIES.some(category =>
      category.notes.some(([name]) => name.toLocaleLowerCase() === customName.toLocaleLowerCase())
    );
    const canAddCustom = Boolean(customName) && !exactPredefined && !hasFlavorNote(customName);
    flavorNoteCustomButton.classList.toggle("hidden", !canAddCustom);
    flavorNoteCustomButton.innerHTML = canAddCustom
      ? `${flavorNoteIconMarkup(customName)}<span>Add “${escapeHtml(customName)}” as custom note</span>`
      : "";
  }

  function setFlavorNotePicker(open) {
    flavorNotePicker.classList.toggle("hidden", !open);
    flavorNoteAddButton.setAttribute("aria-expanded", String(open));
    flavorNoteAddButton.classList.toggle("active", open);
    if (open) {
      renderFlavorNoteOptions();
      setTimeout(() => flavorNoteSearchInput.focus(), 20);
    } else {
      flavorNoteSearchInput.value = "";
    }
  }

  function addFlavorNote(value) {
    const name = canonicalFlavorNoteName(value);
    if (!name || hasFlavorNote(name)) return;
    if (selectedFlavorNotes.length >= 20) {
      showToast("A maximum of 20 flavor notes can be added");
      return;
    }
    selectedFlavorNotes.push(name);
    renderFlavorNotePills();
    flavorNoteSearchInput.value = "";
    renderFlavorNoteOptions();
  }

  function removeFlavorNote(value) {
    const key = String(value).trim().toLocaleLowerCase();
    selectedFlavorNotes = selectedFlavorNotes.filter(note => note.toLocaleLowerCase() !== key);
    renderFlavorNotePills();
    renderFlavorNoteOptions();
  }

  function ensureSelectOption(select, value) {
    if (!value || [...select.options].some(option => option.value === value)) return;
    select.add(new Option(value, value));
  }

  function parseBlendPercentages(value = "") {
    const arabica = value.match(/(\d{1,3})\s*%\s*Arabica/i);
    const robusta = value.match(/(\d{1,3})\s*%\s*Robusta/i);
    if (!arabica || !robusta) return null;
    const a = Number(arabica[1]);
    const r = Number(robusta[1]);
    return a + r === 100 ? { arabica: a, robusta: r } : null;
  }

  function updateBlendUI(changedField = null) {
    const custom = fields.blend.value === "custom";
    customBlendFields.classList.toggle("hidden", !custom);
    if (!custom) return;
    let arabica = Math.max(0, Math.min(100, Number(fields.arabica.value) || 0));
    let robusta = Math.max(0, Math.min(100, Number(fields.robusta.value) || 0));
    if (changedField === "arabica") robusta = 100 - arabica;
    if (changedField === "robusta") arabica = 100 - robusta;
    if (changedField === null && arabica + robusta !== 100) robusta = 100 - arabica;
    fields.arabica.value = arabica;
    fields.robusta.value = robusta;
    arabicaBar.style.width = `${arabica}%`;
    blendSum.textContent = `${arabica}% Arabica · ${robusta}% Robusta`;
  }

  function setBlendValue(value = "") {
    if (!value) {
      fields.blend.value = "";
      updateBlendUI();
      return;
    }
    const existing = [...fields.blend.options].some(option => option.value === value);
    if (existing && value !== "custom") {
      fields.blend.value = value;
    } else {
      const percentages = parseBlendPercentages(value);
      if (percentages) {
        fields.blend.value = "custom";
        fields.arabica.value = percentages.arabica;
        fields.robusta.value = percentages.robusta;
      } else {
        ensureSelectOption(fields.blend, value);
        fields.blend.value = value;
      }
    }
    updateBlendUI();
  }

  function currentBlendValue() {
    if (fields.blend.value !== "custom") return fields.blend.value;
    const arabica = Math.max(0, Math.min(100, Number(fields.arabica.value) || 0));
    return `${arabica}% Arabica / ${100 - arabica}% Robusta`;
  }

  function metadataIsBlank() {
    return !fields.name.value.trim()
      && !fields.roaster.value.trim()
      && !fields.originCountry.value.trim()
      && !fields.originRegion.value.trim()
      && !fields.blend.value;
  }

  function applyImportedData(data) {
    let applied = 0;
    if (!fields.name.value.trim() && data.name) { fields.name.value = data.name; applied += 1; }
    if (!fields.roaster.value.trim() && data.roaster) { fields.roaster.value = data.roaster; applied += 1; }
    if (!fields.originCountry.value.trim() && data.originCountry) { fields.originCountry.value = data.originCountry; applied += 1; }
    if (!fields.originRegion.value.trim() && data.originRegion) { fields.originRegion.value = data.originRegion; applied += 1; }
    if (!fields.blend.value && data.blend) { setBlendValue(data.blend); applied += 1; }
    if (data.roast && fields.roast.value !== data.roast) { fields.roast.value = data.roast; applied += 1; }
    return applied;
  }

  let coffeeImport;
  const barcode = createBarcodeScanner({
    state,
    api,
    fields,
    applyImportedData,
    metadataIsBlank,
    onDataApplied: () => coffeeImport?.updateAvailability()
  });
  coffeeImport = createCoffeeImport({
    state,
    api,
    fields,
    applyImportedData,
    metadataIsBlank,
    updateBarcodeAvailability: barcode.updateAvailability
  });

  function setBalanceValue(value = "") {
    balanceInput.value = value || "";
    balanceControl?.querySelectorAll("[data-balance-value]").forEach(button => {
      const active = button.dataset.balanceValue === balanceInput.value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateGroundDescription() {
    groundDescription.textContent = groundInput.checked
      ? "Pre-ground · grind settings and recommendations are disabled."
      : "Whole bean · grind settings and recommendations are available.";
  }

  function payload() {
    return {
      name: fields.name.value.trim(),
      roaster: fields.roaster.value.trim(),
      originCountry: fields.originCountry.value.trim(),
      originRegion: fields.originRegion.value.trim(),
      originAltitude: fields.originAltitude.value.trim(),
      blend: currentBlendValue(),
      scaScore: fields.scaScore.value.trim(),
      roast: fields.roast.value,
      status: fields.status.value,
      orderUrl: normalizeUrl(fields.orderUrl.value),
      notes: fields.notes.value.trim(),
      flavorNotes: [...selectedFlavorNotes],
      strength: strengthInput.value === "" ? 0 : Number(strengthInput.value),
      tasteBalance: balanceInput.value,
      decaf: decafInput.checked,
      isGround: groundInput.checked,
      favorite: fields.favorite.checked
    };
  }

  function open(bean = null) {
    state.editingBeanId = bean?.id || null;
    state.lastScrapedUrl = "";
    clearTimeout(state.scrapeTimer);
    form.reset();
    title.textContent = bean ? "Edit bean" : "New bean";
    deleteButton.classList.toggle("hidden", !bean);
    fields.name.value = bean?.name || "";
    fields.roaster.value = bean?.roaster || "";
    fields.originCountry.value = bean?.originCountry || "";
    fields.originRegion.value = bean?.originRegion || "";
    fields.originAltitude.value = bean?.originAltitude ?? bean?.originLatitude ?? "";
    setBlendValue(bean?.blend || "");
    fields.scaScore.value = bean?.scaScore ?? "";
    fields.roast.value = bean?.roast || "medium";
    fields.status.value = bean?.status || "active";
    strengthControl.setValue(bean?.strength || 0);
    setBalanceValue(bean?.tasteBalance || "");
    decafInput.checked = Boolean(bean?.decaf);
    groundInput.checked = Boolean(bean?.isGround);
    updateGroundDescription();
    fields.orderUrl.value = bean?.orderUrl || "";
    if (fields.scaScore.value === "0") fields.scaScore.value = "";
    fields.barcode.value = "";
    fields.notes.value = bean?.notes || "";
    selectedFlavorNotes = Array.isArray(bean?.flavorNotes) ? [...bean.flavorNotes] : [];
    renderFlavorNotePills();
    setFlavorNotePicker(false);
    fields.favorite.checked = Boolean(bean?.favorite);
    coffeeImport.setStatus("");
    barcode.setStatus("");
    void barcode.stop();
    coffeeImport.resetPanel();
    dialog.showModal();
    setTimeout(() => fields.name.focus(), 80);
  }

  async function save(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const editingId = state.editingBeanId;
    try {
      const saved = await api(editingId ? `/api/beans/${editingId}` : "/api/beans", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload())
      });
      if (editingId) {
        const index = state.beans.findIndex(bean => bean.id === editingId);
        if (index >= 0) state.beans[index] = saved;
      } else {
        state.beans.unshift(saved);
      }
      if (saved.isGround) {
        state.brewRecipes = state.brewRecipes.map(recipe => recipe.beanId === saved.id
          ? { ...recipe, values: Object.fromEntries(Object.entries(recipe.values || {}).filter(([key]) => key !== "grind")) }
          : recipe);
      }
      dialog.close();
      state.editingBeanId = null;
      onChanged();
      showToast(editingId ? "Bean updated" : "Bean added");
    } catch (error) {
      alert(error.message);
    }
  }

  async function remove() {
    const beanId = state.editingBeanId;
    if (!beanId) return;
    const relatedRecipes = state.brewRecipes.filter(recipe => recipe.beanId === beanId).length;
    const warning = relatedRecipes
      ? `Delete this bean and its ${relatedRecipes} recipe${relatedRecipes === 1 ? "" : "s"} plus all related measurements?`
      : "Delete this bean?";
    if (!confirm(warning)) return;
    try {
      await api(`/api/beans/${beanId}`, { method: "DELETE" });
      state.beans = state.beans.filter(bean => bean.id !== beanId);
      const recipeIds = new Set(state.brewRecipes.filter(recipe => recipe.beanId === beanId).map(recipe => recipe.id));
      state.brewRecipes = state.brewRecipes.filter(recipe => recipe.beanId !== beanId);
      state.dialInLogs = state.dialInLogs.filter(log => !recipeIds.has(log.brewRecipeId));
      dialog.close();
      state.editingBeanId = null;
      onChanged();
      showToast("Bean deleted");
    } catch (error) {
      alert(error.message);
    }
  }

  async function toggleFavorite(bean) {
    const saved = await api(`/api/beans/${bean.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...bean, favorite: !bean.favorite })
    });
    const index = state.beans.findIndex(item => item.id === bean.id);
    if (index >= 0) state.beans[index] = saved;
    onChanged();
  }

  flavorNoteAddButton.addEventListener("click", () => {
    setFlavorNotePicker(flavorNotePicker.classList.contains("hidden"));
  });
  groundInput.addEventListener("change", updateGroundDescription);
  flavorNotePills.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-flavor-note]");
    if (button) removeFlavorNote(button.dataset.removeFlavorNote);
  });
  flavorNoteOptions.addEventListener("click", event => {
    const button = event.target.closest("[data-add-flavor-note]");
    if (button) addFlavorNote(button.dataset.addFlavorNote);
  });
  flavorNoteSearchInput.addEventListener("input", renderFlavorNoteOptions);
  flavorNoteSearchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      setFlavorNotePicker(false);
      flavorNoteAddButton.focus();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const customName = flavorNoteSearchInput.value.trim();
    const firstOption = flavorNoteOptions.querySelector("[data-add-flavor-note]:not(:disabled)");
    if (customName && !firstOption) addFlavorNote(customName);
    else if (firstOption) addFlavorNote(firstOption.dataset.addFlavorNote);
  });
  flavorNoteCustomButton.addEventListener("click", () => addFlavorNote(flavorNoteSearchInput.value));

  fields.blend.addEventListener("change", () => updateBlendUI());
  fields.arabica.addEventListener("input", () => updateBlendUI("arabica"));
  fields.robusta.addEventListener("input", () => updateBlendUI("robusta"));
  balanceControl?.addEventListener("click", event => {
    const button = event.target.closest("[data-balance-value]");
    if (!button) return;
    setBalanceValue(button.dataset.balanceValue === balanceInput.value ? "" : button.dataset.balanceValue);
  });
  form.addEventListener("submit", save);
  deleteButton.addEventListener("click", remove);
  document.querySelectorAll("[data-close-bean-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));

  return { open, toggleFavorite };
}
