const KNOWN_ORIGIN_OPTIONS = [
  "Brazil",
  "Colombia",
  "Ethiopia",
  "Guatemala",
  "Honduras",
  "Costa Rica",
  "El Salvador",
  "Nicaragua",
  "Panama",
  "Mexico",
  "Peru",
  "Bolivia",
  "Ecuador",
  "Kenya",
  "Uganda",
  "Rwanda",
  "Burundi",
  "Tanzania",
  "DR Congo",
  "Congo",
  "India",
  "Indonesia",
  "Vietnam",
  "Papua New Guinea",
  "China",
  "Taiwan",
  "Thailand",
  "Laos",
  "Myanmar",
  "Philippines",
  "Jamaica",
  "Dominican Republic",
  "Haiti",
  "Cuba",
  "Venezuela",
  "Yemen",
  "Custom"
];

const COMPONENT_OPTIONS = [
  ["", "Not specified"],
  ["Arabica", "Arabica"],
  ["Robusta", "Robusta"],
  ["Liberica", "Liberica"],
  ["Excelsa", "Excelsa"],
  ["Other", "Other / custom"]
];

const FIELD_STYLE_ID = "origin-editor-inline-style";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ");
}

function splitList(value) {
  return String(value || "")
    .split(/\s*[;,]\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseCountryMetadata(value) {
  const match = String(value || "").trim().match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (!match) return { country: String(value || "").trim(), component: "" };
  const component = match[2]
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, "")
    .replace(/[·|/]+$/g, "")
    .trim();
  return { country: match[1].trim(), component };
}

function formatCountryMetadata(country, component) {
  return component ? `${country} [${component}]` : country;
}

function detectOption(country) {
  const normalized = normalizeText(parseCountryMetadata(country).country);
  const aliases = new Map(Object.entries({
    "dr congo": "DR Congo",
    "dr kongo": "DR Congo",
    "d r congo": "DR Congo",
    "d r kongo": "DR Congo",
    "democratic republic of the congo": "DR Congo",
    "democratic republic of congo": "DR Congo",
    "demokratische republik kongo": "DR Congo",
    "dem rep congo": "DR Congo",
    "dem rep kongo": "DR Congo",
    "congo kinshasa": "DR Congo",
    "drc": "DR Congo",
    "rd congo": "DR Congo",
    "rd kongo": "DR Congo",
    "ethiopien": "Ethiopia",
    "brasilien": "Brazil",
    "kolumbien": "Colombia",
    "kenia": "Kenya",
    "uganda": "Uganda",
    "guatemala": "Guatemala",
    "honduras": "Honduras",
    "costa rica": "Costa Rica",
    "panama": "Panama",
    "mexiko": "Mexico",
    "peru": "Peru",
    "bolivien": "Bolivia",
    "ecuador": "Ecuador",
    "ruanda": "Rwanda",
    "burundi": "Burundi",
    "tansania": "Tanzania",
    "indien": "India",
    "indonesien": "Indonesia",
    "vietnam": "Vietnam",
    "papua neuguinea": "Papua New Guinea",
    "dominikanische republik": "Dominican Republic",
    "jamaika": "Jamaica",
    "haiti": "Haiti",
    "kuba": "Cuba",
    "venezuela": "Venezuela",
    "yemen": "Yemen",
    "myanmar": "Myanmar",
    "laos": "Laos",
    "philippinen": "Philippines"
  }));
  const direct = KNOWN_ORIGIN_OPTIONS.find(option => normalizeText(option) === normalized);
  return aliases.get(normalized) || direct || "Custom";
}

function ensureStyles() {
  if (document.getElementById(FIELD_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FIELD_STYLE_ID;
  style.textContent = `
    .origin-editor-group{display:grid;gap:12px;margin-top:6px}
    .origin-editor-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .origin-editor-title{display:block;font-size:.78rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted,#7d6d63)}
    .origin-editor-subtitle{display:block;margin-top:3px;font-size:.72rem;color:var(--muted,#7d6d63)}
    .origin-editor-list{display:grid;gap:12px}
    .origin-editor-row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,.9fr) auto;gap:12px;align-items:end;padding:14px;border:1px solid var(--line,#ddd2c7);border-radius:18px;background:rgba(255,255,255,.58)}
    .origin-editor-field{min-width:0}
    .origin-editor-row label{display:block;margin:0 0 7px;font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted,#7d6d63)}
    .origin-editor-control{box-sizing:border-box;width:100%;height:50px;margin:0;border:1px solid var(--line,#ddd2c7);border-radius:16px;padding:0 14px;color:var(--ink,#2f231d);background:#fff;font:inherit;box-shadow:none;outline:none}
    select.origin-editor-control{appearance:auto}
    .origin-editor-control:focus{border-color:var(--crema-500,#d89a5b);box-shadow:0 0 0 3px rgba(216,154,91,.13)}
    .origin-editor-country-stack{display:grid;gap:8px}
    .origin-editor-remove{width:38px;height:38px;margin-bottom:6px;border:1px solid var(--line,#ddd2c7);border-radius:50%;background:#fff;color:var(--espresso-700,#5f4335);font-size:1.15rem;line-height:1;box-shadow:none}
    .origin-editor-add{display:inline-flex;align-items:center;gap:8px;justify-content:center;min-height:42px;padding:0 14px;border:1px dashed rgba(95,67,53,.36);border-radius:999px;background:rgba(255,255,255,.58);color:var(--espresso-700,#5f4335);font-weight:700}
    .origin-editor-add span{font-size:1.15rem;line-height:1}
    .origin-editor-hidden-field{display:none !important}
    @media(max-width:700px){
      .origin-editor-row{grid-template-columns:1fr;gap:12px;align-items:start}
      .origin-editor-remove{justify-self:end;margin:0}
    }
  `;
  document.head.append(style);
}

function findFirst(selectors, scope = document) {
  for (const selector of selectors) {
    const element = scope.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function getFieldContainer(input) {
  return input?.closest(".form-field, .dialog-field, .field, .input-group, .form-row, label") || input?.parentElement;
}

function createSelect(selectedLabel) {
  const select = document.createElement("select");
  select.className = "origin-editor-control origin-editor-country";
  for (const optionLabel of KNOWN_ORIGIN_OPTIONS) {
    const option = document.createElement("option");
    option.value = optionLabel;
    option.textContent = optionLabel;
    if (optionLabel === selectedLabel) option.selected = true;
    select.append(option);
  }
  return select;
}

export function createOriginEditorEnhancer() {
  ensureStyles();

  const dialog = findFirst(["#beanDialog", "dialog[id*='bean']", "[data-dialog='bean']"]);
  if (!dialog) return { refresh() {} };

  const form = dialog.querySelector("form") || dialog;
  const countryInput = findFirst([
    "#beanOriginCountryInput",
    "#beanOriginCountry",
    "#originCountry",
    "input[name='originCountry']",
    "input[name='origin_country']"
  ], dialog);
  const regionInput = findFirst([
    "#beanOriginRegionInput",
    "#beanOriginRegion",
    "#originRegion",
    "input[name='originRegion']",
    "input[name='origin_region']"
  ], dialog);

  if (!countryInput || !regionInput) return { refresh() {} };

  const countryField = getFieldContainer(countryInput);
  const regionField = getFieldContainer(regionInput);
  countryField?.classList.add("origin-editor-hidden-field");
  regionField?.classList.add("origin-editor-hidden-field");

  const wrapper = document.createElement("div");
  wrapper.className = "origin-editor-group";
  wrapper.innerHTML = `
    <div class="origin-editor-header">
      <div>
        <span class="origin-editor-title">Origins</span>
        <span class="origin-editor-subtitle">Add one or more origin countries and matching regions.</span>
      </div>
    </div>
    <div class="origin-editor-list" id="originEditorList"></div>
    <button type="button" class="origin-editor-add" id="originEditorAddButton"><span>+</span> Add another origin</button>
  `;

  (regionField || countryField)?.after(wrapper);

  const list = wrapper.querySelector("#originEditorList");
  const addButton = wrapper.querySelector("#originEditorAddButton");
  let lastExternalValue = "";

  function serialiseRows() {
    const rows = [...list.querySelectorAll(".origin-editor-row")];
    const entries = rows.map(row => {
      const select = row.querySelector("select");
      const custom = row.querySelector(".origin-editor-custom");
      const region = row.querySelector(".origin-editor-region");
      const component = row.querySelector(".origin-editor-component");
      const country = select.value === "Custom" ? custom.value.trim() : select.value.trim();
      return {
        country: formatCountryMetadata(country, component.value),
        region: region.value.trim()
      };
    }).filter(entry => entry.country || entry.region);

    countryInput.value = entries.map(entry => entry.country).join(", ");
    regionInput.value = entries.map(entry => entry.region).join(", ");
    lastExternalValue = `${countryInput.value}|||${regionInput.value}`;
  }

  function attachRowEvents(row) {
    const select = row.querySelector("select");
    const custom = row.querySelector(".origin-editor-custom");
    const region = row.querySelector(".origin-editor-region");
    const component = row.querySelector(".origin-editor-component");
    const remove = row.querySelector(".origin-editor-remove");

    function toggleCustom() {
      const useCustom = select.value === "Custom";
      custom.hidden = !useCustom;
      custom.toggleAttribute("disabled", !useCustom);
      if (useCustom) custom.focus({ preventScroll: true });
      serialiseRows();
    }

    select.addEventListener("change", toggleCustom);
    custom.addEventListener("input", serialiseRows);
    region.addEventListener("input", serialiseRows);
    component.addEventListener("change", serialiseRows);
    remove.addEventListener("click", () => {
      row.remove();
      if (!list.children.length) addRow();
      updateRemoveButtons();
      serialiseRows();
    });
    toggleCustom();
  }

  function updateRemoveButtons() {
    const rows = [...list.querySelectorAll(".origin-editor-row")];
    rows.forEach((row, index) => {
      const button = row.querySelector(".origin-editor-remove");
      button.hidden = rows.length === 1;
      button.title = `Remove origin ${index + 1}`;
      button.setAttribute("aria-label", `Remove origin ${index + 1}`);
    });
  }

  function addRow(entry = {}) {
    const metadata = parseCountryMetadata(entry.country || "");
    const selectedOption = detectOption(metadata.country);
    const row = document.createElement("div");
    row.className = "origin-editor-row";
    row.innerHTML = `
      <div class="origin-editor-field">
        <label>Origin country</label>
        <div class="origin-editor-country-stack"></div>
      </div>
      <div class="origin-editor-field">
        <label>Region</label>
        <input type="text" class="origin-editor-control origin-editor-region" placeholder="Optional region" value="${escapeHtml(entry.region || "")}">
      </div>
      <div class="origin-editor-field">
        <label>Bean component</label>
        <select class="origin-editor-control origin-editor-component"></select>
      </div>
      <button type="button" class="origin-editor-remove" aria-label="Remove origin">−</button>
    `;

    const stack = row.querySelector(".origin-editor-country-stack");
    const select = createSelect(selectedOption);
    const custom = document.createElement("input");
    custom.type = "text";
    custom.className = "origin-editor-control origin-editor-custom";
    custom.placeholder = "Custom origin country";
    custom.value = selectedOption === "Custom" ? metadata.country : "";
    custom.hidden = selectedOption !== "Custom";
    if (selectedOption !== "Custom") custom.setAttribute("disabled", "disabled");
    stack.append(select, custom);

    const componentSelect = row.querySelector(".origin-editor-component");
    for (const [value, label] of COMPONENT_OPTIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = normalizeText(value) === normalizeText(metadata.component);
      componentSelect.append(option);
    }
    if (metadata.component && !COMPONENT_OPTIONS.some(([value]) => normalizeText(value) === normalizeText(metadata.component))) {
      const option = document.createElement("option");
      option.value = metadata.component;
      option.textContent = metadata.component;
      option.selected = true;
      componentSelect.append(option);
    }

    list.append(row);
    attachRowEvents(row);
    updateRemoveButtons();
    serialiseRows();
  }

  function parseEntries() {
    const countries = splitList(countryInput.value);
    const regions = splitList(regionInput.value);
    const maxLen = Math.max(countries.length, regions.length, 1);
    const entries = [];
    for (let index = 0; index < maxLen; index += 1) {
      entries.push({
        country: countries[index] || "",
        region: regions[index] || ""
      });
    }
    return entries;
  }

  function rebuildFromHidden() {
    list.replaceChildren();
    parseEntries().forEach(entry => addRow(entry));
    updateRemoveButtons();
    serialiseRows();
  }

  function syncIfNeeded() {
    const current = `${countryInput.value}|||${regionInput.value}`;
    if (current !== lastExternalValue) rebuildFromHidden();
  }

  addButton.addEventListener("click", () => addRow());
  form.addEventListener("submit", serialiseRows, true);
  dialog.addEventListener("focusin", () => requestAnimationFrame(syncIfNeeded));
  countryInput.addEventListener("change", syncIfNeeded);
  regionInput.addEventListener("change", syncIfNeeded);

  const observer = new MutationObserver(() => setTimeout(syncIfNeeded, 30));
  observer.observe(dialog, { attributes: true, attributeFilter: ["open", "class", "style", "aria-hidden"] });

  rebuildFromHidden();
  return { refresh: syncIfNeeded };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}
