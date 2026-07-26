const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 1000;
const HEIGHT = 520;

const COUNTRY_ALIASES = new Map(Object.entries({
  "äthiopien": "ethiopia", "aethiopien": "ethiopia", "ethiopia": "ethiopia",
  "brasilien": "brazil", "brasil": "brazil", "brazil": "brazil",
  "kolumbien": "colombia", "columbia": "colombia", "colombia": "colombia",
  "kenia": "kenya", "kenya": "kenya",
  "indonesien": "indonesia", "indonesia": "indonesia",
  "indien": "india", "india": "india",
  "vietnam": "vietnam",
  "guatemala": "guatemala",
  "honduras": "honduras",
  "costa rica": "costa rica",
  "panama": "panama",
  "mexiko": "mexico", "mexico": "mexico",
  "peru": "peru", "perú": "peru",
  "bolivien": "bolivia", "bolivia": "bolivia",
  "ecuador": "ecuador",
  "ruanda": "rwanda", "rwanda": "rwanda",
  "burundi": "burundi",
  "tansania": "tanzania", "tanzania": "tanzania",
  "uganda": "uganda",
  "kongo": "dem. rep. congo", "dr kongo": "dem. rep. congo",
  "demokratische republik kongo": "dem. rep. congo",
  "democratic republic of the congo": "dem. rep. congo",
  "drc": "dem. rep. congo", "dem. rep. congo": "dem. rep. congo",
  "papua-neuguinea": "papua new guinea", "papua new guinea": "papua new guinea",
  "el salvador": "el salvador",
  "nicaragua": "nicaragua",
  "jamaika": "jamaica", "jamaica": "jamaica",
  "haiti": "haiti",
  "dominikanische republik": "dominican rep.", "dominican republic": "dominican rep.",
  "china": "china", "taiwan": "taiwan",
  "thailand": "thailand", "laos": "laos", "myanmar": "myanmar",
  "philippinen": "philippines", "philippines": "philippines",
  "venezuela": "venezuela", "kuba": "cuba", "cuba": "cuba"
}));

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

function countryKey(value) {
  const normalized = normalizeText(value);
  return COUNTRY_ALIASES.get(normalized) || normalized;
}

function statusKey(value) {
  return normalizeText(value).replace(/\s+/g, "-");
}

function project([lon, lat]) {
  return [
    ((lon + 180) / 360) * WIDTH,
    ((90 - lat) / 180) * HEIGHT
  ];
}

function ringPath(ring) {
  return ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join("") + "Z";
}

function geometryPath(geometry) {
  if (!geometry) return "";
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringPath).join("");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap(polygon => polygon.map(ringPath)).join("");
  }
  return "";
}

function geometryPoints(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function centroid(geometry) {
  const points = geometryPoints(geometry);
  if (!points.length) return [0, 0];

  // Longitude averaging needs special handling for countries crossing the dateline.
  const shifted = points.map(([lon, lat]) => [lon < -100 ? lon + 360 : lon, lat]);
  const minLon = Math.min(...shifted.map(point => point[0]));
  const maxLon = Math.max(...shifted.map(point => point[0]));
  const useShifted = maxLon - minLon < 180;
  const source = useShifted ? shifted : points;
  let lon = source.reduce((sum, point) => sum + point[0], 0) / source.length;
  const lat = source.reduce((sum, point) => sum + point[1], 0) / source.length;
  if (lon > 180) lon -= 360;
  return [lon, lat];
}

function displayStatus(status) {
  const key = statusKey(status);
  if (key === "out-of-beans") return "Out of beans";
  if (key === "wishlist") return "Wishlist";
  return "Active";
}

export function createOriginsPage({ state, onEditBean, showToast }) {
  const map = document.querySelector("#originMap");
  const viewport = document.querySelector("#originMapViewport");
  const scene = document.querySelector("#originMapScene");
  const countriesLayer = document.querySelector("#originCountries");
  const markersLayer = document.querySelector("#originMarkers");
  const loading = document.querySelector("#originMapLoading");
  const empty = document.querySelector("#originMapEmpty");
  const filter = document.querySelector("#originStatusFilter");
  const sheet = document.querySelector("#originSheet");
  const sheetTitle = document.querySelector("#originSheetTitle");
  const sheetSubtitle = document.querySelector("#originSheetSubtitle");
  const beanList = document.querySelector("#originBeanList");

  let features = [];
  let featureByKey = new Map();
  let loadPromise;
  let activeGroups = [];
  let transform = { x: 0, y: 0, scale: 1 };
  let pointerStart = null;
  let pinchStart = null;

  function applyTransform() {
    scene.setAttribute("transform", `translate(${transform.x} ${transform.y}) scale(${transform.scale})`);
  }

  function setTransform(next) {
    const scale = Math.min(5, Math.max(1, next.scale));
    const maxX = WIDTH * (scale - 1);
    const maxY = HEIGHT * (scale - 1);
    transform = {
      scale,
      x: Math.min(0, Math.max(-maxX, next.x)),
      y: Math.min(0, Math.max(-maxY, next.y))
    };
    applyTransform();
  }

  function zoomBy(factor, centerX = WIDTH / 2, centerY = HEIGHT / 2) {
    const oldScale = transform.scale;
    const nextScale = Math.min(5, Math.max(1, oldScale * factor));
    const ratio = nextScale / oldScale;
    setTransform({
      scale: nextScale,
      x: centerX - (centerX - transform.x) * ratio,
      y: centerY - (centerY - transform.y) * ratio
    });
  }

  function resetView() {
    setTransform({ x: 0, y: 0, scale: 1 });
  }

  async function ensureMap() {
    if (features.length) return;
    if (!loadPromise) {
      loadPromise = fetch("/static/data/world-countries.geojson")
        .then(response => {
          if (!response.ok) throw new Error("Could not load local map data");
          return response.json();
        })
        .then(data => {
          features = data.features || [];
          featureByKey = new Map(features.map(feature => [
            countryKey(feature.properties?.name),
            feature
          ]));
          drawCountries();
          loading.classList.add("hidden");
        })
        .catch(error => {
          loading.textContent = "The local map data could not be loaded.";
          showToast(error.message);
          throw error;
        });
    }
    return loadPromise;
  }

  function drawCountries() {
    countriesLayer.replaceChildren();
    features.forEach(feature => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "origin-country");
      path.setAttribute("d", geometryPath(feature.geometry));
      path.dataset.countryKey = countryKey(feature.properties?.name);
      countriesLayer.append(path);
    });
  }

  function beansForFilter() {
    const selected = filter.value;
    if (selected === "all") return state.beans;
    return state.beans.filter(bean => statusKey(bean.status) === selected);
  }

  function groupBeans() {
    const grouped = new Map();
    for (const bean of beansForFilter()) {
      const rawCountry = bean.originCountry || bean.origin_country || "";
      const key = countryKey(rawCountry);
      const feature = featureByKey.get(key);
      if (!key || !feature) continue;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: rawCountry || feature.properties.name,
          mapLabel: feature.properties.name,
          feature,
          beans: []
        });
      }
      grouped.get(key).beans.push(bean);
    }
    return [...grouped.values()];
  }

  function openGroup(group) {
    sheetTitle.textContent = group.label || group.mapLabel;
    sheetSubtitle.textContent = `${group.beans.length} ${group.beans.length === 1 ? "bean" : "beans"} from this origin`;
    beanList.replaceChildren();

    group.beans
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .forEach(bean => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "origin-bean-row";
        const region = bean.originRegion || bean.origin_region || "";
        const roaster = bean.roaster || "Unknown roaster";
        button.innerHTML = `
          <span>
            <strong>${escapeHtml(bean.name || "Unnamed bean")}</strong>
            <small>${escapeHtml([roaster, region].filter(Boolean).join(" · "))}</small>
          </span>
          <span class="origin-bean-status">${escapeHtml(displayStatus(bean.status))}</span>
        `;
        button.addEventListener("click", () => onEditBean(bean.id));
        beanList.append(button);
      });

    sheet.classList.remove("hidden");
  }

  function drawMarkers() {
    activeGroups = groupBeans();
    markersLayer.replaceChildren();

    document.querySelectorAll(".origin-country.has-beans").forEach(path => path.classList.remove("has-beans"));
    for (const group of activeGroups) {
      countriesLayer.querySelector(`[data-country-key="${CSS.escape(group.key)}"]`)?.classList.add("has-beans");
      const [x, y] = project(centroid(group.feature.geometry));
      const marker = document.createElementNS(SVG_NS, "g");
      marker.setAttribute("class", "origin-marker");
      marker.setAttribute("transform", `translate(${x} ${y})`);
      marker.setAttribute("role", "button");
      marker.setAttribute("tabindex", "0");
      marker.setAttribute("aria-label", `${group.label}, ${group.beans.length} beans`);

      const halo = document.createElementNS(SVG_NS, "circle");
      halo.setAttribute("class", "origin-marker-halo");
      halo.setAttribute("r", group.beans.length > 1 ? "20" : "17");

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("class", "origin-marker-dot");
      circle.setAttribute("r", group.beans.length > 1 ? "14" : "11");

      marker.append(halo, circle);
      if (group.beans.length > 1) {
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("class", "origin-marker-count");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dy", ".35em");
        text.textContent = group.beans.length;
        marker.append(text);
      } else {
        const pin = document.createElementNS(SVG_NS, "path");
        pin.setAttribute("class", "origin-marker-bean");
        pin.setAttribute("d", "M-3.5 4.5C-8 0-5.8-7 0-8.5C5.8-7 8 0 3.5 4.5C1.5 6.5-1.5 6.5-3.5 4.5ZM-3.8 3.8C-.8 1 .8-2.1 3.6-6");
        marker.append(pin);
      }

      marker.addEventListener("click", event => {
        event.stopPropagation();
        openGroup(group);
      });
      marker.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openGroup(group);
        }
      });
      markersLayer.append(marker);
    }

    document.querySelector("#originCountryCount").textContent =
      `${activeGroups.length} ${activeGroups.length === 1 ? "origin" : "origins"}`;
    const beanCount = activeGroups.reduce((sum, group) => sum + group.beans.length, 0);
    document.querySelector("#originBeanCount").textContent =
      `${beanCount} ${beanCount === 1 ? "bean" : "beans"} placed`;

    empty.classList.toggle("hidden", activeGroups.length > 0);
  }

  async function render() {
    await ensureMap();
    drawMarkers();
  }

  async function activate() {
    await render();
    requestAnimationFrame(() => map.focus?.({ preventScroll: true }));
  }

  filter.addEventListener("change", () => {
    sheet.classList.add("hidden");
    void render();
  });
  document.querySelector("#originResetViewButton").addEventListener("click", resetView);
  document.querySelector("#originZoomInButton").addEventListener("click", () => zoomBy(1.35));
  document.querySelector("#originZoomOutButton").addEventListener("click", () => zoomBy(1 / 1.35));
  document.querySelector("#originSheetClose").addEventListener("click", () => sheet.classList.add("hidden"));

  map.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = map.getBoundingClientRect();
    const centerX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const centerY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18, centerX, centerY);
  }, { passive: false });

  viewport.addEventListener("pointerdown", event => {
    viewport.setPointerCapture(event.pointerId);
    const pointers = viewport.__originPointers || new Map();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.__originPointers = pointers;

    if (pointers.size === 1) {
      pointerStart = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: transform.scale,
        x: transform.x,
        y: transform.y
      };
    }
  });

  viewport.addEventListener("pointermove", event => {
    const pointers = viewport.__originPointers;
    if (!pointers?.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = map.getBoundingClientRect();
      const centerX = ((((a.x + b.x) / 2) - rect.left) / rect.width) * WIDTH;
      const centerY = ((((a.y + b.y) / 2) - rect.top) / rect.height) * HEIGHT;
      const nextScale = Math.min(5, Math.max(1, pinchStart.scale * (distance / pinchStart.distance)));
      const ratio = nextScale / transform.scale;
      setTransform({
        scale: nextScale,
        x: centerX - (centerX - transform.x) * ratio,
        y: centerY - (centerY - transform.y) * ratio
      });
      return;
    }

    if (pointers.size === 1 && pointerStart) {
      const rect = map.getBoundingClientRect();
      const dx = (event.clientX - pointerStart.x) * (WIDTH / rect.width);
      const dy = (event.clientY - pointerStart.y) * (HEIGHT / rect.height);
      setTransform({
        scale: transform.scale,
        x: pointerStart.tx + dx,
        y: pointerStart.ty + dy
      });
    }
  });

  function releasePointer(event) {
    const pointers = viewport.__originPointers;
    pointers?.delete(event.pointerId);
    if (!pointers?.size) {
      pointerStart = null;
      pinchStart = null;
    } else if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      pointerStart = { x: remaining.x, y: remaining.y, tx: transform.x, ty: transform.y };
      pinchStart = null;
    }
  }
  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", releasePointer);

  return { render, activate };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}
