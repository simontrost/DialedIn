import { escapeHtml, formatNumber, iconMarkup, methodById } from "../core/utils.js";

export function createRecipeRunner({ state, showToast }) {
  const dialog = document.querySelector("#recipeRunnerDialog");
  if (!dialog) return { open() { return false; }, close() {} };

  const methodBadge = document.querySelector("#recipeRunnerMethodBadge");
  const recipeTitle = document.querySelector("#recipeRunnerRecipeTitle");
  const recipeMeta = document.querySelector("#recipeRunnerRecipeMeta");
  const progressLabel = document.querySelector("#recipeRunnerProgressLabel");
  const progressFill = document.querySelector("#recipeRunnerProgressFill");
  const stageEyebrow = document.querySelector("#recipeRunnerStageEyebrow");
  const stageTitle = document.querySelector("#recipeRunnerStageTitle");
  const stageBody = document.querySelector("#recipeRunnerStageBody");
  const metrics = document.querySelector("#recipeRunnerMetrics");
  const timerPanel = document.querySelector("#recipeRunnerTimerPanel");
  const timerValue = document.querySelector("#recipeRunnerTimerValue");
  const timerHint = document.querySelector("#recipeRunnerTimerHint");
  const secondaryButton = document.querySelector("#recipeRunnerSecondaryButton");
  const primaryButton = document.querySelector("#recipeRunnerPrimaryButton");

  let activeRecipe = null;
  let activeMethod = null;
  let currentStepIndex = 0;
  let stage = "step";
  let timerTotal = 0;
  let timerRemaining = 0;
  let timerHandle = null;

  function clearTimer() {
    if (timerHandle) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function close() {
    clearTimer();
    activeRecipe = null;
    activeMethod = null;
    currentStepIndex = 0;
    stage = "step";
    timerTotal = 0;
    timerRemaining = 0;
    if (dialog.open) dialog.close();
  }

  function currentStep() {
    return activeRecipe?.steps?.[currentStepIndex] || null;
  }

  function totalSteps() {
    return Array.isArray(activeRecipe?.steps) ? activeRecipe.steps.length : 0;
  }

  function formatDuration(totalSeconds = 0) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function metricMarkup(items = []) {
    return items.map(item => `
      <div class="recipe-runner-metric">
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.label)}</small>
      </div>`).join("");
  }

  function advanceAfterWait() {
    clearTimer();
    if (currentStepIndex < totalSteps() - 1) {
      currentStepIndex += 1;
      stage = "step";
    } else {
      stage = "done";
    }
    render();
  }

  function startTimer() {
    if (!timerRemaining) {
      advanceAfterWait();
      return;
    }
    clearTimer();
    timerHandle = window.setInterval(() => {
      timerRemaining = Math.max(0, timerRemaining - 1);
      if (!timerRemaining) clearTimer();
      render();
    }, 1000);
    render();
  }

  function renderPrimaryButton(label, iconName, { secondary = false } = {}) {
    const button = secondary ? secondaryButton : primaryButton;
    button.innerHTML = `${iconMarkup(iconName, { group: "ui" })}<span>${escapeHtml(label)}</span>`;
  }

  function render() {
    if (!activeRecipe) return;
    const step = currentStep();
    const total = totalSteps();
    const displayStep = Math.min(currentStepIndex + 1, total || 1);
    const progressBase = total ? ((currentStepIndex + (stage === "done" ? 1 : stage === "wait" ? 0.66 : 0.34)) / total) : 1;

    methodBadge.innerHTML = `${iconMarkup(activeMethod?.icon || "custom-method", { group: "methods" })}<span>${escapeHtml(activeMethod?.name || "Recipe")}</span>`;
    recipeTitle.textContent = activeRecipe.name || activeMethod?.name || "Recipe";
    recipeMeta.textContent = stage === "done"
      ? `You have completed all ${total} recipe steps.`
      : `Step ${displayStep} of ${total}`;
    progressLabel.textContent = stage === "done"
      ? "Complete"
      : stage === "wait"
        ? `Waiting after step ${displayStep}`
        : `Brewing step ${displayStep}`;
    progressFill.style.width = `${Math.max(4, Math.min(100, progressBase * 100))}%`;

    metrics.innerHTML = "";
    timerPanel.classList.add("hidden");
    secondaryButton.classList.add("hidden");
    primaryButton.disabled = false;

    if (stage === "step") {
      stageEyebrow.textContent = "Recipe step";
      stageTitle.textContent = step?.title || `Step ${displayStep}`;
      stageBody.textContent = step?.note || "Follow the step and continue when you are ready.";
      const items = [];
      if (step?.waterAmount) items.push({ value: `${formatNumber(step.waterAmount, 1)} g`, label: "Water" });
      if (Number(step?.waitSeconds) > 0) items.push({ value: `${formatNumber(step.waitSeconds, 0)} sec`, label: "Wait after" });
      if (!items.length) items.push({ value: `${displayStep}/${total}`, label: "Progress" });
      metrics.innerHTML = metricMarkup(items);
      primaryButton.dataset.action = "step-continue";
      renderPrimaryButton(Number(step?.waitSeconds) > 0 ? "Continue to wait" : (currentStepIndex === total - 1 ? "Finish recipe" : "Continue"), "continue");
    } else if (stage === "wait") {
      stageEyebrow.textContent = "Wait";
      stageTitle.textContent = step?.waitSeconds ? `${formatNumber(step.waitSeconds, 0)} second pause` : "Short pause";
      stageBody.textContent = step?.note
        ? `After “${step.title || `Step ${displayStep}`}” let the brew settle. ${step.note}`
        : `After “${step?.title || `Step ${displayStep}`}” let the brew settle before continuing.`;
      metrics.innerHTML = metricMarkup([
        ...(step?.waterAmount ? [{ value: `${formatNumber(step.waterAmount, 1)} g`, label: "Previous water" }] : []),
        { value: `${displayStep}/${total}`, label: "Current step" }
      ]);
      timerPanel.classList.remove("hidden");
      timerValue.textContent = formatDuration(timerRemaining);
      timerHint.textContent = timerHandle
        ? "Timer is running. Continue once the wait is over or skip ahead anytime."
        : timerRemaining > 0
          ? "Start the timer when you are ready."
          : "Wait finished — continue to the next step.";
      secondaryButton.classList.remove("hidden");
      secondaryButton.dataset.action = "wait-skip";
      renderPrimaryButton(timerHandle ? (timerRemaining ? "Running…" : "Continue") : (timerRemaining ? "Start timer" : "Continue"), timerHandle ? (timerRemaining ? "timer" : "continue") : (timerRemaining ? "start" : "continue"));
      secondaryButton.innerHTML = `<span>Skip wait</span>`;
      primaryButton.dataset.action = timerHandle ? (timerRemaining ? "timer-running" : "wait-complete") : (timerRemaining ? "wait-start" : "wait-complete");
      primaryButton.disabled = Boolean(timerHandle && timerRemaining);
    } else {
      stageEyebrow.textContent = "Done";
      stageTitle.textContent = "Recipe complete";
      stageBody.textContent = "All steps are finished. Enjoy your coffee — or close this guide and start again any time.";
      metrics.innerHTML = metricMarkup([{ value: `${total}`, label: "Completed steps" }]);
      primaryButton.dataset.action = "finish-close";
      renderPrimaryButton("Close", "continue");
    }
  }

  function open(recipeId) {
    const recipe = state.brewRecipes.find(item => item.id === recipeId);
    if (!recipe || !Array.isArray(recipe.steps) || !recipe.steps.length) {
      showToast("This recipe has no saved steps");
      return false;
    }
    clearTimer();
    activeRecipe = recipe;
    activeMethod = methodById(state, recipe.method);
    currentStepIndex = 0;
    stage = "step";
    timerTotal = 0;
    timerRemaining = 0;
    render();
    if (!dialog.open) dialog.showModal();
    return true;
  }

  primaryButton.addEventListener("click", () => {
    const step = currentStep();
    switch (primaryButton.dataset.action) {
      case "step-continue":
        if (Number(step?.waitSeconds) > 0) {
          stage = "wait";
          timerTotal = Math.max(0, Number(step.waitSeconds) || 0);
          timerRemaining = timerTotal;
        } else if (currentStepIndex < totalSteps() - 1) {
          currentStepIndex += 1;
        } else {
          stage = "done";
        }
        render();
        break;
      case "wait-start":
        startTimer();
        break;
      case "wait-complete":
        advanceAfterWait();
        break;
      case "finish-close":
        close();
        break;
      default:
        break;
    }
  });

  secondaryButton.addEventListener("click", () => {
    if (secondaryButton.dataset.action === "wait-skip") advanceAfterWait();
  });

  dialog.addEventListener("close", () => {
    clearTimer();
    activeRecipe = null;
    activeMethod = null;
    currentStepIndex = 0;
    stage = "step";
    timerTotal = 0;
    timerRemaining = 0;
  });
  dialog.addEventListener("cancel", () => clearTimer());
  document.querySelectorAll("[data-close-recipe-runner]").forEach(button => button.addEventListener("click", close));

  return { open, close };
}
