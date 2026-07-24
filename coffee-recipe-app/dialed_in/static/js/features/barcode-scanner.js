import { normalizeBarcode } from "../core/utils.js";

export function createBarcodeScanner({
  state,
  api,
  fields,
  applyImportedData,
  metadataIsBlank,
  onDataApplied = () => {}
}) {
  const row = document.querySelector("#barcodeImportRow");
  const scanButton = document.querySelector("#barcodeScanButton");
  const lookupButton = document.querySelector("#barcodeLookupButton");
  const scanner = document.querySelector("#barcodeScanner");
  const readerVideo = document.querySelector("#barcodeReader");
  const stopButton = document.querySelector("#barcodeStopButton");
  const cancelButton = document.querySelector("#barcodeCancelButton");
  const scannerStatus = document.querySelector("#barcodeScannerStatus");
  const barcodeStatus = document.querySelector("#barcodeStatus");

  function setStatus(message = "", type = "") {
    barcodeStatus.textContent = message;
    barcodeStatus.dataset.type = type;
  }

  function setScannerStatus(message, type = "") {
    scannerStatus.textContent = message;
    scannerStatus.dataset.type = type;
  }

  function updateAvailability() {
    const newBean = !state.editingBeanId;
    const barcode = normalizeBarcode(fields.barcode.value);
    row.classList.toggle("hidden", !newBean);
    barcodeStatus.classList.toggle("hidden", !newBean);
    scanButton.disabled = !newBean || state.barcodeInProgress;
    lookupButton.disabled = !newBean || state.barcodeInProgress || !barcode;

    if (!newBean) {
      setStatus("");
      void stop();
    }
  }

  async function stop({ keepMessage = false } = {}) {
    const currentScanner = state.barcodeScanner;
    state.barcodeScanner = null;
    state.barcodeScanHandled = false;

    if (currentScanner?.controls) {
      try { currentScanner.controls.stop(); } catch {}
    }

    const stream = readerVideo.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());

    readerVideo.pause();
    readerVideo.srcObject = null;
    readerVideo.removeAttribute("src");
    readerVideo.load();

    if (scanner.open) scanner.close();
    scanner.classList.add("hidden");
    document.body.classList.remove("scanner-open");

    if (!keepMessage) setScannerStatus("Hold the barcode inside the frame.");
  }

  async function lookup(value = fields.barcode.value) {
    if (state.editingBeanId || state.barcodeInProgress) return;
    const barcode = normalizeBarcode(value);
    if (!barcode) {
      setStatus("Scan a barcode or enter its digits first.", "error");
      fields.barcode.focus();
      return;
    }

    const detailsWereBlank = metadataIsBlank();
    fields.barcode.value = barcode;
    state.barcodeInProgress = true;
    lookupButton.textContent = "Looking up…";
    setStatus(`Looking up ${barcode}…`, "loading");
    updateAvailability();

    try {
      const data = await api("/api/barcode/lookup", {
        method: "POST",
        body: JSON.stringify({ barcode })
      });
      fields.barcode.value = data.barcode || barcode;
      let applied = applyImportedData(data);

      if (detailsWereBlank && data.roast && fields.roast.value !== data.roast) {
        fields.roast.value = data.roast;
        applied += 1;
      }

      setStatus(
        applied
          ? `Barcode found. Imported ${applied} field${applied === 1 ? "" : "s"} from Open Food Facts. Please verify the result.`
          : "The barcode was recognized, but no additional reliable coffee details were available.",
        applied ? "success" : "info"
      );
      onDataApplied();
    } catch (error) {
      const notFound = /404|not found|no product/i.test(error.message);
      setStatus(
        notFound
          ? `Barcode ${barcode} was recognized, but this product is not in Open Food Facts. Enter the coffee details manually.`
          : `${error.message} You can still enter the coffee manually.`,
        "error"
      );
    } finally {
      state.barcodeInProgress = false;
      lookupButton.textContent = "Look up";
      updateAvailability();
    }
  }

  async function handleDetected(decodedText) {
    if (state.barcodeScanHandled) return;
    const barcode = normalizeBarcode(decodedText);
    if (!barcode) return;

    state.barcodeScanHandled = true;
    fields.barcode.value = barcode;
    setScannerStatus(`Barcode ${barcode} recognized`, "success");
    if (navigator.vibrate) navigator.vibrate(80);

    await new Promise(resolve => window.setTimeout(resolve, 350));
    await stop({ keepMessage: true });
    setStatus(`Barcode ${barcode} recognized. Looking up product…`, "success");
    await lookup(barcode);
  }

  async function start() {
    if (state.editingBeanId || state.barcodeInProgress) return;
    if (!window.ZXingBrowser) {
      setStatus("The ZXing scanner library could not be loaded. Check the internet connection or enter the barcode manually.", "error");
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("Live camera scanning requires HTTPS. Open Dialed In through an HTTPS address or enter the barcode manually.", "error");
      return;
    }

    await stop();
    state.barcodeScanHandled = false;
    scanner.classList.remove("hidden");
    if (!scanner.open) scanner.showModal();
    document.body.classList.add("scanner-open");
    setScannerStatus("Starting camera…", "loading");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const Reader = window.ZXingBrowser.BrowserMultiFormatOneDReader
      || window.ZXingBrowser.BrowserMultiFormatReader;
    const reader = new Reader(undefined, 150);

    try {
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        },
        readerVideo,
        (result, error) => {
          if (result && !state.barcodeScanHandled) {
            void handleDetected(result.getText());
            return;
          }
          if (error && error.name !== "NotFoundException") {
            console.debug("ZXing scan frame:", error.name || error);
          }
        }
      );
      state.barcodeScanner = { reader, controls };
      setScannerStatus("Fill the frame with the barcode and hold it steady.", "loading");
    } catch (error) {
      console.error("Could not start ZXing barcode camera:", error);
      await stop();
      const message = String(error?.message || error || "Unknown camera error");
      setStatus(`The camera could not be started: ${message}`, "error");
    }
  }

  scanButton.addEventListener("click", () => void start());
  lookupButton.addEventListener("click", () => void lookup());
  [stopButton, cancelButton].forEach(button => button.addEventListener("click", () => {
    void stop();
    setStatus("Barcode scan cancelled.", "info");
  }));
  scanner.addEventListener("cancel", event => {
    event.preventDefault();
    void stop();
    setStatus("Barcode scan cancelled.", "info");
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !scanner.classList.contains("hidden")) {
      event.preventDefault();
      void stop();
      setStatus("Barcode scan cancelled.", "info");
    }
  });
  fields.barcode.addEventListener("input", () => {
    fields.barcode.value = normalizeBarcode(fields.barcode.value);
    updateAvailability();
  });
  fields.barcode.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void lookup();
  });

  return { setStatus, updateAvailability, stop, lookup, start };
}
