export function createSettings({ state, api, showToast, reloadState, onChanged }) {
  const dialog = document.querySelector("#settingsDialog");
  const form = document.querySelector("#settingsForm");
  const machine = document.querySelector("#machineInput");
  const grinder = document.querySelector("#grinderSettingsInput");
  const importInput = document.querySelector("#importInput");

  function open() {
    machine.value = state.settings.machine;
    grinder.value = state.settings.grinder;
    dialog.showModal();
  }

  async function save(event) {
    event.preventDefault();
    try {
      state.settings = await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ machine: machine.value.trim(), grinder: grinder.value.trim() })
      });
      onChanged();
      dialog.close();
      showToast("Setup saved");
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
      await reloadState();
      dialog.close();
      showToast(`${result.imported} recipes imported`);
    } catch (error) {
      alert(error.message || "The file could not be imported.");
    } finally {
      importInput.value = "";
    }
  }

  form.addEventListener("submit", save);
  document.querySelectorAll("[data-close-settings]").forEach(button => button.addEventListener("click", () => dialog.close()));
  document.querySelector("#exportButton").addEventListener("click", exportData);
  importInput.addEventListener("change", event => importData(event.target.files?.[0]));

  return { open };
}
