export function createFillRatingControl({ root, input, itemLabel = "rating" }) {
  if (!root || !input) return { setValue() {}, getValue() { return 0; } };

  const buttons = [...root.querySelectorAll("[data-rating-value]")];
  const maximum = buttons.length;
  let value = 0;
  let previewValue = null;
  let dragging = false;
  let movedDuringDrag = false;

  function clamp(nextValue) {
    const number = Number(nextValue);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(maximum, Math.round(number * 2) / 2));
  }

  function paint(displayValue = value) {
    const normalized = clamp(displayValue);
    buttons.forEach((button, index) => {
      const amount = Math.max(0, Math.min(1, normalized - index));
      button.classList.toggle("is-full", amount >= 1);
      button.classList.toggle("is-half", amount === .5);
      button.classList.toggle("is-preview", previewValue !== null);
      button.setAttribute("aria-pressed", String(amount > 0));
    });
  }

  function render(nextValue = value) {
    value = clamp(nextValue);
    input.value = value ? String(value) : "";
    previewValue = null;
    paint(value);
    root.dataset.value = String(value);
    root.setAttribute("aria-label", value ? `${value} out of ${maximum} ${itemLabel}` : `No ${itemLabel} selected`);
  }

  function valueFromPointer(event) {
    const rect = root.getBoundingClientRect();
    if (!rect.width) return value;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    return clamp((x / rect.width) * maximum);
  }

  function showPreview(nextValue) {
    previewValue = clamp(nextValue);
    paint(previewValue);
  }

  root.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging = true;
    movedDuringDrag = false;
    root.setPointerCapture?.(event.pointerId);
    render(valueFromPointer(event));
    event.preventDefault();
  });

  root.addEventListener("pointermove", event => {
    const nextValue = valueFromPointer(event);
    if (dragging) {
      movedDuringDrag = true;
      render(nextValue);
    } else if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches) {
      showPreview(nextValue);
    }
  });

  root.addEventListener("pointerup", event => {
    dragging = false;
    root.releasePointerCapture?.(event.pointerId);
  });
  root.addEventListener("pointercancel", () => { dragging = false; });
  root.addEventListener("pointerleave", () => {
    if (!dragging) { previewValue = null; paint(value); }
  });

  buttons.forEach(button => {
    button.addEventListener("click", event => {
      if (movedDuringDrag) {
        movedDuringDrag = false;
        event.preventDefault();
        return;
      }
      if (event.detail === 0) {
        const nextValue = Number(button.dataset.ratingValue);
        render(nextValue === value ? 0 : nextValue);
      }
    });
    button.addEventListener("focus", () => showPreview(Number(button.dataset.ratingValue)));
  });
  root.addEventListener("focusout", event => {
    if (!root.contains(event.relatedTarget)) { previewValue = null; paint(value); }
  });

  render(input.value);
  return {
    setValue(nextValue) { render(nextValue); },
    getValue() { return value; }
  };
}
