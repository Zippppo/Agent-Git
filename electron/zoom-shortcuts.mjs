export const ZOOM_STEP = 0.1;
export const MIN_ZOOM_FACTOR = 0.5;
export const MAX_ZOOM_FACTOR = 2;

export function clampZoomFactor(value) {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, value));
}

export function getZoomShortcut(input) {
  if (input?.type !== "keyDown" || (!input.control && !input.meta)) return null;

  const key = (input.key || "").toLowerCase();
  const code = input.code || "";

  if (key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd") {
    return "in";
  }

  if (key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract") {
    return "out";
  }

  if (key === "0" || key === ")" || code === "Digit0" || code === "Numpad0") {
    return "reset";
  }

  return null;
}

export function getNextZoomFactor(current, shortcut) {
  if (shortcut === "reset") return 1;
  if (shortcut === "in") return clampZoomFactor(Math.round((current + ZOOM_STEP) * 10) / 10);
  if (shortcut === "out") return clampZoomFactor(Math.round((current - ZOOM_STEP) * 10) / 10);
  return current;
}
