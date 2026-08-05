import { applyTheme } from "../core/theme.js";
import { clearProfileState } from "../core/state.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map(part => part[0]).join("");
}

function profileSubtitle(profile) {
  return profile.isDefault ? "Original app data" : "Separate local database";
}

export function createProfiles({ state, api, showToast, loadState, renderAll }) {
  const dialog = document.querySelector("#profileDialog");
  const profileButton = document.querySelector("#profileButton");
  const current = document.querySelector("#profileCurrent");
  const list = document.querySelector("#profileList");
  const createForm = document.querySelector("#profileCreateForm");
  const nameInput = document.querySelector("#profileNameInput");
  const logoutButton = document.querySelector("#profileLogoutButton");
  const title = document.querySelector("#profileDialogTitle");
  const eyebrow = document.querySelector("#profileDialogEyebrow");
  let required = false;
  let busy = false;

  function updateProfileButton() {
    profileButton?.classList.toggle("has-profile", Boolean(state.profile));
    profileButton?.setAttribute(
      "title",
      state.profile ? `Profile: ${state.profile.name}` : "Choose profile"
    );
    profileButton?.setAttribute(
      "aria-label",
      state.profile ? `Open profiles. Current profile: ${state.profile.name}` : "Choose profile"
    );
  }

  function render() {
    updateProfileButton();
    dialog?.classList.toggle("is-required", required);
    if (title) title.textContent = required ? "Who is brewing?" : "Profiles";
    if (eyebrow) eyebrow.textContent = required ? "Choose a profile" : "Local profiles";

    if (current) {
      current.hidden = !state.profile;
      current.innerHTML = state.profile ? `
        <span class="profile-avatar" aria-hidden="true">${escapeHtml(initials(state.profile.name))}</span>
        <span class="profile-current-copy">
          <span>Active profile</span>
          <strong>${escapeHtml(state.profile.name)}</strong>
          <small>${escapeHtml(profileSubtitle(state.profile))}</small>
        </span>
      ` : "";
    }

    if (list) {
      const availableProfiles = state.profiles.filter(profile => !profile.isActive);
      list.innerHTML = availableProfiles.length ? availableProfiles.map(profile => `
        <article class="profile-row">
          <span class="profile-avatar" aria-hidden="true">${escapeHtml(initials(profile.name))}</span>
          <span class="profile-row-copy">
            <strong>${escapeHtml(profile.name)}</strong>
            <small>${escapeHtml(profileSubtitle(profile))}</small>
          </span>
          <button class="secondary-button small-button profile-select-button" type="button"
            data-activate-profile="${escapeHtml(profile.id)}" ${busy ? "disabled" : ""}>Use profile</button>
        </article>
      `).join("") : `<p class="profile-list-empty">${state.profile ? "Create another profile to switch between coffee collections." : "Create a profile or choose one below."}</p>`;
    }

    if (logoutButton) logoutButton.disabled = !state.profile || busy;
  }

  async function refresh() {
    const payload = await api("/api/profiles");
    state.profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
    state.profile = payload.activeProfile || null;
    render();
    return Boolean(state.profile);
  }

  function open({ force = false } = {}) {
    required = force || !state.profile;
    render();
    if (!dialog?.open) dialog?.showModal();
  }

  function close() {
    if (required) return;
    dialog?.close();
  }

  async function activate(profileId) {
    if (busy) return;
    busy = true;
    render();
    try {
      await api(`/api/profiles/${encodeURIComponent(profileId)}/activate`, { method: "POST" });
      clearProfileState();
      required = false;
      await refresh();
      if (!await loadState()) return;
      dialog?.close();
      showToast(`Profile ${state.profile?.name || "selected"} loaded`);
    } catch (error) {
      alert(error.message);
    } finally {
      busy = false;
      render();
    }
  }

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    const name = nameInput?.value.trim() || "";
    busy = true;
    render();
    try {
      await api("/api/profiles", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      clearProfileState();
      if (nameInput) nameInput.value = "";
      required = false;
      await refresh();
      if (!await loadState()) return;
      dialog?.close();
      showToast(`Profile ${state.profile?.name || name} created`);
    } catch (error) {
      alert(error.message);
    } finally {
      busy = false;
      render();
    }
  }

  async function logout() {
    if (busy || !state.profile) return;
    busy = true;
    render();
    try {
      await api("/api/profiles/logout", { method: "POST" });
      clearProfileState();
      applyTheme("light");
      required = true;
      await refresh();
      open({ force: true });
      renderAll();
      showToast("Profile signed out");
    } catch (error) {
      alert(error.message);
    } finally {
      busy = false;
      render();
    }
  }

  profileButton?.addEventListener("click", async () => {
    try {
      await refresh();
      open();
    } catch (error) {
      showToast("Profiles unavailable");
      console.error(error);
    }
  });
  createForm?.addEventListener("submit", create);
  logoutButton?.addEventListener("click", logout);
  list?.addEventListener("click", event => {
    const button = event.target.closest("[data-activate-profile]");
    if (button) void activate(button.dataset.activateProfile);
  });
  document.querySelectorAll("[data-close-profile]").forEach(button => {
    button.addEventListener("click", close);
  });
  dialog?.addEventListener("cancel", event => {
    if (required) event.preventDefault();
  });

  return {
    async initialize() {
      const hasProfile = await refresh();
      if (!hasProfile) open({ force: true });
      return hasProfile;
    },
    open
  };
}
