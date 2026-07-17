(() => {
  "use strict";

  const defaultSettings = {
    machine: "Gaggia Classic Evo Pro E24",
    grinder: "Turin G-Micron DF64P"
  };

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
    Yemen: ["Bani Matar", "Haraz", "Haimah" ]
  });

  const state = {
    recipes: [],
    settings: { ...defaultSettings },
    editingId: null,
    favoritesOnly: false,
    scrapeTimer: null,
    lastScrapedUrl: "",
    scrapeInProgress: false,
    barcodeInProgress: false,
    barcodeScanner: null,
    barcodeScanHandled: false
  };

  const els = {
    grid: document.querySelector("#recipeGrid"),
    empty: document.querySelector("#emptyState"),
    count: document.querySelector("#recipeCount"),
    avgRatio: document.querySelector("#averageRatio"),
    avgTime: document.querySelector("#averageTime"),
    search: document.querySelector("#searchInput"),
    roastFilter: document.querySelector("#roastFilter"),
    statusFilter: document.querySelector("#statusFilter"),
    recipeDialog: document.querySelector("#recipeDialog"),
    recipeForm: document.querySelector("#recipeForm"),
    dialogTitle: document.querySelector("#dialogTitle"),
    deleteButton: document.querySelector("#deleteRecipeButton"),
    settingsDialog: document.querySelector("#settingsDialog"),
    settingsForm: document.querySelector("#settingsForm"),
    toast: document.querySelector("#toast"),
    machineLabel: document.querySelector("#machineLabel"),
    grinderLabel: document.querySelector("#grinderLabel"),
    ratioPreview: document.querySelector("#ratioPreview"),
    importInput: document.querySelector("#importInput"),
    importHelp: document.querySelector("#importHelp"),
    scrapeButton: document.querySelector("#scrapeButton"),
    scrapeStatus: document.querySelector("#scrapeStatus"),
    barcodeImportRow: document.querySelector("#barcodeImportRow"),
    barcodeScanButton: document.querySelector("#barcodeScanButton"),
    barcodeLookupButton: document.querySelector("#barcodeLookupButton"),
    barcodeScanner: document.querySelector("#barcodeScanner"),
    barcodeReader: document.querySelector("#barcodeReader"),
    barcodeStopButton: document.querySelector("#barcodeStopButton"),
    barcodeCancelButton: document.querySelector("#barcodeCancelButton"),
    barcodeScannerStatus: document.querySelector("#barcodeScannerStatus"),
    barcodeStatus: document.querySelector("#barcodeStatus"),
    customBlendFields: document.querySelector("#customBlendFields"),
    arabicaBar: document.querySelector("#arabicaBar"),
    blendSum: document.querySelector("#blendSum"),
    originCountryOptions: document.querySelector("#originCountryOptions"),
    originRegionOptions: document.querySelector("#originRegionOptions")
  };

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
    favorite: document.querySelector("#favoriteInput"),
    machine: document.querySelector("#machineInput"),
    grinder: document.querySelector("#grinderSettingsInput")
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });

    if (!response.ok) {
      let message = "The request failed.";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {}
      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadState() {
    try {
      const payload = await api("/api/state");
      state.recipes = Array.isArray(payload.recipes) ? payload.recipes : [];
      state.settings = { ...defaultSettings, ...(payload.settings || {}) };
      render();
    } catch (error) {
      showToast("Server unavailable");
      console.error(error);
    }
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function normalizeUrl(value = "") {
    let trimmed = value.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed) && /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    try {
      const url = new URL(trimmed);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function formatNumber(value, decimals = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "–";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(number);
  }

  function ratio(recipe) {
    const dose = Number(recipe.dose);
    const output = Number(recipe.yield);
    return dose > 0 && output > 0 ? output / dose : 0;
  }

  function ratingStars(value) {
    const rating = Math.max(0, Math.min(5, Number(value) || 0));
    return `${formatNumber(rating, 1)} ★`;
  }

  function statusLabel(status) {
    return ({ active: "Active", empty: "Out of beans", wishlist: "Wishlist" })[status] || "Active";
  }

  function roastLabel(roast) {
    return ({ light: "light roast", medium: "medium roast", dark: "dark roast" })[roast] || roast;
  }

  function originLabel(recipe) {
    const values = [recipe.originCountry, recipe.originRegion].filter(Boolean);
    return values.length ? values.join(" · ") : "Origin not set";
  }

  function blendLabel(recipe) {
    return recipe.blend || "Composition not set";
  }

  function filteredRecipes() {
    const query = els.search.value.trim().toLocaleLowerCase("en");
    const roast = els.roastFilter.value;
    const status = els.statusFilter.value;

    return [...state.recipes]
      .filter(recipe => {
        const haystack = [
          recipe.name,
          recipe.roaster,
          recipe.originCountry,
          recipe.originRegion,
          recipe.blend,
          recipe.notes
        ].join(" ").toLocaleLowerCase("en");
        return (!query || haystack.includes(query))
          && (roast === "all" || recipe.roast === roast)
          && (status === "all" || recipe.status === status)
          && (!state.favoritesOnly || recipe.favorite);
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function render() {
    const recipes = filteredRecipes();
    els.grid.innerHTML = recipes.map(recipe => {
      const safeUrl = normalizeUrl(recipe.orderUrl);
      return `
        <article class="recipe-card" data-roast="${escapeHtml(recipe.roast)}">
          <div class="card-body">
            <div class="card-top">
              <div>
                <span class="card-status" data-status="${escapeHtml(recipe.status)}">${statusLabel(recipe.status)}</span>
                <h3 class="recipe-title">${escapeHtml(recipe.name)}</h3>
              </div>
              <button class="favorite-button ${recipe.favorite ? "active" : ""}" type="button"
                data-favorite-id="${recipe.id}" aria-label="${recipe.favorite ? "Remove from favorites" : "Add to favorites"}">
                ${recipe.favorite ? "♥" : "♡"}
              </button>
            </div>
            <p class="recipe-meta">${escapeHtml(recipe.roaster || "No roaster")}</p>
            <div class="coffee-tags">
              <span><b>Origin</b>${escapeHtml(originLabel(recipe))}</span>
              <span><b>Beans</b>${escapeHtml(blendLabel(recipe))}</span>
            </div>

            <div class="recipe-metrics">
              <div><strong>${formatNumber(recipe.dose)} g</strong><small>In</small></div>
              <div><strong>${formatNumber(recipe.yield)} g</strong><small>Out</small></div>
              <div><strong>${formatNumber(recipe.time, 0)} s</strong><small>Time</small></div>
            </div>

            <div class="card-secondary">
              <div class="mini-metric"><span>Ratio</span><strong>1:${formatNumber(ratio(recipe), 2)}</strong></div>
              <div class="mini-metric"><span>Grind</span><strong>${escapeHtml(recipe.grind || "–")}</strong></div>
              <div class="mini-metric"><span>Temperature</span><strong>${recipe.temp ? `${formatNumber(recipe.temp)} °C` : "–"}</strong></div>
              <div class="mini-metric"><span>Rating</span><strong>${ratingStars(recipe.rating)}</strong></div>
            </div>

            <p class="notes-preview">${escapeHtml(recipe.notes || "No notes added yet.")}</p>
          </div>
          <div class="card-footer">
            <button class="edit-button" type="button" data-edit-id="${recipe.id}">Edit recipe</button>
            <a class="order-link ${safeUrl ? "" : "disabled"}" href="${safeUrl || "#"}" target="_blank" rel="noopener noreferrer"
              aria-label="${safeUrl ? "Reorder beans" : "No reorder link added"}">Reorder</a>
          </div>
        </article>`;
    }).join("");

    els.empty.classList.toggle("hidden", recipes.length > 0);
    updateStats();
    updateEquipment();
  }

  function updateStats() {
    const active = state.recipes.filter(r => r.status === "active");
    const ratios = active.map(ratio).filter(Boolean);
    const times = active.map(r => Number(r.time)).filter(Number.isFinite);

    els.count.textContent = state.recipes.length;
    els.avgRatio.textContent = ratios.length
      ? `1:${formatNumber(ratios.reduce((a, b) => a + b, 0) / ratios.length, 2)}`
      : "–";
    els.avgTime.textContent = times.length
      ? `${formatNumber(times.reduce((a, b) => a + b, 0) / times.length, 0)} s`
      : "–";
  }

  function updateEquipment() {
    els.machineLabel.textContent = state.settings.machine;
    els.grinderLabel.textContent = state.settings.grinder;
  }

  function ensureSelectOption(select, value) {
    if (!value) return;
    const exists = [...select.options].some(option => option.value === value);
    if (!exists) select.add(new Option(value, value));
  }

  function populateRegionOptions(country = "") {
    const normalizedCountry = country.trim();
    const regions = ORIGIN_REGIONS[normalizedCountry] || [];
    els.originRegionOptions.replaceChildren(
      ...regions.map(region => {
        const option = document.createElement("option");
        option.value = region;
        return option;
      })
    );
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

  function updateBlendUI(changedField = null) {
    const custom = fields.blend.value === "custom";
    els.customBlendFields.classList.toggle("hidden", !custom);
    if (!custom) return;

    let arabica = Math.max(0, Math.min(100, Number(fields.arabica.value) || 0));
    let robusta = Math.max(0, Math.min(100, Number(fields.robusta.value) || 0));
    if (changedField === "arabica") robusta = 100 - arabica;
    if (changedField === "robusta") arabica = 100 - robusta;
    if (changedField === null && arabica + robusta !== 100) robusta = 100 - arabica;

    fields.arabica.value = arabica;
    fields.robusta.value = robusta;
    els.arabicaBar.style.width = `${arabica}%`;
    els.blendSum.textContent = `${arabica}% Arabica · ${robusta}% Robusta`;
  }

  function currentBlendValue() {
    if (fields.blend.value !== "custom") return fields.blend.value;
    const arabica = Math.max(0, Math.min(100, Number(fields.arabica.value) || 0));
    const robusta = 100 - arabica;
    return `${arabica}% Arabica / ${robusta}% Robusta`;
  }

  function metadataIsBlank() {
    return !fields.name.value.trim()
      && !fields.roaster.value.trim()
      && !fields.originCountry.value.trim()
      && !fields.originRegion.value.trim()
      && !fields.blend.value;
  }

  function setScrapeStatus(message = "", type = "") {
    els.scrapeStatus.textContent = message;
    els.scrapeStatus.dataset.type = type;
  }


  function normalizeBarcode(value = "") {
    return String(value).replace(/\D/g, "");
  }

  function setBarcodeStatus(message = "", type = "") {
    els.barcodeStatus.textContent = message;
    els.barcodeStatus.dataset.type = type;
  }

  function supportedBarcodeFormats() {
    const formats = window.Html5QrcodeSupportedFormats;
    if (!formats) return undefined;

    return [
      formats.EAN_13,
      formats.EAN_8,
      formats.UPC_A,
      formats.UPC_E
    ];
  }

  function updateBarcodeAvailability() {
    const newRecipe = !state.editingId;
    const barcode = normalizeBarcode(fields.barcode.value);

    els.barcodeImportRow.classList.toggle("hidden", !newRecipe);
    els.barcodeStatus.classList.toggle("hidden", !newRecipe);
    els.barcodeScanButton.disabled = !newRecipe || state.barcodeInProgress;
    els.barcodeLookupButton.disabled = !newRecipe
      || state.barcodeInProgress
      || !barcode;

    if (!newRecipe) {
      setBarcodeStatus("");
      void stopBarcodeScanner();
    }
  }

  function setBarcodeScannerStatus(message, type = "") {
    els.barcodeScannerStatus.textContent = message;
    els.barcodeScannerStatus.dataset.type = type;
  }

  async function stopBarcodeScanner({ keepMessage = false } = {}) {
    const scanner = state.barcodeScanner;
    state.barcodeScanner = null;
    state.barcodeScanHandled = false;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // The camera may already have stopped after a successful scan.
      }

      try {
        scanner.clear();
      } catch {
        // The reader element may already be empty.
      }
    }

    els.barcodeReader.replaceChildren();
    els.barcodeScanner.classList.add("hidden");
    document.body.classList.remove("scanner-open");

    if (!keepMessage) {
      setBarcodeScannerStatus("Hold the barcode inside the frame.");
    }
  }

  async function lookupBarcode(value = fields.barcode.value) {
    if (state.editingId || state.barcodeInProgress) return;

    const barcode = normalizeBarcode(value);
    if (!barcode) {
      setBarcodeStatus("Scan a barcode or enter its digits first.", "error");
      fields.barcode.focus();
      return;
    }

    const detailsWereBlank = metadataIsBlank();
    fields.barcode.value = barcode;
    state.barcodeInProgress = true;
    els.barcodeLookupButton.textContent = "Looking up…";
    setBarcodeStatus(`Looking up ${barcode}…`, "loading");
    updateBarcodeAvailability();

    try {
      const data = await api("/api/barcode/lookup", {
        method: "POST",
        body: JSON.stringify({ barcode })
      });

      fields.barcode.value = data.barcode || barcode;
      let applied = applyScrapedData(data);

      if (detailsWereBlank && data.roast && fields.roast.value !== data.roast) {
        fields.roast.value = data.roast;
        applied += 1;
      }

      if (applied) {
        setBarcodeStatus(
          `Barcode found. Imported ${applied} field${applied === 1 ? "" : "s"} from Open Food Facts. Please verify the result.`,
          "success"
        );
      } else {
        setBarcodeStatus(
          "The barcode was recognized, but no additional reliable coffee details were available.",
          "info"
        );
      }

      updateScrapeAvailability();
    } catch (error) {
      const notFound = /404|not found|no product/i.test(error.message);
      setBarcodeStatus(
        notFound
          ? `Barcode ${barcode} was recognized, but this product is not in Open Food Facts. Enter the coffee details manually.`
          : `${error.message} You can still enter the coffee manually.`,
        "error"
      );
    } finally {
      state.barcodeInProgress = false;
      els.barcodeLookupButton.textContent = "Look up";
      updateBarcodeAvailability();
    }
  }

  async function handleBarcodeDetected(decodedText) {
    if (state.barcodeScanHandled) return;

    const barcode = normalizeBarcode(decodedText);
    if (!barcode) return;

    state.barcodeScanHandled = true;
    fields.barcode.value = barcode;
    setBarcodeScannerStatus(`Barcode ${barcode} recognized`, "success");

    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    await new Promise(resolve => window.setTimeout(resolve, 350));
    await stopBarcodeScanner({ keepMessage: true });
    setBarcodeStatus(`Barcode ${barcode} recognized. Looking up product…`, "success");
    await lookupBarcode(barcode);
  }

  async function startBarcodeScanner() {
    if (state.editingId || state.barcodeInProgress) return;

    if (!window.Html5Qrcode) {
      setBarcodeStatus(
        "The scanner library could not be loaded. Check the internet connection or enter the barcode manually.",
        "error"
      );
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setBarcodeStatus(
        "Live camera scanning requires HTTPS. Open Dialed In through an HTTPS address or enter the barcode manually.",
        "error"
      );
      return;
    }

    await stopBarcodeScanner();
    state.barcodeScanHandled = false;
    els.barcodeScanner.classList.remove("hidden");
    document.body.classList.add("scanner-open");
    setBarcodeScannerStatus("Hold the barcode inside the frame.", "loading");

    const scanner = new window.Html5Qrcode("barcodeReader", {
      formatsToSupport: supportedBarcodeFormats(),
      verbose: false
    });
    state.barcodeScanner = scanner;

    try {
      await scanner.start(
        { facingMode: { exact: "environment" } },
        {
          fps: 15,
          aspectRatio: 1.777778,
          disableFlip: true,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(
              Math.floor(viewfinderWidth * 0.82),
              520
            );
            const height = Math.min(
              Math.max(105, Math.floor(width * 0.30)),
              Math.floor(viewfinderHeight * 0.32)
            );
            return { width, height };
          }
        },
        decodedText => {
          void handleBarcodeDetected(decodedText);
        },
        () => {
          // Unsuccessful frames are expected while the barcode is aligned.
        }
      );
    } catch (primaryError) {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 12,
            aspectRatio: 1.777778,
            disableFlip: true,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(Math.floor(viewfinderWidth * 0.82), 520);
              return {
                width,
                height: Math.max(105, Math.floor(width * 0.30))
              };
            }
          },
          decodedText => {
            void handleBarcodeDetected(decodedText);
          },
          () => {}
        );
      } catch (fallbackError) {
        await stopBarcodeScanner();
        setBarcodeStatus(
          `The camera could not be started. Check camera permission and HTTPS. (${fallbackError})`,
          "error"
        );
      }
    }
  }

  function updateScrapeAvailability() {
    const newRecipe = !state.editingId;
    els.importHelp.classList.toggle("hidden", !newRecipe);
    els.scrapeButton.classList.toggle("hidden", !newRecipe);

    updateBarcodeAvailability();

    if (!newRecipe) {
      setScrapeStatus("");
      return;
    }

    els.scrapeButton.disabled = state.scrapeInProgress
      || !metadataIsBlank()
      || !normalizeUrl(fields.orderUrl.value);
  }

  function openRecipeDialog(recipe = null) {
    state.editingId = recipe?.id || null;
    state.lastScrapedUrl = "";
    clearTimeout(state.scrapeTimer);
    els.recipeForm.reset();
    els.dialogTitle.textContent = recipe ? "Edit recipe" : "New recipe";
    els.deleteButton.classList.toggle("hidden", !recipe);

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
    fields.grind.value = recipe?.grind || "";
    fields.temp.value = recipe?.temp ?? 93;
    fields.rating.value = recipe?.rating ?? 4;
    fields.orderUrl.value = recipe?.orderUrl || "";
    fields.barcode.value = "";
    fields.notes.value = recipe?.notes || "";
    fields.favorite.checked = Boolean(recipe?.favorite);

    setScrapeStatus("");
    setBarcodeStatus("");
    void stopBarcodeScanner();
    updateRatioPreview();
    updateScrapeAvailability();
    els.recipeDialog.showModal();
    setTimeout(() => (recipe ? fields.name : els.barcodeScanButton).focus(), 80);
  }

  function closeRecipeDialog() {
    if (els.recipeDialog.open) els.recipeDialog.close();
  }

  function openSettings() {
    fields.machine.value = state.settings.machine;
    fields.grinder.value = state.settings.grinder;
    els.settingsDialog.showModal();
  }

  function updateRatioPreview() {
    const dose = Number(fields.dose.value);
    const output = Number(fields.yield.value);
    const value = dose > 0 && output > 0 ? output / dose : 0;
    els.ratioPreview.textContent = value ? `Ratio 1:${formatNumber(value, 2)}` : "Ratio –";
  }

  function formRecipe() {
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

  function applyScrapedData(data) {
    let applied = 0;
    if (!fields.name.value.trim() && data.name) {
      fields.name.value = data.name;
      applied += 1;
    }
    if (!fields.roaster.value.trim() && data.roaster) {
      fields.roaster.value = data.roaster;
      applied += 1;
    }
    if (!fields.originCountry.value.trim() && data.originCountry) {
      fields.originCountry.value = data.originCountry;
      populateRegionOptions(data.originCountry);
      applied += 1;
    }
    if (!fields.originRegion.value.trim() && data.originRegion) {
      fields.originRegion.value = data.originRegion;
      applied += 1;
    }
    if (!fields.blend.value && data.blend) {
      setBlendValue(data.blend);
      applied += 1;
    }
    return applied;
  }

  async function scrapeProductInfo(manual = false) {
    if (state.editingId || state.scrapeInProgress) return;
    const url = normalizeUrl(fields.orderUrl.value);
    if (!url) {
      if (manual) setScrapeStatus("Enter a valid http or https product link.", "error");
      return;
    }
    if (!metadataIsBlank()) {
      if (manual) setScrapeStatus("Automatic import is only available before you enter any coffee details.", "info");
      updateScrapeAvailability();
      return;
    }
    if (!manual && state.lastScrapedUrl === url) return;

    fields.orderUrl.value = url;
    state.scrapeInProgress = true;
    els.scrapeButton.textContent = "Fetching…";
    setScrapeStatus("Reading product information…", "loading");
    updateScrapeAvailability();

    try {
      const data = await api("/api/scrape-product", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      state.lastScrapedUrl = url;
      const applied = applyScrapedData(data);
      if (applied) {
        const sourceNote = data.finalUrl && data.finalUrl !== url ? " after following the shop redirect" : "";
        setScrapeStatus(`Imported ${applied} field${applied === 1 ? "" : "s"}${sourceNote}. Please verify the result.`, "success");
      } else {
        setScrapeStatus("The page loaded, but no reliable coffee details were found. You can enter them manually.", "info");
      }
    } catch (error) {
      setScrapeStatus(`${error.message} You can still fill in the recipe manually.`, "error");
    } finally {
      state.scrapeInProgress = false;
      els.scrapeButton.textContent = "Fetch details";
      updateScrapeAvailability();
    }
  }

  function scheduleAutomaticScrape() {
    clearTimeout(state.scrapeTimer);
    updateScrapeAvailability();
    const url = normalizeUrl(fields.orderUrl.value);
    if (state.editingId || !url || !metadataIsBlank() || state.lastScrapedUrl === url) return;
    state.scrapeTimer = setTimeout(() => scrapeProductInfo(false), 850);
  }

  async function saveRecipe(event) {
    event.preventDefault();
    if (!els.recipeForm.reportValidity()) return;

    const wasEditing = Boolean(state.editingId);
    const editingId = state.editingId;
    const path = wasEditing ? `/api/recipes/${editingId}` : "/api/recipes";
    const method = wasEditing ? "PUT" : "POST";

    try {
      const saved = await api(path, {
        method,
        body: JSON.stringify(formRecipe())
      });

      if (wasEditing) {
        const index = state.recipes.findIndex(item => item.id === editingId);
        if (index >= 0) state.recipes[index] = saved;
      } else {
        state.recipes.unshift(saved);
      }

      render();
      closeRecipeDialog();
      showToast(wasEditing ? "Recipe updated" : "Recipe saved");
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteRecipe() {
    if (!state.editingId) return;
    const id = state.editingId;
    const current = state.recipes.find(item => item.id === id);
    if (!current || !confirm(`Delete “${current.name}”?`)) return;

    try {
      await api(`/api/recipes/${id}`, { method: "DELETE" });
      state.recipes = state.recipes.filter(item => item.id !== id);
      render();
      closeRecipeDialog();
      showToast("Recipe deleted");
    } catch (error) {
      alert(error.message);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      state.settings = await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          machine: fields.machine.value.trim(),
          grinder: fields.grinder.value.trim()
        })
      });
      updateEquipment();
      els.settingsDialog.close();
      showToast("Setup saved");
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
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  function exportData() {
    const link = document.createElement("a");
    link.href = "/api/export";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Exporting backup");
  }

  async function importData(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const result = await api("/api/import", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadState();
      els.settingsDialog.close();
      showToast(`${result.imported} recipes imported`);
    } catch (error) {
      alert(error.message || "The file could not be imported.");
    } finally {
      els.importInput.value = "";
    }
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function setGreeting() {
    const hour = new Date().getHours();
    document.querySelector("#greeting").textContent =
      hour < 11 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  document.querySelectorAll("#addRecipeButton, #mobileAddButton, #emptyAddButton")
    .forEach(button => button.addEventListener("click", () => openRecipeDialog()));

  document.querySelector("#settingsButton").addEventListener("click", openSettings);
  document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", closeRecipeDialog));
  document.querySelectorAll("[data-close-settings]").forEach(button => button.addEventListener("click", () => els.settingsDialog.close()));

  els.recipeForm.addEventListener("submit", saveRecipe);
  els.settingsForm.addEventListener("submit", saveSettings);
  els.deleteButton.addEventListener("click", deleteRecipe);
  els.scrapeButton.addEventListener("click", () => scrapeProductInfo(true));
  els.barcodeScanButton.addEventListener("click", () => {
    void startBarcodeScanner();
  });
  els.barcodeLookupButton.addEventListener("click", () => {
    void lookupBarcode();
  });
  [els.barcodeStopButton, els.barcodeCancelButton].forEach(button => {
    button.addEventListener("click", () => {
      void stopBarcodeScanner();
      setBarcodeStatus("Barcode scan cancelled.", "info");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !els.barcodeScanner.classList.contains("hidden")) {
      event.preventDefault();
      void stopBarcodeScanner();
      setBarcodeStatus("Barcode scan cancelled.", "info");
    }
  });
  fields.barcode.addEventListener("input", () => {
    fields.barcode.value = normalizeBarcode(fields.barcode.value);
    updateBarcodeAvailability();
  });
  fields.barcode.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void lookupBarcode();
  });
  document.querySelector("#exportButton").addEventListener("click", exportData);
  els.importInput.addEventListener("change", event => importData(event.target.files?.[0]));

  [els.search, els.roastFilter, els.statusFilter].forEach(input => input.addEventListener("input", render));
  [fields.dose, fields.yield].forEach(input => input.addEventListener("input", updateRatioPreview));
  [fields.name, fields.roaster, fields.originCountry, fields.originRegion, fields.blend]
    .forEach(input => input.addEventListener("input", updateScrapeAvailability));

  fields.originCountry.addEventListener("input", () => {
    populateRegionOptions(fields.originCountry.value);
    updateScrapeAvailability();
  });
  fields.blend.addEventListener("change", () => {
    updateBlendUI();
    updateScrapeAvailability();
  });
  fields.arabica.addEventListener("input", () => updateBlendUI("arabica"));
  fields.robusta.addEventListener("input", () => updateBlendUI("robusta"));
  fields.orderUrl.addEventListener("input", scheduleAutomaticScrape);
  fields.orderUrl.addEventListener("blur", () => scrapeProductInfo(false));

  els.grid.addEventListener("click", event => {
    const favoriteButton = event.target.closest("[data-favorite-id]");
    const editButton = event.target.closest("[data-edit-id]");
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favoriteId);
    if (editButton) {
      const recipe = state.recipes.find(item => item.id === editButton.dataset.editId);
      if (recipe) openRecipeDialog(recipe);
    }
  });

  document.querySelector(".bottom-nav").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;

    if (action === "home") {
      state.favoritesOnly = false;
      document.querySelectorAll(".bottom-nav [data-action]").forEach(item => item.classList.toggle("active", item === button));
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (action === "favorites") {
      state.favoritesOnly = true;
      document.querySelectorAll(".bottom-nav [data-action]").forEach(item => item.classList.toggle("active", item === button));
      render();
      document.querySelector(".content-section").scrollIntoView({ behavior: "smooth" });
    }
    if (action === "export") exportData();
    if (action === "settings") openSettings();
  });

  // Dialogs now close only through their explicit controls or the Escape key.
  // This avoids accidental closes caused by clicks inside empty form areas.
  els.recipeDialog.addEventListener("close", () => {
    state.editingId = null;
    state.scrapeInProgress = false;
    state.barcodeInProgress = false;
    clearTimeout(state.scrapeTimer);
    void stopBarcodeScanner();
  });

  setGreeting();
  loadState();
})();
