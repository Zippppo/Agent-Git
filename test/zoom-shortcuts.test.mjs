import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
  getNextZoomFactor,
  getZoomShortcut
} from "../electron/zoom-shortcuts.mjs";

test("detects standard zoom keyboard shortcuts", () => {
  assert.equal(getZoomShortcut({ type: "keyDown", control: true, key: "=" }), "in");
  assert.equal(getZoomShortcut({ type: "keyDown", control: true, code: "NumpadAdd" }), "in");
  assert.equal(getZoomShortcut({ type: "keyDown", meta: true, key: "-" }), "out");
  assert.equal(getZoomShortcut({ type: "keyDown", meta: true, code: "Digit0" }), "reset");
});

test("ignores unrelated or unmodified key events", () => {
  assert.equal(getZoomShortcut({ type: "keyUp", control: true, key: "=" }), null);
  assert.equal(getZoomShortcut({ type: "keyDown", key: "=" }), null);
  assert.equal(getZoomShortcut({ type: "keyDown", control: true, key: "a" }), null);
});

test("steps and clamps zoom factors", () => {
  assert.equal(getNextZoomFactor(1, "in"), 1.1);
  assert.equal(getNextZoomFactor(1, "out"), 0.9);
  assert.equal(getNextZoomFactor(1.7, "reset"), 1);
  assert.equal(getNextZoomFactor(MAX_ZOOM_FACTOR, "in"), MAX_ZOOM_FACTOR);
  assert.equal(getNextZoomFactor(MIN_ZOOM_FACTOR, "out"), MIN_ZOOM_FACTOR);
});
