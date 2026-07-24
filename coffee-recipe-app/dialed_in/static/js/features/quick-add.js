export function createQuickAdd({ onAddBean, onAddRecipe, onAddMeasurement }) {
  const dialog = document.querySelector("#quickAddDialog");
  function open() { dialog.showModal(); }
  function close() { if (dialog.open) dialog.close(); }
  document.querySelectorAll("[data-close-quick-add]").forEach(button => button.addEventListener("click", close));
  dialog.querySelector("[data-quick-add='bean']")?.addEventListener("click", () => { close(); onAddBean(); });
  dialog.querySelector("[data-quick-add='recipe']")?.addEventListener("click", () => { close(); onAddRecipe(); });
  dialog.querySelector("[data-quick-add='measurement']")?.addEventListener("click", () => { close(); onAddMeasurement(); });
  return { open };
}
