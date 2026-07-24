import { createBarcodeScanner } from "./barcode-scanner.js";
import { createCoffeeImport } from "./coffee-import.js";
import { formatNumber, normalizeUrl } from "../core/utils.js";

const ORIGIN_REGIONS = Object.freeze({
  Brazil: ["Cerrado Mineiro", "Espírito Santo", "Mogiana", "Minas Gerais", "Sul de Minas"],
  Burundi: ["Kayanza", "Kirundo", "Ngozi"],
  Colombia: ["Antioquia", "Cauca", "Huila", "Nariño", "Sierra Nevada", "Tolima"],
  "Costa Rica": ["Brunca", "Central Valley", "Tarrazú", "West Valley"],
  "El Salvador": ["Alotepec-Metapán", "Apaneca-Ilamatepec", "Bálsamo-Quezaltepec"],
  Ethiopia: ["Guji", "Harrar", "Limu", "Sidama", "Yirgacheffe"],
  Guatemala: ["Acatenango", "Antigua", "Atitlán", "Cobán", "Huehuetenango"],
  Honduras: ["Agalta", "Copán", "El Paraíso", "Montecillos", "Opalaca"],
  India: ["Baba Budangiri", "Chikmagalur", "Coorg", "Kerala"],
  Indonesia: ["Bali", "Flores", "Java", "Sulawesi", "Sumatra"],
  Jamaica: ["Blue Mountains"],
  Kenya: ["Embu", "Kirinyaga", "Kiambu", "Murang'a", "Nyeri"],
  Mexico: ["Chiapas", "Oaxaca", "Veracruz"],
  Nicaragua: ["Jinotega", "Matagalpa", "Nueva Segovia"],
  Panama: ["Boquete", "Volcán"],
  "Papua New Guinea": ["Eastern Highlands", "Western Highlands"],
  Peru: ["Cajamarca", "Cusco", "Junín", "San Martín"],
  Rwanda: ["Gakenke", "Huye", "Kivu", "Nyamasheke"],
  Tanzania: ["Arusha", "Kilimanjaro", "Mbeya"],
  Uganda: ["Bugisu", "Rwenzori"],
  Vietnam: ["Central Highlands", "Da Lat"],
  Yemen: ["Bani Matar", "Haraz", "Haimah"]
});

export function createRecipeForm({ state, api, showToast, onChanged }) {
  const dialog = document.querySelector("#recipeDialog");
  const form = document.querySelector("#recipeForm");
  const dialogTitle = document.querySelector("#dialogTitle");
  const deleteButton = document.querySelector("#deleteRecipeButton");
  const ratioPreview = document.querySelector("#ratioPreview");
  const customBlendFields = document.querySelector("#customBlendFields");
  const arabicaBar = document.querySelector("#arabicaBar");
  const blendSum = document.querySelector("#blendSum");
  const originRegionOptions = document.querySelector("#originRegionOptions");
  const barcodeScanButton = document.querySelector("#barcodeScanButton");

  const fields = {
    name: document.querySelector("#nameInput"),
    roaster: document.querySelector("#roasterInput"),
    originCountry: document.querySelector("#originCountryInput"),
    originRegion: document.querySelector("#originRegionInput"),
    blend: document.querySelector("#blendInput"),
    arabica: document.querySelector("#arabicaInput"),
    robusta: document.querySelector("#robustaInput"),
    roast: document.querySelector("#roastInput"),
    status: document.querySelector("#statusInput"),
    dose: document.querySelector("#doseInput"),
    yield: document.querySelector("#yieldInput"),
    time: document.querySelector("#timeInput"),
    grind: document.querySelector("#grindInput"),
    temp: document.querySelector("#tempInput"),
    rating: document.querySelector("#ratingInput"),
    orderUrl: document.querySelector("#orderUrlInput"),
    barcode: document.querySelector("#barcodeInput"),
    notes: document.querySelector("#notesInput"),
    favorite: document.querySelector("#favoriteInput")
  };

  function ensureSelectOption(select, value) {
    if (!value) return;
    const exists = [...select.options].some(option => option.value === value);
    if (!exists) select.add(new Option(value, value));
  }

  function populateRegionOptions(country = "") {
    const regions = ORIGIN_REGIONS[country.trim()] || [];
    originRegionOptions.replaceChildren(...regions.map(region => {
      const option = document.createElement("option");
      option.value = region;
      return option;
    }));
    fields.originRegion.placeholder = regions.length
      ? "Select a suggestion or type any region"
      : "Type any region";
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
    if (!fields.originCountry.value.trim() && data.originCountry) {
      fields.originCountry.value = data.originCountry;
      populateRegionOptions(data.originCountry);
      applied += 1;
    }
    if (!fields.originRegion.value.trim() && data.originRegion) { fields.originRegion.value = data.originRegion; applied += 1; }
    if (!fields.blend.value && data.blend) { setBlendValue(data.blend); applied += 1; }
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

  function updateRatioPreview() {
    const dose = Number(fields.dose.value);
    const output = Number(fields.yield.value);
    const value = dose > 0 && output > 0 ? output / dose : 0;
    ratioPreview.textContent = value ? `Ratio 1:${formatNumber(value, 2)}` : "Ratio –";
  }

  function recipePayload() {
    return {
      name: fields.name.value.trim(),
      roaster: fields.roaster.value.trim(),
      originCountry: fields.originCountry.value.trim(),
      originRegion: fields.originRegion.value.trim(),
      blend: currentBlendValue(),
      roast: fields.roast.value,
      status: fields.status.value,
      dose: Number(fields.dose.value),
      yield: Number(fields.yield.value),
      time: Number(fields.time.value),
      grind: fields.grind.value === "" ? null : Number(fields.grind.value),
      temp: fields.temp.value ? Number(fields.temp.value) : null,
      rating: fields.rating.value ? Number(fields.rating.value) : 0,
      orderUrl: normalizeUrl(fields.orderUrl.value),
      notes: fields.notes.value.trim(),
      favorite: fields.favorite.checked
    };
  }

  function open(recipe = null) {
    state.editingId = recipe?.id || null;
    state.lastScrapedUrl = "";
    clearTimeout(state.scrapeTimer);
    form.reset();
    dialogTitle.textContent = recipe ? "Edit recipe" : "New recipe";
    deleteButton.classList.toggle("hidden", !recipe);

    fields.name.value = recipe?.name || "";
    fields.roaster.value = recipe?.roaster || "";
    fields.originCountry.value = recipe?.originCountry || "";
    fields.originRegion.value = recipe?.originRegion || "";
    populateRegionOptions(fields.originCountry.value);
    setBlendValue(recipe?.blend || "");
    fields.roast.value = recipe?.roast || "medium";
    fields.status.value = recipe?.status || "active";
    fields.dose.value = recipe?.dose ?? 18;
    fields.yield.value = recipe?.yield ?? 36;
    fields.time.value = recipe?.time ?? 28;
    fields.grind.value = recipe?.grind ?? "";
    fields.temp.value = recipe?.temp ?? 93;
    fields.rating.value = recipe?.rating ?? 4;
    fields.orderUrl.value = recipe?.orderUrl || "";
    fields.barcode.value = "";
    fields.notes.value = recipe?.notes || "";
    fields.favorite.checked = Boolean(recipe?.favorite);

    coffeeImport.setStatus("");
    barcode.setStatus("");
    void barcode.stop();
    updateRatioPreview();
    coffeeImport.updateAvailability();
    dialog.showModal();
    setTimeout(() => (recipe ? fields.name : barcodeScanButton).focus(), 80);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  async function save(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const wasEditing = Boolean(state.editingId);
    const editingId = state.editingId;
    const path = wasEditing ? `/api/recipes/${editingId}` : "/api/recipes";
    const method = wasEditing ? "PUT" : "POST";

    try {
      const saved = await api(path, { method, body: JSON.stringify(recipePayload()) });
      if (wasEditing) {
        const index = state.recipes.findIndex(item => item.id === editingId);
        if (index >= 0) state.recipes[index] = saved;
      } else {
        state.recipes.unshift(saved);
      }
      onChanged();
      close();
      showToast(wasEditing ? "Recipe updated" : "Recipe saved");
    } catch (error) {
      alert(error.message);
    }
  }

  async function remove() {
    if (!state.editingId) return;
    const id = state.editingId;
    const current = state.recipes.find(item => item.id === id);
    if (!current || !confirm(`Delete “${current.name}”?`)) return;

    try {
      await api(`/api/recipes/${id}`, { method: "DELETE" });
      state.recipes = state.recipes.filter(item => item.id !== id);
      onChanged();
      close();
      showToast("Recipe deleted");
    } catch (error) {
      alert(error.message);
    }
  }

  async function toggleFavorite(id) {
    const recipe = state.recipes.find(item => item.id === id);
    if (!recipe) return;
    try {
      const saved = await api(`/api/recipes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...recipe, favorite: !recipe.favorite })
      });
      const index = state.recipes.findIndex(item => item.id === id);
      state.recipes[index] = saved;
      onChanged();
    } catch (error) {
      showToast(error.message);
    }
  }

  form.addEventListener("submit", save);
  deleteButton.addEventListener("click", remove);
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", close));
  [fields.dose, fields.yield].forEach(input => input.addEventListener("input", updateRatioPreview));
  [fields.name, fields.roaster, fields.originCountry, fields.originRegion, fields.blend]
    .forEach(input => input.addEventListener("input", coffeeImport.updateAvailability));
  fields.originCountry.addEventListener("input", () => {
    populateRegionOptions(fields.originCountry.value);
    coffeeImport.updateAvailability();
  });
  fields.blend.addEventListener("change", () => {
    updateBlendUI();
    coffeeImport.updateAvailability();
  });
  fields.arabica.addEventListener("input", () => updateBlendUI("arabica"));
  fields.robusta.addEventListener("input", () => updateBlendUI("robusta"));

  dialog.addEventListener("close", () => {
    state.editingId = null;
    state.scrapeInProgress = false;
    state.barcodeInProgress = false;
    clearTimeout(state.scrapeTimer);
    void barcode.stop();
  });

  return { open, close, toggleFavorite };
}
