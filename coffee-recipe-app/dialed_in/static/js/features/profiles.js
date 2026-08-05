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
  if (profile.needsPasswordSetup) return "Password setup required";
  return profile.isDefault ? "Original app data" : "Separate local database";
}

function avatarMarkup(profile, className = "profile-avatar") {
  if (profile?.avatarUrl) {
    return `<span class="${className} has-image" aria-hidden="true"><img src="${escapeHtml(profile.avatarUrl)}" alt=""></span>`;
  }
  return `<span class="${className}" aria-hidden="true">${escapeHtml(initials(profile?.name))}</span>`;
}

function setPreview(element, { profile = null, file = null, fallback = "+" } = {}) {
  if (!element) return;
  if (element.dataset.objectUrl) {
    URL.revokeObjectURL(element.dataset.objectUrl);
    delete element.dataset.objectUrl;
  }
  if (file) {
    const url = URL.createObjectURL(file);
    element.dataset.objectUrl = url;
    element.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
    element.classList.add("has-image");
    return;
  }
  if (profile?.avatarUrl) {
    element.innerHTML = `<img src="${escapeHtml(profile.avatarUrl)}" alt="">`;
    element.classList.add("has-image");
    return;
  }
  element.textContent = profile ? initials(profile.name) : fallback;
  element.classList.remove("has-image");
}

export function createProfiles({ state, api, showToast, loadState, renderAll }) {
  const dialog = document.querySelector("#profileDialog");
  const profileButton = document.querySelector("#profileButton");
  const profileButtonVisual = document.querySelector("#profileButtonVisual");
  const current = document.querySelector("#profileCurrent");
  const list = document.querySelector("#profileList");
  const createForm = document.querySelector("#profileCreateForm");
  const nameInput = document.querySelector("#profileNameInput");
  const passwordInput = document.querySelector("#profilePasswordInput");
  const passwordConfirmationInput = document.querySelector("#profilePasswordConfirmationInput");
  const createAvatar = document.querySelector("#profileCreateAvatar");
  const createPreview = document.querySelector("#profileCreatePreview");
  const logoutButton = document.querySelector("#profileLogoutButton");
  const title = document.querySelector("#profileDialogTitle");
  const eyebrow = document.querySelector("#profileDialogEyebrow");

  const loginPanel = document.querySelector("#profileLoginPanel");
  const loginForm = document.querySelector("#profileLoginForm");
  const loginAvatar = document.querySelector("#profileLoginAvatar");
  const loginTitle = document.querySelector("#profileLoginTitle");
  const loginEyebrow = document.querySelector("#profileLoginEyebrow");
  const loginHint = document.querySelector("#profileLoginHint");
  const loginPasswordLabel = document.querySelector("#profileLoginPasswordLabel");
  const loginPassword = document.querySelector("#profileLoginPassword");
  const loginPasswordConfirmation = document.querySelector("#profileLoginPasswordConfirmation");
  const loginConfirmationField = document.querySelector("#profileLoginConfirmationField");
  const loginSubmit = document.querySelector("#profileLoginSubmit");
  const loginCancel = document.querySelector("#profileLoginCancel");

  const editPanel = document.querySelector("#profileEditPanel");
  const editForm = document.querySelector("#profileEditForm");
  const editCancel = document.querySelector("#profileEditCancel");
  const editName = document.querySelector("#profileEditName");
  const editAvatar = document.querySelector("#profileEditAvatar");
  const editPreview = document.querySelector("#profileEditPreview");
  const editRemoveAvatar = document.querySelector("#profileEditRemoveAvatar");
  const currentPasswordField = document.querySelector("#profileCurrentPasswordField");
  const currentPassword = document.querySelector("#profileCurrentPassword");
  const newPassword = document.querySelector("#profileNewPassword");
  const newPasswordConfirmation = document.querySelector("#profileNewPasswordConfirmation");
  const editHint = document.querySelector("#profileEditHint");
  const editSecurityHint = document.querySelector("#profileEditSecurityHint");

  let required = false;
  let busy = false;
  let selectedLoginProfileId = null;
  let removeAvatar = false;

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
    if (profileButtonVisual) {
      if (state.profile?.avatarUrl) {
        profileButtonVisual.innerHTML = `<img src="${escapeHtml(state.profile.avatarUrl)}" alt="">`;
        profileButtonVisual.classList.add("has-image");
      } else if (state.profile) {
        profileButtonVisual.textContent = initials(state.profile.name);
        profileButtonVisual.classList.remove("has-image");
      } else {
        profileButtonVisual.innerHTML = `<span class="app-icon app-icon--md" style="--app-icon:url('/static/icons/navigation/profile.svg')"></span>`;
        profileButtonVisual.classList.remove("has-image");
      }
    }
  }

  function render() {
    updateProfileButton();
    dialog?.classList.toggle("is-required", required);
    if (title) title.textContent = required ? "Who is brewing?" : "Profiles";
    if (eyebrow) eyebrow.textContent = required ? "Secure profile login" : "Local profiles";

    if (current) {
      current.hidden = !state.profile;
      current.innerHTML = state.profile ? `
        ${avatarMarkup(state.profile)}
        <span class="profile-current-copy">
          <span>Active profile</span>
          <strong>${escapeHtml(state.profile.name)}</strong>
          <small>${escapeHtml(profileSubtitle(state.profile))}</small>
        </span>
        <button class="secondary-button small-button profile-edit-button" type="button" data-edit-profile
          ${busy ? "disabled" : ""}>Edit profile</button>
      ` : "";
    }

    if (list) {
      const availableProfiles = state.profiles.filter(profile => !profile.isActive);
      list.innerHTML = availableProfiles.length ? availableProfiles.map(profile => `
        <article class="profile-row">
          ${avatarMarkup(profile)}
          <span class="profile-row-copy">
            <strong>${escapeHtml(profile.name)}</strong>
            <small>${escapeHtml(profileSubtitle(profile))}</small>
          </span>
          <button class="secondary-button small-button profile-select-button" type="button"
            data-login-profile="${escapeHtml(profile.id)}" ${busy ? "disabled" : ""}>
            ${profile.needsPasswordSetup ? "Set password" : "Log in"}
          </button>
        </article>
      `).join("") : `<p class="profile-list-empty">${state.profile ? "Create another profile to keep coffee collections separate." : "No profiles are available yet. Create the first one below."}</p>`;
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

  function resetLoginPanel() {
    selectedLoginProfileId = null;
    if (loginPassword) loginPassword.value = "";
    if (loginPasswordConfirmation) loginPasswordConfirmation.value = "";
    if (loginPanel) loginPanel.hidden = true;
  }

  function openLogin(profileId) {
    const profile = state.profiles.find(item => item.id === profileId);
    if (!profile) return;
    selectedLoginProfileId = profile.id;
    if (loginAvatar) loginAvatar.innerHTML = avatarMarkup(profile);
    if (loginTitle) loginTitle.textContent = profile.name;
    if (loginPassword) {
      loginPassword.value = "";
      loginPassword.autocomplete = profile.needsPasswordSetup ? "new-password" : "current-password";
    }
    if (loginPasswordConfirmation) loginPasswordConfirmation.value = "";
    if (loginConfirmationField) loginConfirmationField.hidden = !profile.needsPasswordSetup;
    if (loginPasswordConfirmation) loginPasswordConfirmation.required = profile.needsPasswordSetup;
    if (loginEyebrow) loginEyebrow.textContent = profile.needsPasswordSetup ? "One-time setup" : "Profile login";
    if (loginHint) loginHint.textContent = profile.needsPasswordSetup
      ? "This existing profile has no password yet. Create one now to protect future logins."
      : "Enter the password to load this profile and its database.";
    if (loginPasswordLabel) loginPasswordLabel.textContent = profile.needsPasswordSetup ? "Create password" : "Password";
    if (loginSubmit) loginSubmit.textContent = profile.needsPasswordSetup ? "Save & log in" : "Log in";
    if (loginPanel) loginPanel.hidden = false;
    editPanel.hidden = true;
    loginPassword?.focus();
  }

  function resetEditForm() {
    removeAvatar = false;
    if (editAvatar) editAvatar.value = "";
    if (currentPassword) currentPassword.value = "";
    if (newPassword) newPassword.value = "";
    if (newPasswordConfirmation) newPasswordConfirmation.value = "";
  }

  function openEdit() {
    if (!state.profile) return;
    resetLoginPanel();
    resetEditForm();
    if (editName) editName.value = state.profile.name;
    setPreview(editPreview, { profile: state.profile });
    const needsSetup = state.profile.needsPasswordSetup;
    if (currentPasswordField) currentPasswordField.hidden = needsSetup;
    if (currentPassword) currentPassword.required = false;
    if (newPassword) newPassword.required = needsSetup;
    if (newPasswordConfirmation) newPasswordConfirmation.required = needsSetup;
    if (editHint) editHint.textContent = needsSetup
      ? "Your existing data is safe. Set a password now to finish the profile upgrade."
      : "Rename the profile, change its picture or update its password.";
    if (editSecurityHint) editSecurityHint.textContent = needsSetup
      ? "A password with at least 6 characters is required."
      : "To change the password, enter the current password and the new one.";
    if (editCancel) editCancel.hidden = needsSetup && required;
    if (editPanel) editPanel.hidden = false;
    editName?.focus();
  }

  function closeEdit() {
    if (required && state.profile?.needsPasswordSetup) return;
    if (editPanel) editPanel.hidden = true;
    resetEditForm();
  }

  function open({ force = false } = {}) {
    required = force || !state.profile || Boolean(state.profile?.needsPasswordSetup);
    render();
    if (!dialog?.open) dialog?.showModal();
    if (state.profile?.needsPasswordSetup) openEdit();
  }

  function close() {
    if (required) return;
    resetLoginPanel();
    closeEdit();
    dialog?.close();
  }

  async function finishProfileSwitch(message) {
    clearProfileState();
    required = false;
    resetLoginPanel();
    if (editPanel) editPanel.hidden = true;
    await refresh();
    if (!await loadState()) return;
    dialog?.close();
    showToast(message);
  }

  async function login(event) {
    event.preventDefault();
    if (busy || !selectedLoginProfileId) return;
    const profile = state.profiles.find(item => item.id === selectedLoginProfileId);
    if (!profile) return;
    const password = loginPassword?.value || "";
    const confirmation = loginPasswordConfirmation?.value || "";
    busy = true;
    render();
    try {
      const path = profile.needsPasswordSetup
        ? `/api/profiles/${encodeURIComponent(profile.id)}/setup-password`
        : `/api/profiles/${encodeURIComponent(profile.id)}/login`;
      const body = profile.needsPasswordSetup
        ? { password, passwordConfirmation: confirmation }
        : { password };
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await finishProfileSwitch(`Profile ${profile.name} loaded`);
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
    const password = passwordInput?.value || "";
    const confirmation = passwordConfirmationInput?.value || "";
    const formData = new FormData();
    formData.append("name", name);
    formData.append("password", password);
    formData.append("passwordConfirmation", confirmation);
    if (createAvatar?.files?.[0]) formData.append("avatar", createAvatar.files[0]);

    busy = true;
    render();
    try {
      await api("/api/profiles", {
        method: "POST",
        headers: {},
        body: formData
      });
      clearProfileState();
      createForm?.reset();
      setPreview(createPreview, { fallback: "+" });
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

  async function edit(event) {
    event.preventDefault();
    if (busy || !state.profile) return;
    const profileId = state.profile.id;
    const formData = new FormData();
    formData.append("name", editName?.value.trim() || "");
    formData.append("currentPassword", currentPassword?.value || "");
    formData.append("newPassword", newPassword?.value || "");
    formData.append("newPasswordConfirmation", newPasswordConfirmation?.value || "");
    formData.append("removeAvatar", removeAvatar ? "true" : "false");
    if (editAvatar?.files?.[0]) formData.append("avatar", editAvatar.files[0]);

    busy = true;
    render();
    try {
      await api(`/api/profiles/${encodeURIComponent(profileId)}`, {
        method: "PATCH",
        headers: {},
        body: formData
      });
      const wasRequired = state.profile.needsPasswordSetup;
      await refresh();
      required = false;
      if (!await loadState()) return;
      closeEdit();
      render();
      if (wasRequired) dialog?.close();
      showToast("Profile updated");
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
  loginForm?.addEventListener("submit", login);
  editForm?.addEventListener("submit", edit);
  logoutButton?.addEventListener("click", logout);
  loginCancel?.addEventListener("click", resetLoginPanel);
  editCancel?.addEventListener("click", closeEdit);

  current?.addEventListener("click", event => {
    if (event.target.closest("[data-edit-profile]")) openEdit();
  });
  list?.addEventListener("click", event => {
    const button = event.target.closest("[data-login-profile]");
    if (button) openLogin(button.dataset.loginProfile);
  });

  createAvatar?.addEventListener("change", () => {
    setPreview(createPreview, { file: createAvatar.files?.[0] || null, fallback: "+" });
  });
  editAvatar?.addEventListener("change", () => {
    const file = editAvatar.files?.[0] || null;
    if (file) removeAvatar = false;
    setPreview(editPreview, { profile: file ? null : state.profile, file });
  });
  editRemoveAvatar?.addEventListener("click", () => {
    removeAvatar = true;
    if (editAvatar) editAvatar.value = "";
    setPreview(editPreview, { profile: { name: editName?.value || state.profile?.name || "?" } });
  });
  editName?.addEventListener("input", () => {
    if (!editPreview?.classList.contains("has-image")) {
      setPreview(editPreview, { profile: { name: editName.value } });
    }
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
      else if (state.profile?.needsPasswordSetup) open({ force: true });
      return hasProfile && !state.profile?.needsPasswordSetup;
    },
    open
  };
}
