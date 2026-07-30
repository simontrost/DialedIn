export function createFillRatingControl({ root, input, itemLabel = "rating" }) {
  if (!root || !input) return { setValue() {}, getValue() { return 0; } };

  const buttons = [...root.querySelectorAll("[data-rating-value]")];
  let value = 0;

  function clamp(nextValue) {
    const number = Number(nextValue);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(buttons.length, Math.round(number)));
  }

  function render(nextValue = value) {
    value = clamp(nextValue);
    input.value = value ? String(value) : "";
    buttons.forEach((button, index) => {
      const active = index < value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    root.dataset.value = String(value);
    root.setAttribute("aria-label", value ? `${value} out of ${buttons.length} ${itemLabel}` : `No ${itemLabel} selected`);
  }

  function valueFromPointer(event) {
    const rect = root.getBoundingClientRect();
    if (!rect.width) return value;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    return clamp(Math.ceil((x / rect.width) * buttons.length));
  }

  let dragging = false;
  let ignoreNextClick = false;
  root.addEventListener("pointerdown", event => {
    dragging = true;
    ignoreNextClick = true;
    root.setPointerCapture?.(event.pointerId);
    render(valueFromPointer(event));
    event.preventDefault();
  });
  root.addEventListener("pointermove", event => {
    if (!dragging) return;
    render(valueFromPointer(event));
  });
  root.addEventListener("pointerup", event => {
    dragging = false;
    root.releasePointerCapture?.(event.pointerId);
  });
  root.addEventListener("pointercancel", () => { dragging = false; });

  buttons.forEach(button => {
    button.addEventListener("click", event => {
      if (ignoreNextClick) {
        ignoreNextClick = false;
        event.preventDefault();
        return;
      }
      const nextValue = Number(button.dataset.ratingValue);
      render(nextValue === value ? 0 : nextValue);
    });
    button.addEventListener("mouseenter", () => {
      if (!matchMedia("(hover: hover)").matches) return;
      const previewValue = Number(button.dataset.ratingValue);
      buttons.forEach((item, index) => item.classList.toggle("is-preview", index < previewValue));
    });
    button.addEventListener("focus", () => {
      const previewValue = Number(button.dataset.ratingValue);
      buttons.forEach((item, index) => item.classList.toggle("is-preview", index < previewValue));
    });
  });
  function clearPreview() {
    buttons.forEach(item => item.classList.remove("is-preview"));
  }
  root.addEventListener("mouseleave", clearPreview);
  root.addEventListener("focusout", event => {
    if (!root.contains(event.relatedTarget)) clearPreview();
  });

  render(input.value);
  return {
    setValue(nextValue) { render(nextValue); },
    getValue() { return value; }
  };
}
