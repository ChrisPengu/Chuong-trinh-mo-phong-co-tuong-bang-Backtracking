import test from "node:test";
import assert from "node:assert/strict";
import { findBestMove } from "../src/ai.js";

function element() {
  const handlers = new Map();
  const classes = new Set();
  return {
    hidden: false,
    disabled: false,
    dataset: {},
    textContent: "",
    innerHTML: "",
    scrollTop: 0,
    scrollHeight: 200,
    offsetWidth: 100,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      toggle(name, force) {
        if (force ?? !classes.has(name)) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); },
    },
    addEventListener(name, handler) { handlers.set(name, handler); },
    dispatch(name, data = {}) { handlers.get(name)?.(data); },
    setAttribute(name, value) { this[name] = value; },
    focus() {},
    querySelector() { return element(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 800 }; },
  };
}

test("giao diện khởi chạy, chuyển chế độ, animate nước đi và bật/tắt tiếng", async () => {
  const nodes = new Map();
  const modeButtons = ["pve", "pvp"].map((mode) => Object.assign(element(), { dataset: { mode } }));
  const sideButtons = ["red", "black"].map((side) => Object.assign(element(), { dataset: { side } }));
  const timers = new Map();
  const frames = new Map();
  let nextId = 1;
  const flushTimers = () => {
    for (const [id, callback] of [...timers]) {
      timers.delete(id);
      callback();
    }
  };
  const canvasContext = new Proxy({}, {
    get(_, key) {
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
      return () => {};
    },
    set() { return true; },
  });
  const canvas = Object.assign(element(), { getContext: () => canvasContext });
  nodes.set("#board", canvas);
  nodes.set("#difficulty", Object.assign(element(), { value: "medium" }));

  globalThis.document = {
    body: element(),
    activeElement: null,
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, element());
      return nodes.get(selector);
    },
    querySelectorAll(selector) {
      return selector === "[data-mode]" ? modeButtons : sideButtons;
    },
    addEventListener() {},
  };
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    setTimeout(handler) { const id = nextId++; timers.set(id, handler); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(handler) { const id = nextId++; frames.set(id, handler); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    clearInterval() {},
  };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.Worker = class {
    addEventListener(name, handler) { if (name === "message") this.onmessage = handler; }
    terminate() {}
    postMessage(data) {
      const result = findBestMove(data.board, data.color, { level: data.level, maxDepth: 2, timeMs: 1000 });
      this.onmessage?.({ data: { requestId: data.requestId, result } });
    }
  };

  await import("../src/app.js");
  assert.equal(nodes.get("#startCeremony").hidden, false);
  assert.equal(nodes.get("#soundToggle")["aria-pressed"], "true");
  nodes.get("#soundToggle").dispatch("click");
  assert.equal(nodes.get("#soundToggle")["aria-pressed"], "false");

  modeButtons[1].dispatch("click");
  flushTimers();
  assert.equal(nodes.get("#startCeremony").hidden, true);
  assert.equal(nodes.get("#redName").textContent, "Người chơi 1");

  canvas.dispatch("pointerup", { clientX: 56, clientY: 58 + 6 * 76 });
  canvas.dispatch("pointerup", { clientX: 56, clientY: 58 + 5 * 76 });
  assert.equal(nodes.get("#moveCount").textContent, "1 nước");
  assert.equal(nodes.get("#undoBtn").disabled, true, "khóa hoàn tác trong khi quân đang di chuyển");
  for (const callback of [...frames.values()]) callback(performance.now() + 1000);
  assert.equal(nodes.get("#undoBtn").disabled, false);
  assert.equal(nodes.get("#statusText").textContent, "Đen đi");

  canvas.dispatch("pointerup", { clientX: 56, clientY: 58 + 3 * 76 });
  canvas.dispatch("pointerup", { clientX: 56, clientY: 58 + 4 * 76 });
  assert.equal(nodes.get("#moveCount").textContent, "2 nước");
  nodes.get("#newGame").dispatch("click");
  for (const callback of [...frames.values()]) callback(performance.now() + 1000);
  assert.equal(nodes.get("#moveCount").textContent, "0 nước", "khung hình cũ không được ghi đè ván mới");
  assert.equal(nodes.get("#startCeremony").hidden, false);

  nodes.get("#scenarioSelect").value = "red_mate_one";
  nodes.get("#loadScenario").dispatch("click");
  flushTimers();
  nodes.get("#hintBtn").dispatch("click");
  assert.equal(nodes.get("#analysisPanel").hidden, false);
  assert.match(nodes.get("#analysisBest").textContent, /Xe/);
  assert.match(nodes.get("#analysisLine").innerHTML, /Đỏ/);

  canvas.dispatch("pointerup", { clientX: 56 + 4 * 76, clientY: 58 + 2 * 76 });
  canvas.dispatch("pointerup", { clientX: 56 + 4 * 76, clientY: 58 + 76 });
  for (const callback of [...frames.values()]) callback(performance.now() + 1000);
  assert.equal(nodes.get("#boardFrame").dataset.energy, "red");
  assert.equal(nodes.get("#boardFrame").classList.contains("arena-finale"), true);
  nodes.get("#newGame").dispatch("click");
  assert.equal(nodes.get("#boardFrame").classList.contains("arena-finale"), false,
    "hiệu ứng ván cũ phải được hủy khi tạo ván mới");

  nodes.get("#scenarioSelect").value = "red_won";
  nodes.get("#loadScenario").dispatch("click");
  flushTimers();
  flushTimers();
  assert.equal(nodes.get("#resultBackdrop").hidden, false);
  assert.equal(nodes.get("#resultTitle").textContent, "Đỏ chiến thắng");
});
