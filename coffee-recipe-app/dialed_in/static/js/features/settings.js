import { applyTheme, normalizeTheme } from "../core/theme.js";

export function createSettings({ state, api, showToast, reloadState, onChanged }) {
  const dialog = document.querySelector("#settingsDialog");
  const form = document.querySelector("#settingsForm");
  const machine = document.querySelector("#machineInput");
  const grinder = document.querySelector("#grinderSettingsInput");
  const darkMode = document.querySelector("#darkModeInput");
  const grindMin = document.querySelector("#grindMinInput");
  const grindMax = document.querySelector("#grindMaxInput");
  const machineTemperatureControl = document.querySelector("#machineTemperatureControlInput");
  const machinePressureControl = document.querySelector("#machinePressureControlInput");
  const machineFlowControl = document.querySelector("#machineFlowControlInput");
  const importInput = document.querySelector("#importInput");

  let themeBeforePreview = null;

  function selectedTheme() {
    return darkMode?.checked ? "dark" : "light";
  }

  function open() {
    machine.value = state.settings.machine;
    grinder.value = state.settings.grinder;
    grindMin.value = state.settings.grindMin ?? 1;
    grindMax.value = state.settings.grindMax ?? 50;
    machineTemperatureControl.checked = Boolean(state.settings.machineTemperatureControl);
    machinePressureControl.checked = Boolean(state.settings.machinePressureControl);
    machineFlowControl.checked = Boolean(state.settings.machineFlowControl);
    themeBeforePreview = normalizeTheme(state.settings.theme);
    if (darkMode) darkMode.checked = themeBeforePreview === "dark";
    applyTheme(themeBeforePreview);
    dialog.showModal();
  }

  function cancel() {
    if (themeBeforePreview) applyTheme(themeBeforePreview);
    themeBeforePreview = null;
    dialog.close();
  }

  async function save(event) {
    event.preventDefault();
    try {
      state.settings = await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          machine: machine.value.trim(),
          grinder: grinder.value.trim(),
          grindMin: Number(grindMin.value),
          grindMax: Number(grindMax.value),
          machineTemperatureControl: machineTemperatureControl.checked,
          machinePressureControl: machinePressureControl.checked,
          machineFlowControl: machineFlowControl.checked,
          theme: selectedTheme()
        })
      });
      applyTheme(state.settings.theme);
      themeBeforePreview = null;
      onChanged();
      dialog.close();
      showToast("Settings saved");
    } catch (error) {
      alert(error.message);
    }
  }

  function exportData() {
    const link = document.createElement("a");
    link.href = "/api/export";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Exporting complete backup");
  }

  async function importData(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const result = await api("/api/import", { method: "POST", body: JSON.stringify(payload) });
      themeBeforePreview = null;
      await reloadState();
      dialog.close();
      showToast(`${result.beans || 0} beans, ${result.recipes || 0} recipes and ${result.measurements || 0} measurements imported`);
    } catch (error) {
      alert(error.message || "The file could not be imported.");
    } finally {
      importInput.value = "";
    }
  }

  darkMode?.addEventListener("change", () => applyTheme(selectedTheme()));
  form.addEventListener("submit", save);
  document.querySelectorAll("[data-close-settings]").forEach(button => button.addEventListener("click", cancel));
  dialog.addEventListener("close", () => {
    if (themeBeforePreview) applyTheme(themeBeforePreview);
    themeBeforePreview = null;
  });
  document.querySelector("#exportButton")?.addEventListener("click", exportData);
  importInput?.addEventListener("change", event => importData(event.target.files?.[0]));
  return { open };
}
