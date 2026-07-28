const STORAGE_KEY = "dialed-in-theme";
const LIGHT_THEME_COLOR = "#fffaf4";
const DARK_THEME_COLOR = "#17100c";

export function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

export function applyTheme(value, { persist = true } = {}) {
  const theme = normalizeTheme(value);
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.content = theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  }

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.debug("Theme preference could not be stored locally.", error);
    }
  }

  return theme;
}
