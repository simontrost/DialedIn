import { normalizeUrl } from "../core/utils.js";

export function createCoffeeImport({
  state,
  api,
  fields,
  applyImportedData,
  metadataIsBlank,
  updateBarcodeAvailability
}) {
  const importHelp = document.querySelector("#importHelp");
  const scrapeButton = document.querySelector("#scrapeButton");
  const scrapeStatus = document.querySelector("#scrapeStatus");

  function setStatus(message = "", type = "") {
    scrapeStatus.textContent = message;
    scrapeStatus.dataset.type = type;
  }

  function updateAvailability() {
    const newRecipe = !state.editingId;
    importHelp.classList.toggle("hidden", !newRecipe);
    scrapeButton.classList.toggle("hidden", !newRecipe);
    updateBarcodeAvailability();

    if (!newRecipe) {
      setStatus("");
      return;
    }

    scrapeButton.disabled = state.scrapeInProgress
      || !metadataIsBlank()
      || !normalizeUrl(fields.orderUrl.value);
  }

  async function scrapeProductInfo(manual = false) {
    if (state.editingId || state.scrapeInProgress) return;
    const url = normalizeUrl(fields.orderUrl.value);
    if (!url) {
      if (manual) setStatus("Enter a valid http or https product link.", "error");
      return;
    }
    if (!metadataIsBlank()) {
      if (manual) setStatus("Automatic import is only available before you enter any coffee details.", "info");
      updateAvailability();
      return;
    }
    if (!manual && state.lastScrapedUrl === url) return;

    fields.orderUrl.value = url;
    state.scrapeInProgress = true;
    scrapeButton.textContent = "Fetching…";
    setStatus("Reading product information…", "loading");
    updateAvailability();

    try {
      const data = await api("/api/scrape-product", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      state.lastScrapedUrl = url;
      const applied = applyImportedData(data);
      if (applied) {
        const sourceNote = data.finalUrl && data.finalUrl !== url ? " after following the shop redirect" : "";
        setStatus(`Imported ${applied} field${applied === 1 ? "" : "s"}${sourceNote}. Please verify the result.`, "success");
      } else {
        setStatus("The page loaded, but no reliable coffee details were found. You can enter them manually.", "info");
      }
    } catch (error) {
      setStatus(`${error.message} You can still fill in the recipe manually.`, "error");
    } finally {
      state.scrapeInProgress = false;
      scrapeButton.textContent = "Fetch details";
      updateAvailability();
    }
  }

  function scheduleAutomaticScrape() {
    clearTimeout(state.scrapeTimer);
    updateAvailability();
    const url = normalizeUrl(fields.orderUrl.value);
    if (state.editingId || !url || !metadataIsBlank() || state.lastScrapedUrl === url) return;
    state.scrapeTimer = setTimeout(() => scrapeProductInfo(false), 850);
  }

  scrapeButton.addEventListener("click", () => scrapeProductInfo(true));
  fields.orderUrl.addEventListener("input", scheduleAutomaticScrape);
  fields.orderUrl.addEventListener("blur", () => scrapeProductInfo(false));

  return { setStatus, updateAvailability, scrapeProductInfo };
}
