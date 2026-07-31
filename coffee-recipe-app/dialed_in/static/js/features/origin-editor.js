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

function splitList(value, { preserveEmpty = false } = {}) {
  const items = String(value || "")
    .split(/\s*[;,]\s*/)
    .map(item => item.trim());
  return preserveEmpty ? items : items.filter(Boolean);
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
    .origin-editor-group{grid-column:1/-1;display:grid;gap:12px;margin-top:6px}
    .origin-editor-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .origin-editor-title{display:block;font-size:.78rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted,#7d6d63)}
    .origin-editor-subtitle{display:block;margin-top:3px;font-size:.72rem;color:var(--muted,#7d6d63)}
    .origin-editor-list{display:grid;gap:12px}
    .origin-editor-row{display:grid;grid-template-columns:minmax(155px,1.15fr) minmax(145px,1fr) minmax(175px,.82fr) minmax(155px,.95fr) auto;gap:10px;align-items:end;padding:14px;border:1px solid var(--line,#ddd2c7);border-radius:18px;background:rgba(255,255,255,.58)}
    .origin-editor-field{min-width:0}
    .origin-editor-row label{display:block;margin:0 0 7px;font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted,#7d6d63)}
    .origin-editor-control{box-sizing:border-box;width:100%;height:50px;margin:0;border:1px solid var(--line,#ddd2c7);border-radius:16px;padding:0 14px;color:var(--ink,#2f231d);background:#fff;font:inherit;box-shadow:none;outline:none}
    select.origin-editor-control{appearance:auto}
    .origin-editor-metric-shell{display:flex;align-items:stretch;min-height:50px;border:1px solid var(--line,#ddd2c7);border-radius:16px;background:#fff;overflow:hidden;transition:border-color .16s ease,box-shadow .16s ease}
    .origin-editor-metric-shell:focus-within{border-color:var(--crema-500,#d89a5b);box-shadow:0 0 0 3px rgba(216,154,91,.13)}
    .origin-editor-altitude{flex:1 1 auto;width:auto;height:auto;border:0;padding:0 14px;border-radius:0;background:transparent}
    .origin-editor-altitude:focus{box-shadow:none}
    .origin-editor-altitude::-webkit-inner-spin-button,.origin-editor-altitude::-webkit-outer-spin-button{margin:0;-webkit-appearance:none}
    .origin-editor-altitude{appearance:textfield;-moz-appearance:textfield}
    .origin-editor-number-stepper{width:38px;flex:0 0 38px;display:grid;grid-template-rows:1fr 1fr;border-left:1px solid var(--line,#ddd2c7);background:var(--cream-50,#f8efe4)}
    .origin-editor-number-stepper button{position:relative;min-width:0;border:0;padding:0;color:var(--espresso-700,#5f4335);background:transparent;transition:background .16s ease,color .16s ease}
    .origin-editor-number-stepper button+button{border-top:1px solid var(--line,#ddd2c7)}
    .origin-editor-number-stepper button::before{content:"";position:absolute;left:50%;top:50%;width:7px;height:7px;border-top:2px solid currentColor;border-left:2px solid currentColor}
    .origin-editor-number-stepper button[data-origin-step="up"]::before{transform:translate(-50%,-25%) rotate(45deg)}
    .origin-editor-number-stepper button[data-origin-step="down"]::before{transform:translate(-50%,-75%) rotate(225deg)}
    .origin-editor-number-stepper button:hover,.origin-editor-number-stepper button:focus-visible{color:var(--espresso-950,#2f231d);background:var(--cream-100,#f2e3d1);outline:none}
    .origin-editor-control:focus{border-color:var(--crema-500,#d89a5b);box-shadow:0 0 0 3px rgba(216,154,91,.13)}
    .origin-editor-altitude-wrap{display:grid;grid-template-columns:minmax(0,1fr) 42px;height:50px;border:1px solid var(--line,#ddd2c7);border-radius:16px;overflow:hidden;background:#fff;transition:border-color .18s ease,box-shadow .18s ease}
    .origin-editor-altitude-wrap:focus-within{border-color:var(--crema-500,#d89a5b);box-shadow:0 0 0 3px rgba(216,154,91,.13)}
    .origin-editor-altitude-wrap .origin-editor-altitude{height:48px;border:0;border-radius:0;padding:0 12px;box-shadow:none;background:transparent}
    .origin-editor-altitude-wrap .origin-editor-altitude:focus{box-shadow:none;border:0}
    .origin-editor-altitude::-webkit-inner-spin-button,.origin-editor-altitude::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
    .origin-editor-altitude{-moz-appearance:textfield}
    .origin-editor-stepper{display:grid;grid-template-rows:1fr 1fr;border-left:1px solid var(--line,#ddd2c7)}
    .origin-editor-stepper button{position:relative;border:0;border-radius:0;padding:0;background:transparent;color:var(--espresso-700,#5f4335)}
    .origin-editor-stepper button+button{border-top:1px solid var(--line,#ddd2c7)}
    .origin-editor-stepper button::before{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;border-top:2px solid currentColor;border-left:2px solid currentColor}
    .origin-editor-stepper button[data-origin-altitude-step="up"]::before{transform:translate(-50%,-25%) rotate(45deg)}
    .origin-editor-stepper button[data-origin-altitude-step="down"]::before{transform:translate(-50%,-75%) rotate(225deg)}
    .origin-editor-stepper button:hover,.origin-editor-stepper button:focus-visible{background:rgba(216,154,91,.12);outline:none}
    .origin-editor-country-stack{display:grid;gap:8px}
    .origin-editor-remove{width:38px;height:38px;margin-bottom:6px;border:1px solid var(--line,#ddd2c7);border-radius:50%;background:#fff;color:var(--espresso-700,#5f4335);font-size:1.15rem;line-height:1;box-shadow:none}
    .origin-editor-add{display:inline-flex;align-items:center;gap:8px;justify-content:center;min-height:42px;padding:0 14px;border:1px dashed rgba(95,67,53,.36);border-radius:999px;background:rgba(255,255,255,.58);color:var(--espresso-700,#5f4335);font-weight:700}
    .origin-editor-add span{font-size:1.15rem;line-height:1}
    .origin-editor-hidden-field{display:none !important}
    :root[data-theme="dark"] .origin-editor-row{background:#342219;border-color:rgba(238,208,181,.18)}
    :root[data-theme="dark"] .origin-editor-control{color:var(--ink);background:#2d1c14;border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-altitude-wrap{background:#2d1c14;border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-stepper{border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-stepper button{color:var(--crema-400)}
    :root[data-theme="dark"] .origin-editor-stepper button+button{border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-control::placeholder{color:#a9917f}
    :root[data-theme="dark"] .origin-editor-control:focus{border-color:var(--crema-400);box-shadow:0 0 0 3px rgba(231,183,127,.14)}
    :root[data-theme="dark"] .origin-editor-metric-shell{background:#2d1c14;border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-number-stepper{background:#2d1c14;border-left-color:rgba(238,208,181,.18)}
    :root[data-theme="dark"] .origin-editor-number-stepper button+button{border-top-color:rgba(238,208,181,.18)}
    :root[data-theme="dark"] .origin-editor-number-stepper button:hover,:root[data-theme="dark"] .origin-editor-number-stepper button:focus-visible{color:#f4e8dc;background:#432d22}
    :root[data-theme="dark"] .origin-editor-remove{color:var(--ink);background:#2d1c14;border-color:rgba(238,208,181,.2)}
    :root[data-theme="dark"] .origin-editor-add{color:var(--crema-400);background:#342219;border-color:rgba(231,183,127,.35)}
    @media(max-width:780px) and (min-width:701px){
      .origin-editor-row{grid-template-columns:1fr 1fr;gap:12px}
      .origin-editor-remove{grid-column:2;justify-self:end;margin:0}
    }
    @media(max-width:700px){
      .origin-editor-group{grid-column:auto}
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
  const altitudeInput = findFirst([
    "#beanOriginAltitudeInput",
    "#beanOriginAltitude",
    "#originAltitude",
    "input[name='originAltitude']",
    "input[name='origin_altitude']",
    "#beanOriginLatitudeInput",
    "input[name='originLatitude']",
    "input[name='origin_latitude']"
  ], dialog);

  if (!countryInput || !regionInput || !altitudeInput) return { refresh() {} };

  const countryField = getFieldContainer(countryInput);
  const regionField = getFieldContainer(regionInput);
  const altitudeField = getFieldContainer(altitudeInput);
  countryField?.classList.add("origin-editor-hidden-field");
  regionField?.classList.add("origin-editor-hidden-field");
  altitudeField?.classList.add("origin-editor-hidden-field");

  const wrapper = document.createElement("div");
  wrapper.className = "origin-editor-group full";
  wrapper.innerHTML = `
    <div class="origin-editor-header">
      <div>
        <span class="origin-editor-title">Origins</span>
        <span class="origin-editor-subtitle">Add one or more origin countries with optional regions and altitudes in metres.</span>
      </div>
    </div>
    <div class="origin-editor-list" id="originEditorList"></div>
    <button type="button" class="origin-editor-add" id="originEditorAddButton"><span>+</span> Add another origin</button>
  `;

  (altitudeField || regionField || countryField)?.after(wrapper);

  const list = wrapper.querySelector("#originEditorList");
  const addButton = wrapper.querySelector("#originEditorAddButton");
  let lastExternalValue = "";

  function serialiseRows() {
    const rows = [...list.querySelectorAll(".origin-editor-row")];
    const entries = rows.map(row => {
      const select = row.querySelector("select");
      const custom = row.querySelector(".origin-editor-custom");
      const region = row.querySelector(".origin-editor-region");
      const altitude = row.querySelector(".origin-editor-altitude");
      const component = row.querySelector(".origin-editor-component");
      const country = select.value === "Custom" ? custom.value.trim() : select.value.trim();
      return {
        country: formatCountryMetadata(country, component.value),
        region: region.value.trim(),
        altitude: altitude.value.trim()
      };
    }).filter(entry => entry.country);

    countryInput.value = entries.map(entry => entry.country).join(", ");
    regionInput.value = entries.map(entry => entry.region).join(", ");
    altitudeInput.value = entries.map(entry => entry.altitude).join(", ");
    lastExternalValue = `${countryInput.value}|||${regionInput.value}|||${altitudeInput.value}`;
  }

  function attachRowEvents(row) {
    const select = row.querySelector("select");
    const custom = row.querySelector(".origin-editor-custom");
    const region = row.querySelector(".origin-editor-region");
    const altitude = row.querySelector(".origin-editor-altitude");
    const component = row.querySelector(".origin-editor-component");
    const remove = row.querySelector(".origin-editor-remove");
    const stepButtons = row.querySelectorAll("[data-origin-step]");

    function adjustAltitude(direction) {
      const step = Number(altitude.step) || 100;
      const minimum = altitude.min === "" ? -Infinity : Number(altitude.min);
      const maximum = altitude.max === "" ? Infinity : Number(altitude.max);
      try {
        if (direction === "up") altitude.stepUp();
        else altitude.stepDown();
      } catch (error) {
        const current = altitude.value === "" ? 0 : Number(altitude.value);
        const next = current + (direction === "up" ? step : -step);
        altitude.value = String(Math.min(maximum, Math.max(minimum, next)));
      }
      altitude.dispatchEvent(new Event("input", { bubbles: true }));
      altitude.dispatchEvent(new Event("change", { bubbles: true }));
      altitude.focus({ preventScroll: true });
    }

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
    altitude.addEventListener("input", serialiseRows);
    altitude.addEventListener("change", serialiseRows);
    component.addEventListener("change", serialiseRows);
    stepButtons.forEach(button => button.addEventListener("click", () => adjustAltitude(button.dataset.originStep)));
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
        <label>Altitude (m)</label>
        <div class="origin-editor-metric-shell">
          <input type="number" class="origin-editor-altitude" min="-500" max="10000" step="100" inputmode="numeric" placeholder="e.g. 1800" value="${escapeHtml(entry.altitude || "")}">
          <span class="origin-editor-number-stepper" aria-hidden="true">
            <button type="button" data-origin-step="up" tabindex="-1" aria-label="Increase altitude"></button>
            <button type="button" data-origin-step="down" tabindex="-1" aria-label="Decrease altitude"></button>
          </span>
        </div>
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
    const regions = splitList(regionInput.value, { preserveEmpty: true });
    const altitudes = splitList(altitudeInput.value, { preserveEmpty: true });
    const maxLen = Math.max(countries.length, regions.length, altitudes.length, 1);
    const entries = [];
    for (let index = 0; index < maxLen; index += 1) {
      entries.push({
        country: countries[index] || "",
        region: regions[index] || "",
        altitude: altitudes[index] || ""
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
    const current = `${countryInput.value}|||${regionInput.value}|||${altitudeInput.value}`;
    if (current !== lastExternalValue) rebuildFromHidden();
  }

  addButton.addEventListener("click", () => addRow());
  form.addEventListener("submit", serialiseRows, true);
  dialog.addEventListener("focusin", () => requestAnimationFrame(syncIfNeeded));
  countryInput.addEventListener("change", syncIfNeeded);
  regionInput.addEventListener("change", syncIfNeeded);
  altitudeInput.addEventListener("change", syncIfNeeded);

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
