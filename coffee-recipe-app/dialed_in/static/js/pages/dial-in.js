import { formatNumber } from "../core/utils.js";

export function createDialInPage({ state }) {
  const form = document.querySelector("#dialInForm");
  const coffee = document.querySelector("#dialInCoffee");
  const targetTime = document.querySelector("#dialInTargetTime");
  const maxStep = document.querySelector("#dialInMaxStep");
  const grind1 = document.querySelector("#dialInGrind1");
  const time1 = document.querySelector("#dialInTime1");
  const grind2 = document.querySelector("#dialInGrind2");
  const time2 = document.querySelector("#dialInTime2");
  const reverseScale = document.querySelector("#dialInReverseScale");

  const recommended = document.querySelector("#dialInRecommended");
  const confidence = document.querySelector("#dialInConfidence");
  const explanation = document.querySelector("#dialInExplanation");
  const raw = document.querySelector("#dialInRaw");
  const current = document.querySelector("#dialInCurrent");
  const mode = document.querySelector("#dialInMode");

  function selectedRecipe() {
    return state.recipes.find(recipe => recipe.id === coffee.value) || null;
  }

  function fillFromRecipe() {
    const recipe = selectedRecipe();
    if (!recipe) return;
    if (recipe.grind !== null && recipe.grind !== undefined && recipe.grind !== "") grind1.value = recipe.grind;
    if (recipe.time) time1.value = recipe.time;
    if (recipe.time) targetTime.value = recipe.time;
  }

  function render() {
    const selected = coffee.value;
    coffee.innerHTML = state.recipes.length
      ? state.recipes.map(recipe => `<option value="${recipe.id}">${recipe.name}</option>`).join("")
      : '<option value="">No recipes available</option>';
    if ([...coffee.options].some(option => option.value === selected)) coffee.value = selected;
    else fillFromRecipe();
  }

  function directionStep(measuredTime, desiredTime, finerIsLower) {
    const difference = desiredTime - measuredTime;
    if (Math.abs(difference) <= 1) return 0;
    const magnitude = Math.min(Number(maxStep.value) || 2.5, Math.max(0.5, Math.abs(difference) / 6));
    const shouldGoFiner = difference > 0;
    if (shouldGoFiner) return finerIsLower ? -magnitude : magnitude;
    return finerIsLower ? magnitude : -magnitude;
  }

  function calculate(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const g1 = Number(grind1.value);
    const t1 = Number(time1.value);
    const g2 = grind2.value === "" ? null : Number(grind2.value);
    const t2 = time2.value === "" ? null : Number(time2.value);
    const target = Number(targetTime.value);
    const stepLimit = Math.max(0.1, Number(maxStep.value) || 2.5);
    const finerIsLower = reverseScale.checked;

    let rawEstimate;
    let next;
    let level;
    let calculationMode;
    let message;
    let currentSetting = g1;

    if (g2 !== null && t2 !== null && t1 !== t2 && g1 !== g2) {
      rawEstimate = g1 + ((target - t1) * (g2 - g1)) / (t2 - t1);
      currentSetting = Math.abs(t2 - target) <= Math.abs(t1 - target) ? g2 : g1;
      const delta = Math.max(-stepLimit, Math.min(stepLimit, rawEstimate - currentSetting));
      next = currentSetting + delta;
      const minTime = Math.min(t1, t2);
      const maxTime = Math.max(t1, t2);
      const interpolating = target >= minTime && target <= maxTime;
      level = interpolating ? "medium" : "low";
      calculationMode = interpolating ? "Interpolation" : "Extrapolation";
      message = interpolating
        ? "The target lies between both measured shots, so the estimate is based on a local trend."
        : "The target lies outside the measured range. The raw estimate was limited to a safer next step.";
    } else {
      const step = directionStep(t1, target, finerIsLower);
      rawEstimate = g1 + step;
      next = rawEstimate;
      level = "low";
      calculationMode = "Rule-based first step";
      message = Math.abs(target - t1) <= 1
        ? "The shot is already inside the target window. Keep the grind setting and evaluate taste."
        : "Only one usable measurement is available, so the assistant recommends a cautious first adjustment.";
    }

    const roundedNext = Math.round(next * 10) / 10;
    recommended.textContent = formatNumber(roundedNext, 1);
    confidence.textContent = `${level[0].toUpperCase()}${level.slice(1)} confidence`;
    confidence.dataset.level = level;
    explanation.textContent = message;
    raw.textContent = formatNumber(rawEstimate, 2);
    current.textContent = formatNumber(currentSetting, 1);
    mode.textContent = calculationMode;
  }

  coffee.addEventListener("change", fillFromRecipe);
  form.addEventListener("submit", calculate);

  return { render };
}
