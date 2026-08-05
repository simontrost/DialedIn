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

function setFeedback(element, message = "", type = "error") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function markInvalid(input, invalid = true) {
  if (!input) return;
  if (invalid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function shake(element) {
  if (!element) return;
  element.classList.remove("has-form-error");
  void element.offsetWidth;
  element.classList.add("has-form-error");
}

function friendlyError(error, context = "") {
  const message = String(error?.message || "Something went wrong.");
  if (context === "login" && /incorrect password/i.test(message)) {
    return "That password is incorrect. Please try again.";
  }
  if (/confirmation does not match/i.test(message)) {
    return "The two passwords do not match. Please enter them again.";
  }
  return message;
}

export function createProfiles({ state, api, showToast, loadState, renderAll }) {
  const dialog = document.querySelector("#profileDialog");
  const profileButton = document.querySelector("#profileButton");
  const profileButtonVisual = document.querySelector("#profileButtonVisual");
  const title = document.querySelector("#profileDialogTitle");
  const eyebrow = document.querySelector("#profileDialogEyebrow");
  const intro = document.querySelector("#profileDialogIntro");
  const dialogActions = document.querySelector("#profileDialogActions");

  const accountView = document.querySelector("#profileAccountView");
  const current = document.querySelector("#profileCurrent");
  const editButton = document.querySelector("#profileEditButton");
  const logoutButton = document.querySelector("#profileLogoutButton");

  const chooserView = document.querySelector("#profileChooserView");
  const list = document.querySelector("#profileList");
  const createOpen = document.querySelector("#profileCreateOpen");

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
  const loginFeedback = document.querySelector("#profileLoginFeedback");

  const createPanel = document.querySelector("#profileCreatePanel");
  const createForm = document.querySelector("#profileCreateForm");
  const createCancel = document.querySelector("#profileCreateCancel");
  const nameInput = document.querySelector("#profileNameInput");
  const passwordInput = document.querySelector("#profilePasswordInput");
  const passwordConfirmationInput = document.querySelector("#profilePasswordConfirmationInput");
  const createAvatar = document.querySelector("#profileCreateAvatar");
  const createPreview = document.querySelector("#profileCreatePreview");
  const createFeedback = document.querySelector("#profileCreateFeedback");

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
  const editFeedback = document.querySelector("#profileEditFeedback");

  let required = false;
  let busy = false;
  let view = "chooser";
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
      state.profile ? `Open profile. Current profile: ${state.profile.name}` : "Choose profile"
    );
    if (!profileButtonVisual) return;

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

  function normalizeView() {
    if (state.profile?.needsPasswordSetup) {
      view = "edit";
      required = true;
      return;
    }
    if (state.profile && ["chooser", "login", "create"].includes(view)) view = "account";
    if (!state.profile && ["account", "edit"].includes(view)) view = "chooser";
  }

  function renderHeader() {
    const profile = state.profiles.find(item => item.id === selectedLoginProfileId);
    const copies = {
      account: {
        eyebrow: "Local profile",
        title: "Your profile",
        intro: "Manage the profile that is currently signed in."
      },
      chooser: {
        eyebrow: "Welcome back",
        title: "Choose a profile",
        intro: "Choose who is brewing to load the matching coffee collection."
      },
      login: {
        eyebrow: profile?.needsPasswordSetup ? "One-time setup" : "Secure login",
        title: profile?.needsPasswordSetup ? "Protect this profile" : "Enter your password",
        intro: profile?.needsPasswordSetup
          ? "Create a password before this existing profile can be used."
          : "Your coffee data is loaded only after a successful login."
      },
      create: {
        eyebrow: "New profile",
        title: "Create account",
        intro: "Set up a separate local coffee space with its own protected database."
      },
      edit: {
        eyebrow: "Profile settings",
        title: "Edit profile",
        intro: "Update your name, profile picture or password."
      }
    };
    const copy = copies[view] || copies.chooser;
    if (eyebrow) eyebrow.textContent = copy.eyebrow;
    if (title) title.textContent = copy.title;
    if (intro) intro.textContent = copy.intro;
  }

  function renderAccount() {
    if (!current) return;
    current.innerHTML = state.profile ? `
      ${avatarMarkup(state.profile, "profile-avatar profile-account-avatar")}
      <div class="profile-account-copy">
        <span>Signed in</span>
        <strong>${escapeHtml(state.profile.name)}</strong>
        <small>Your private coffee collection is active.</small>
      </div>
    ` : "";
  }

  function renderChooser() {
    if (!list) return;
    list.innerHTML = state.profiles.length ? state.profiles.map(profile => `
      <button class="profile-tile" type="button" data-login-profile="${escapeHtml(profile.id)}"
        aria-label="${profile.needsPasswordSetup ? "Set a password for" : "Log in to"} ${escapeHtml(profile.name)}"
        ${busy ? "disabled" : ""}>
        ${avatarMarkup(profile, "profile-avatar profile-picker-avatar")}
        <strong>${escapeHtml(profile.name)}</strong>
      </button>
    `).join("") : `
      <div class="profile-list-empty">
        <span aria-hidden="true">☕</span>
        <strong>No profiles yet</strong>
        <small>Create the first account to start a coffee collection.</small>
      </div>
    `;
  }

  function render() {
    updateProfileButton();
    normalizeView();
    renderHeader();
    renderAccount();
    renderChooser();

    dialog?.classList.toggle("is-required", required);
    if (dialog) dialog.dataset.view = view;
    if (accountView) accountView.hidden = view !== "account";
    if (chooserView) chooserView.hidden = view !== "chooser";
    if (loginPanel) loginPanel.hidden = view !== "login";
    if (createPanel) createPanel.hidden = view !== "create";
    if (editPanel) editPanel.hidden = view !== "edit";
    if (dialogActions) dialogActions.hidden = view !== "account";

    if (editButton) editButton.disabled = busy;
    if (logoutButton) logoutButton.disabled = busy;
    if (createOpen) createOpen.disabled = busy;
    if (loginSubmit) loginSubmit.disabled = busy;
    createForm?.querySelectorAll("button, input").forEach(element => {
      element.disabled = busy;
    });
    editForm?.querySelectorAll("button, input").forEach(element => {
      element.disabled = busy;
    });
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
    loginForm?.reset();
    markInvalid(loginPassword, false);
    markInvalid(loginPasswordConfirmation, false);
    setFeedback(loginFeedback);
    loginPanel?.classList.remove("has-form-error");
  }

  function resetCreateForm() {
    createForm?.reset();
    setPreview(createPreview, { fallback: "+" });
    [nameInput, passwordInput, passwordConfirmationInput].forEach(input => markInvalid(input, false));
    setFeedback(createFeedback);
    createPanel?.classList.remove("has-form-error");
  }

  function resetEditForm() {
    removeAvatar = false;
    editForm?.reset();
    [editName, currentPassword, newPassword, newPasswordConfirmation].forEach(input => markInvalid(input, false));
    setFeedback(editFeedback);
    editPanel?.classList.remove("has-form-error");
  }

  function openLogin(profileId) {
    const profile = state.profiles.find(item => item.id === profileId);
    if (!profile) return;
    resetLoginPanel();
    selectedLoginProfileId = profile.id;
    if (loginAvatar) loginAvatar.innerHTML = avatarMarkup(profile, "profile-avatar profile-login-avatar");
    if (loginTitle) loginTitle.textContent = profile.name;
    if (loginPassword) loginPassword.autocomplete = profile.needsPasswordSetup ? "new-password" : "current-password";
    if (loginConfirmationField) loginConfirmationField.hidden = !profile.needsPasswordSetup;
    if (loginPasswordConfirmation) loginPasswordConfirmation.required = profile.needsPasswordSetup;
    if (loginEyebrow) loginEyebrow.textContent = profile.needsPasswordSetup ? "One-time setup" : "Profile login";
    if (loginHint) loginHint.textContent = profile.needsPasswordSetup
      ? "This existing profile has no password yet. Create one now to protect future logins."
      : "Enter the password to load this profile and its coffee data.";
    if (loginPasswordLabel) loginPasswordLabel.textContent = profile.needsPasswordSetup ? "Create password" : "Password";
    if (loginSubmit) loginSubmit.textContent = profile.needsPasswordSetup ? "Save & log in" : "Log in";
    view = "login";
    render();
    requestAnimationFrame(() => loginPassword?.focus());
  }

  function cancelLogin() {
    resetLoginPanel();
    view = "chooser";
    render();
  }

  function openCreate() {
    resetCreateForm();
    view = "create";
    render();
    requestAnimationFrame(() => nameInput?.focus());
  }

  function cancelCreate() {
    resetCreateForm();
    view = "chooser";
    render();
  }

  function openEdit() {
    if (!state.profile) return;
    resetEditForm();
    if (editName) editName.value = state.profile.name;
    setPreview(editPreview, { profile: state.profile });
    const needsSetup = state.profile.needsPasswordSetup;
    if (currentPasswordField) currentPasswordField.hidden = needsSetup;
    if (newPassword) newPassword.required = needsSetup;
    if (newPasswordConfirmation) newPasswordConfirmation.required = needsSetup;
    if (editHint) editHint.textContent = needsSetup
      ? "Your existing data is safe. Set a password now to finish the profile upgrade."
      : "Rename the profile, change its picture or update its password.";
    if (editSecurityHint) editSecurityHint.textContent = needsSetup
      ? "A password with at least 6 characters is required."
      : "To change the password, enter the current password and the new one.";
    if (editCancel) editCancel.hidden = needsSetup && required;
    view = "edit";
    render();
    requestAnimationFrame(() => editName?.focus());
  }

  function closeEdit() {
    if (required && state.profile?.needsPasswordSetup) return;
    resetEditForm();
    view = "account";
    render();
  }

  function open({ force = false } = {}) {
    required = force || !state.profile || Boolean(state.profile?.needsPasswordSetup);
    view = state.profile ? (state.profile.needsPasswordSetup ? "edit" : "account") : "chooser";
    render();
    if (!dialog?.open) dialog?.showModal();
  }

  function close() {
    if (required) return;
    resetLoginPanel();
    resetCreateForm();
    resetEditForm();
    dialog?.close();
  }

  async function finishProfileSwitch(message) {
    clearProfileState();
    required = false;
    view = "account";
    resetLoginPanel();
    await refresh();
    if (!await loadState()) return;
    dialog?.close();
    showToast(message);
  }

  function validateLogin(profile, password, confirmation) {
    markInvalid(loginPassword, false);
    markInvalid(loginPasswordConfirmation, false);
    setFeedback(loginFeedback);

    if (!password) {
      markInvalid(loginPassword);
      setFeedback(loginFeedback, profile.needsPasswordSetup ? "Create a password to continue." : "Enter your password to continue.");
      loginPassword?.focus();
      return false;
    }
    if (profile.needsPasswordSetup && password.length < 6) {
      markInvalid(loginPassword);
      setFeedback(loginFeedback, "The password must contain at least 6 characters.");
      loginPassword?.focus();
      return false;
    }
    if (profile.needsPasswordSetup && password !== confirmation) {
      markInvalid(loginPasswordConfirmation);
      setFeedback(loginFeedback, "The two passwords do not match. Please enter them again.");
      loginPasswordConfirmation?.focus();
      return false;
    }
    return true;
  }

  async function login(event) {
    event.preventDefault();
    if (busy || !selectedLoginProfileId) return;
    const profile = state.profiles.find(item => item.id === selectedLoginProfileId);
    if (!profile) return;
    const password = loginPassword?.value || "";
    const confirmation = loginPasswordConfirmation?.value || "";
    if (!validateLogin(profile, password, confirmation)) {
      shake(loginPanel);
      return;
    }

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
      markInvalid(loginPassword);
      setFeedback(loginFeedback, friendlyError(error, "login"));
      shake(loginPanel);
      requestAnimationFrame(() => {
        loginPassword?.focus();
        loginPassword?.select();
      });
    } finally {
      busy = false;
      render();
    }
  }

  function validateCreate(name, password, confirmation) {
    [nameInput, passwordInput, passwordConfirmationInput].forEach(input => markInvalid(input, false));
    setFeedback(createFeedback);
    if (!name) {
      markInvalid(nameInput);
      setFeedback(createFeedback, "Enter a profile name.");
      nameInput?.focus();
      return false;
    }
    if (password.length < 6) {
      markInvalid(passwordInput);
      setFeedback(createFeedback, "The password must contain at least 6 characters.");
      passwordInput?.focus();
      return false;
    }
    if (password !== confirmation) {
      markInvalid(passwordConfirmationInput);
      setFeedback(createFeedback, "The two passwords do not match. Please enter them again.");
      passwordConfirmationInput?.focus();
      return false;
    }
    return true;
  }

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    const name = nameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirmation = passwordConfirmationInput?.value || "";
    if (!validateCreate(name, password, confirmation)) {
      shake(createPanel);
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("password", password);
    formData.append("passwordConfirmation", confirmation);
    if (createAvatar?.files?.[0]) formData.append("avatar", createAvatar.files[0]);

    busy = true;
    render();
    try {
      await api("/api/profiles", { method: "POST", headers: {}, body: formData });
      clearProfileState();
      resetCreateForm();
      required = false;
      view = "account";
      await refresh();
      if (!await loadState()) return;
      dialog?.close();
      showToast(`Profile ${state.profile?.name || name} created`);
    } catch (error) {
      setFeedback(createFeedback, friendlyError(error, "create"));
      shake(createPanel);
    } finally {
      busy = false;
      render();
    }
  }

  function validateEdit(name, oldPassword, nextPassword, confirmation, needsSetup) {
    [editName, currentPassword, newPassword, newPasswordConfirmation].forEach(input => markInvalid(input, false));
    setFeedback(editFeedback);
    if (!name) {
      markInvalid(editName);
      setFeedback(editFeedback, "Enter a profile name.");
      editName?.focus();
      return false;
    }
    if (needsSetup && nextPassword.length < 6) {
      markInvalid(newPassword);
      setFeedback(editFeedback, "The password must contain at least 6 characters.");
      newPassword?.focus();
      return false;
    }
    if (nextPassword && nextPassword.length < 6) {
      markInvalid(newPassword);
      setFeedback(editFeedback, "The new password must contain at least 6 characters.");
      newPassword?.focus();
      return false;
    }
    if (nextPassword && !needsSetup && !oldPassword) {
      markInvalid(currentPassword);
      setFeedback(editFeedback, "Enter the current password before choosing a new one.");
      currentPassword?.focus();
      return false;
    }
    if (nextPassword !== confirmation) {
      markInvalid(newPasswordConfirmation);
      setFeedback(editFeedback, "The two new passwords do not match. Please enter them again.");
      newPasswordConfirmation?.focus();
      return false;
    }
    return true;
  }

  async function edit(event) {
    event.preventDefault();
    if (busy || !state.profile) return;
    const profileId = state.profile.id;
    const name = editName?.value.trim() || "";
    const oldPassword = currentPassword?.value || "";
    const nextPassword = newPassword?.value || "";
    const confirmation = newPasswordConfirmation?.value || "";
    if (!validateEdit(name, oldPassword, nextPassword, confirmation, state.profile.needsPasswordSetup)) {
      shake(editPanel);
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("currentPassword", oldPassword);
    formData.append("newPassword", nextPassword);
    formData.append("newPasswordConfirmation", confirmation);
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
      resetEditForm();
      view = "account";
      render();
      if (wasRequired) dialog?.close();
      showToast("Profile updated");
    } catch (error) {
      const message = friendlyError(error, "edit");
      if (/current password/i.test(message)) markInvalid(currentPassword);
      setFeedback(editFeedback, message);
      shake(editPanel);
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
      view = "chooser";
      resetEditForm();
      await refresh();
      if (!dialog?.open) dialog?.showModal();
      renderAll();
      showToast("Profile signed out");
    } catch (error) {
      showToast(friendlyError(error));
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

  list?.addEventListener("click", event => {
    const button = event.target.closest("[data-login-profile]");
    if (button) openLogin(button.dataset.loginProfile);
  });
  createOpen?.addEventListener("click", openCreate);
  createCancel?.addEventListener("click", cancelCreate);
  loginCancel?.addEventListener("click", cancelLogin);
  editButton?.addEventListener("click", openEdit);
  editCancel?.addEventListener("click", closeEdit);
  logoutButton?.addEventListener("click", logout);

  createForm?.addEventListener("submit", create);
  loginForm?.addEventListener("submit", login);
  editForm?.addEventListener("submit", edit);

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

  [loginPassword, loginPasswordConfirmation].forEach(input => {
    input?.addEventListener("input", () => {
      markInvalid(input, false);
      setFeedback(loginFeedback);
    });
  });
  [nameInput, passwordInput, passwordConfirmationInput].forEach(input => {
    input?.addEventListener("input", () => {
      markInvalid(input, false);
      setFeedback(createFeedback);
    });
  });
  [editName, currentPassword, newPassword, newPasswordConfirmation].forEach(input => {
    input?.addEventListener("input", () => {
      markInvalid(input, false);
      setFeedback(editFeedback);
    });
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
      if (!hasProfile || state.profile?.needsPasswordSetup) open({ force: true });
      return hasProfile && !state.profile?.needsPasswordSetup;
    },
    open
  };
}
