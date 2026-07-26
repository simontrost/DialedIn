const validPages = new Set(["overview", "beans", "recipes", "dial-in", "origins"]);

export function createNavigation({ onPageChange, onOpenSettings }) {
  const pageButtons = [...document.querySelectorAll("[data-page-link]")];
  const settingsButtons = [...document.querySelectorAll("#settingsButton, [data-open-settings]")];

  function showPage(page, { updateHash = true } = {}) {
    const nextPage = validPages.has(page) ? page : "overview";
    document.querySelectorAll("[data-page]").forEach(section => {
      section.classList.toggle("hidden", section.dataset.page !== nextPage);
    });
    pageButtons.forEach(button => {
      button.classList.toggle("active", button.dataset.pageLink === nextPage);
    });
    if (updateHash) history.replaceState(null, "", `#${nextPage}`);
    onPageChange(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  pageButtons.forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      showPage(button.dataset.pageLink);
    });
  });
  settingsButtons.forEach(button => button.addEventListener("click", onOpenSettings));
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1), { updateHash: false }));

  return { showPage };
}
