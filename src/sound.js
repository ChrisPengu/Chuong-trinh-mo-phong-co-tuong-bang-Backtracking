import { PIECE_FX } from "./experience.js";

const STORAGE_KEY = "ky-tri-sound-enabled";
const VOLUME_KEY = "ky-tri-sound-volume";
// Curated CC0 recordings from https://kenney.nl/assets/impact-sounds.
const SAMPLE_FILES = {
  move: ["impactWood_medium_000.ogg", "impactWood_medium_002.ogg", "impactWood_medium_004.ogg"],
  capture: ["impactWood_heavy_000.ogg", "impactWood_heavy_002.ogg", "impactWood_heavy_004.ogg"],
  accent: ["impactMetal_light_001.ogg"],
  bell: ["impactBell_heavy_001.ogg"],
};

export function createSoundManager(storage) {
  let enabled = true;
  let masterVolume = 0.7;
  try {
    storage ??= globalThis.localStorage;
    enabled = storage?.getItem(STORAGE_KEY) !== "false";
    const savedVolume = storage?.getItem(VOLUME_KEY);
    if (savedVolume != null && Number.isFinite(Number(savedVolume))) masterVolume = Math.max(0, Math.min(1, Number(savedVolume)));
  } catch {
    // The game still works when browser storage is unavailable.
  }
  let context = null;
  let armed = false;
  let noiseBuffer = null;
  let output = null;
  let echo = null;
  let reverb = null;
  let playbackPan = 0;
  const voices = new Set();
  let samplePromise = null;
  const samples = new Map();
  const sampleIndex = new Map();

  function audioContext() {
    if (!enabled) return null;
    const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Constructor) return null;
    try {
      if (!context) {
        context = new Constructor();
        output = context.createGain();
        output.gain.value = masterVolume;
        if (typeof context.createDynamicsCompressor === "function") {
          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -15;
          limiter.knee.value = 8;
          limiter.ratio.value = 5;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.2;
          limiter.connect(context.destination);
          output.connect(limiter);
        } else output.connect(context.destination);
        if (typeof context.createDelay === "function") {
          echo = context.createDelay(0.5);
          echo.delayTime.value = 0.145;
          const feedback = context.createGain();
          feedback.gain.value = 0.2;
          const wet = context.createGain();
          wet.gain.value = 0.12;
          echo.connect(feedback); feedback.connect(echo);
          echo.connect(wet); wet.connect(output);
        }
        // Original stereo impulse: early reflections + a diffuse, dark temple tail.
        if (typeof context.createConvolver === "function") {
          reverb = context.createConvolver();
          const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 1.35), context.sampleRate);
          for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            let seed = 971 + channel * 127, smooth = 0;
            for (let i = 0; i < data.length; i++) {
              seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
              smooth = smooth * .68 + (seed / 0x80000000) * .32;
              data[i] = smooth * Math.pow(1 - i / data.length, 3.5) * .55;
            }
          }
          reverb.buffer = impulse;
          const space = context.createGain(); space.gain.value = .19;
          reverb.connect(space); space.connect(output);
        }
      }
      if (context.state === "suspended") void context.resume().catch(() => {});
      return context;
    } catch {
      return null;
    }
  }

  function track(source, nodes = []) {
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect?.();
      nodes.forEach((node) => node.disconnect?.());
    };
  }

  function stopAll() {
    for (const source of voices) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.onended?.();
    }
    voices.clear();
  }

  function route(node, ambience = false) {
    if (typeof context.createStereoPanner === "function") {
      const stereo = context.createStereoPanner();
      stereo.pan.value = playbackPan;
      node.connect(stereo); stereo.connect(output);
      if (ambience && echo) stereo.connect(echo);
      if (ambience && reverb) stereo.connect(reverb);
      return [stereo];
    }
    node.connect(output);
    if (ambience && echo) node.connect(echo);
    if (ambience && reverb) node.connect(reverb);
    return [];
  }

  function loadSamples() {
    if (samplePromise) return samplePromise;
    const audio = audioContext();
    if (!audio || !globalThis.location || !/^https?:$/.test(globalThis.location.protocol)) return Promise.resolve();
    samplePromise = Promise.all(Object.values(SAMPLE_FILES).flat().map(async (name) => {
      try {
        const url = new URL(`../assets/sfx/${name}`, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        samples.set(name, await audio.decodeAudioData(data));
      } catch {
        // Procedural audio remains available if an asset cannot load.
      }
    }));
    return samplePromise;
  }

  function sample(group, { at = 0, gain = 0.4, rate = 1, pan = 0 } = {}) {
    const audio = audioContext();
    if (!audio) return false;
    const files = SAMPLE_FILES[group].filter((name) => samples.has(name));
    if (!files.length) return false;
    const index = sampleIndex.get(group) ?? 0;
    sampleIndex.set(group, index + 1);
    const source = audio.createBufferSource();
    const volume = audio.createGain();
    source.buffer = samples.get(files[index % files.length]);
    source.playbackRate.value = rate;
    volume.gain.value = gain;
    source.connect(volume);
    const nodes = [volume];
    if (typeof audio.createStereoPanner === "function") {
      const stereo = audio.createStereoPanner();
      stereo.pan.value = Math.max(-1, Math.min(1, pan));
      volume.connect(stereo);
      stereo.connect(output);
      if (group === "bell" && echo) stereo.connect(echo);
      if (reverb && (group === "bell" || group === "accent" || group === "capture")) stereo.connect(reverb);
      nodes.push(stereo);
    } else {
      volume.connect(output);
    }
    track(source, nodes);
    source.start(audio.currentTime + at);
    return true;
  }

  function tone({ at = 0, frequency = 440, endFrequency = frequency, duration = 0.15, gain = 0.11, type = "sine" }) {
    const audio = audioContext();
    if (!audio) return;
    const start = audio.currentTime + at;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + Math.min(0.018, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    const nodes = route(envelope, duration > 0.2);
    track(oscillator, [envelope, ...nodes]);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise({ at = 0, duration = 0.12, gain = 0.06, frequency = 950, endFrequency = frequency, filterType = "bandpass" }) {
    const audio = audioContext();
    if (!audio) return;
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.7), audio.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let seed = 0x5c2f17;
      for (let index = 0; index < samples.length; index += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        samples[index] = (seed / 0x80000000) * 0.65;
      }
    }
    const start = audio.currentTime + at;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const envelope = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    if (filter.Q) filter.Q.value = filterType === "bandpass" ? 0.8 : 0.2;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + Math.min(0.012, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    const nodes = route(envelope);
    track(source, [filter, envelope, ...nodes]);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function arcaneImpact(piece, note) {
    // Distinct attack families, deliberately quiet above the recorded contact layer.
    const chime = (ratios, duration = .6) => ratios.forEach((ratio, i) => {
      tone({ at: .025 + i * .032, frequency: note * ratio, endFrequency: note * ratio * .98,
        duration, gain: .021 / (1 + i * .6) });
    });
    switch (piece) {
      case "C": // cannon: sub-drop, pressure wave and falling debris
        tone({ frequency: 68, endFrequency: 29, duration: .65, gain: .06 });
        noise({ at: .06, frequency: 2400, endFrequency: 90, duration: .58, gain: .085, filterType: "lowpass" });
        [0.13, .21, .34].forEach(at => sample("accent", { at, gain: .065, rate: .58 + at, pan: playbackPan }));
        break;
      case "R": // chariot: metal scrape and resonant blade
        noise({ frequency: 4200, endFrequency: 480, duration: .3, gain: .06 });
        chime([2, 2.76, 4.07], .55);
        break;
      case "H": // horse: staggered hoofbeat, then violet resonance
        [.03, .12, .2].forEach((at, i) => tone({ at, frequency: 155 - i * 15, endFrequency: 55, duration: .1, gain: .036, type: "triangle" }));
        chime([1, 1.5, 3], .48);
        break;
      case "E": // elephant: low stone body, jade bell
        tone({ frequency: 82, endFrequency: 48, duration: .48, gain: .05, type: "triangle" });
        chime([1, 2.76, 5.4], .85);
        break;
      case "A": chime([1, 1.25, 2, 3.75], .72); break;
      case "K":
        sample("bell", { at: .06, gain: .12, rate: .7, pan: playbackPan });
        chime([.5, 1, 1.5, 2], 1.1);
        break;
      default: chime([1, 2.03], .35);
    }
  }

  function play(name, { pan = 0, piece = "P" } = {}) {
    if (!enabled || !armed) return;
    playbackPan = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
    const profile = PIECE_FX[piece] ?? PIECE_FX.P;
    if (name === "moveStart" || name === "captureStart") {
      if (piece === "C" && name === "captureStart") {
        noise({ duration: 0.23, gain: 0.09, frequency: 340, endFrequency: 1900, filterType: "lowpass" });
        tone({ frequency: 80, endFrequency: 190, duration: 0.26, gain: 0.055, type: "triangle" });
      } else if (piece === "H") {
        [0, 0.09].forEach((at) => tone({ at, frequency: 180, endFrequency: 80, duration: 0.065, gain: 0.055, type: "triangle" }));
      } else if (piece === "R") {
        noise({ duration: 0.22, gain: 0.045, frequency: 800, endFrequency: 3200 });
      } else {
        tone({ frequency: profile.note, endFrequency: profile.note * 1.5, duration: 0.16, gain: 0.023 });
      }
    }
    if (name === "capture") {
      arcaneImpact(piece, profile.note);
      const intervals = piece === "K" ? [1, 1.5, 2] : piece === "C" ? [0.5, 1] : [1, 1.5];
      intervals.forEach((ratio, i) => tone({ at: 0.04 + i * 0.06, frequency: profile.note * ratio,
        endFrequency: profile.note * ratio * 0.8, duration: 0.3, gain: 0.035, type: "triangle" }));
    }
    switch (name) {
      case "start":
        [0, .18, .36].forEach((at, i) => tone({ at, frequency: 82 + i * 16, endFrequency: 45, duration: .3, gain: .045, type: "triangle" }));
        sample("bell", { at: .45, gain: .11, rate: .78 });
        noise({ duration: 0.32, gain: 0.04, frequency: 180, endFrequency: 850, filterType: "lowpass" });
        tone({ frequency: 98, endFrequency: 65, duration: 0.42, gain: 0.065, type: "triangle" });
        tone({ frequency: 392, duration: 0.24, gain: 0.045 });
        tone({ at: 0.12, frequency: 523, duration: 0.3, gain: 0.055 });
        tone({ at: 0.25, frequency: 659, duration: 0.4, gain: 0.06 });
        break;
      case "select":
        tone({ frequency: 590, endFrequency: 720, duration: 0.055, gain: 0.02 });
        break;
      case "moveStart":
        noise({ duration: 0.17, gain: 0.028, frequency: 2600, endFrequency: 360, filterType: "lowpass" });
        break;
      case "captureStart":
        noise({ duration: 0.28, gain: 0.07, frequency: 3600, endFrequency: 300, filterType: "bandpass" });
        tone({ frequency: 320, endFrequency: 95, duration: 0.26, gain: 0.035, type: "triangle" });
        break;
      case "move":
        if (!sample("move", { gain: 0.46, rate: profile.pitch + ((sampleIndex.get("move") ?? 0) % 3) * 0.035, pan })) {
          noise({ duration: 0.085, gain: 0.07, frequency: 1050, endFrequency: 280, filterType: "lowpass" });
        }
        tone({ frequency: 128, endFrequency: 74, duration: 0.16, gain: 0.044, type: "triangle" });
        tone({ at: 0.026, frequency: 420, endFrequency: 190, duration: 0.075, gain: 0.018, type: "sine" });
        break;
      case "capture":
        if (!sample("capture", { gain: 0.68, rate: profile.pitch * 0.93 + ((sampleIndex.get("capture") ?? 0) % 3) * 0.04, pan })) {
          noise({ duration: 0.11, gain: 0.13, frequency: 1500, endFrequency: 240, filterType: "lowpass" });
        }
        sample("accent", { at: 0.035, gain: 0.2, rate: 0.85, pan: pan * 0.7 });
        tone({ frequency: 120, endFrequency: 45, duration: 0.34, gain: 0.105, type: "triangle" });
        noise({ at: 0.08, duration: 0.23, gain: 0.05, frequency: 980, endFrequency: 130, filterType: "bandpass" });
        tone({ at: 0.055, frequency: 680, endFrequency: 250, duration: 0.15, gain: 0.023, type: "triangle" });
        break;
      case "check":
        sample("bell", { gain: 0.13, rate: 1.18, pan });
        tone({ frequency: 392, endFrequency: 430, duration: 0.22, gain: 0.05, type: "triangle" });
        tone({ at: 0.11, frequency: 587, endFrequency: 650, duration: 0.3, gain: 0.064, type: "sine" });
        tone({ at: 0.2, frequency: 784, endFrequency: 760, duration: 0.33, gain: 0.035, type: "sine" });
        break;
      case "finisher":
        noise({ duration: 0.46, gain: 0.035, frequency: 210, endFrequency: 1900, filterType: "bandpass" });
        tone({ at: 0.04, frequency: 110, endFrequency: 62, duration: 0.48, gain: 0.08, type: "triangle" });
        tone({ at: 0.18, frequency: 330, endFrequency: 523, duration: 0.38, gain: 0.055, type: "sine" });
        sample("bell", { at: 0.44, gain: 0.19, rate: 1.05 });
        break;
      case "win":
        [196, 294, 392].forEach(frequency => tone({ at: .66, frequency, duration: 1.25, gain: .025, type: "triangle" }));
        tone({ frequency: 98, endFrequency: 65, duration: 0.55, gain: 0.075, type: "triangle" });
        sample("bell", { at: 0.06, gain: 0.24, rate: 0.93 });
        [392, 523, 659, 784, 1046].forEach((frequency, index) => {
          tone({ at: index * 0.15, frequency, duration: index === 4 ? 0.65 : 0.34, gain: 0.06 });
        });
        break;
      case "defeat":
        [392, 330, 262, 196].forEach((frequency, index) => {
          tone({ at: index * 0.19, frequency, duration: 0.44, gain: 0.05, type: "triangle" });
        });
        break;
      case "draw":
        tone({ frequency: 440, endFrequency: 392, duration: 0.38, gain: 0.045 });
        tone({ at: 0.16, frequency: 330, endFrequency: 294, duration: 0.42, gain: 0.045 });
        break;
    }
  }

  return {
    play,
    stopAll,
    getVolume: () => masterVolume,
    setVolume(value) {
      if (!Number.isFinite(value)) return masterVolume;
      masterVolume = Math.max(0, Math.min(1, value));
      if (output) output.gain.value = enabled ? masterVolume : 0;
      try { storage?.setItem(VOLUME_KEY, String(masterVolume)); } catch { /* Optional storage. */ }
      return masterVolume;
    },
    whenReady: () => samplePromise ?? Promise.resolve(),
    unlock() {
      armed = true;
      audioContext();
      void loadSamples();
    },
    isEnabled: () => enabled,
    setEnabled(value) {
      enabled = Boolean(value);
      if (output) output.gain.value = enabled ? masterVolume : 0;
      if (!enabled) stopAll();
      try {
        storage?.setItem(STORAGE_KEY, String(enabled));
      } catch {
        // Storage is optional.
      }
      if (enabled) {
        armed = true;
        void loadSamples();
        play("select");
      }
      return enabled;
    },
  };
}
