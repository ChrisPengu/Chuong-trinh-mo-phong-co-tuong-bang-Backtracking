import test from "node:test";
import assert from "node:assert/strict";
import { createSoundManager } from "../src/sound.js";

test("công tắc âm thanh được lưu và khôi phục", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const first = createSoundManager(storage);
  assert.equal(first.isEnabled(), true);
  first.setEnabled(false);
  assert.equal(first.isEnabled(), false);
  assert.equal(createSoundManager(storage).isEnabled(), false);
  first.setEnabled(true);
  assert.equal(createSoundManager(storage).isEnabled(), true);
});

test("âm thanh không làm hỏng game nếu storage hoặc AudioContext không khả dụng", () => {
  const storage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  const manager = createSoundManager(storage);
  assert.doesNotThrow(() => manager.play("capture"));
  assert.doesNotThrow(() => manager.setEnabled(false));
  assert.equal(manager.isEnabled(), false);
});

test("các lớp SFX đi quân và bắt quân phát qua Web Audio", () => {
  const oldAudioContext = globalThis.AudioContext;
  let starts = 0;
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 });
  const node = () => ({ connect() {}, start() { starts += 1; }, stop() {} });
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    createOscillator() { return { ...node(), frequency: parameter() }; }
    createGain() { return { ...node(), gain: parameter() }; }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return node(); }
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
  };
  try {
    const manager = createSoundManager({ getItem: () => null, setItem() {} });
    manager.unlock();
    manager.play("moveStart");
    manager.play("move");
    manager.play("captureStart");
    manager.play("capture");
    manager.play("finisher");
    assert.ok(starts >= 10, "SFX phải kết hợp nhiều lớp noise và tone");
    const beforeMute = starts;
    manager.setEnabled(false);
    manager.play("capture");
    assert.equal(starts, beforeMute);
  } finally {
    globalThis.AudioContext = oldAudioContext;
  }
});

test("tải mẫu âm cục bộ và phát tiếng gỗ thu sẵn khi đã sẵn sàng", async () => {
  const oldAudioContext = globalThis.AudioContext;
  const oldFetch = globalThis.fetch;
  const oldLocation = globalThis.location;
  const played = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 });
  const node = () => ({ connect() {}, start() {}, stop() {} });
  globalThis.location = { protocol: "http:" };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    createOscillator() { return { ...node(), frequency: parameter() }; }
    createGain() { return { ...node(), gain: parameter() }; }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { ...node(), playbackRate: parameter(), start() { if (this.buffer?.recorded) played.push(this.playbackRate.value); } }; }
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
    createStereoPanner() { return { ...node(), pan: parameter() }; }
    decodeAudioData = async () => ({ recorded: true });
  };
  try {
    const manager = createSoundManager({ getItem: () => null, setItem() {} });
    manager.unlock();
    await manager.whenReady();
    manager.play("move", { pan: -0.4 });
    manager.play("capture", { pan: 0.4 });
    assert.ok(played.length >= 3, "phải phát mẫu gỗ và điểm nhấn kim loại");
    assert.ok(played.every(Number.isFinite), "tốc độ phát không được là NaN");
  } finally {
    globalThis.AudioContext = oldAudioContext;
    globalThis.fetch = oldFetch;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
  }
});
