import { normalizeUrl } from "../core/utils.js";
import { createCoffeeImport } from "./coffee-import.js";
import { createBarcodeScanner } from "./barcode-scanner.js";

export function createBeanForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#beanDialog");
  const form = document.querySelector("#beanForm");
  const title = document.querySelector("#beanDialogTitle");
  const deleteButton = document.querySelector("#deleteBeanButton");
  const customBlendFields = document.querySelector("#customBlendFields");
  const arabicaBar = document.querySelector("#arabicaBar");
  const blendSum = document.querySelector("#blendSum");

  const fields = {
    name: document.querySelector("#beanNameInput"),
    roaster: document.querySelector("#beanRoasterInput"),
    originCountry: document.querySelector("#beanOriginCountryInput"),
    originRegion: document.querySelector("#beanOriginRegionInput"),
    blend: document.querySelector("#beanBlendInput"),
    arabica: document.querySelector("#arabicaInput"),
    robusta: document.querySelector("#robustaInput"),
    roast: document.querySelector("#beanRoastInput"),
    status: document.querySelector("#beanStatusInput"),
    orderUrl: document.querySelector("#beanOrderUrlInput"),
    barcode: document.querySelector("#barcodeInput"),
    notes: document.querySelector("#beanNotesInput"),
    favorite: document.querySelector("#beanFavoriteInput")
  };

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

  function payload() {
    return {
      name: fields.name.value.trim(),
      roaster: fields.roaster.value.trim(),
      originCountry: fields.originCountry.value.trim(),
      originRegion: fields.originRegion.value.trim(),
      blend: currentBlendValue(),
      roast: fields.roast.value,
      status: fields.status.value,
      orderUrl: normalizeUrl(fields.orderUrl.value),
      notes: fields.notes.value.trim(),
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
    setBlendValue(bean?.blend || "");
    fields.roast.value = bean?.roast || "medium";
    fields.status.value = bean?.status || "active";
    fields.orderUrl.value = bean?.orderUrl || "";
    fields.barcode.value = "";
    fields.notes.value = bean?.notes || "";
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

  fields.blend.addEventListener("change", () => updateBlendUI());
  fields.arabica.addEventListener("input", () => updateBlendUI("arabica"));
  fields.robusta.addEventListener("input", () => updateBlendUI("robusta"));
  form.addEventListener("submit", save);
  deleteButton.addEventListener("click", remove);
  document.querySelectorAll("[data-close-bean-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));

  return { open, toggleFavorite };
}
