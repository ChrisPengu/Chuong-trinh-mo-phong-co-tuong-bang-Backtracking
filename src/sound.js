const STORAGE_KEY = "ky-tri-sound-enabled";
// Curated CC0 recordings from https://kenney.nl/assets/impact-sounds.
const SAMPLE_FILES = {
  move: ["impactWood_medium_000.ogg", "impactWood_medium_002.ogg", "impactWood_medium_004.ogg"],
  capture: ["impactWood_heavy_000.ogg", "impactWood_heavy_002.ogg", "impactWood_heavy_004.ogg"],
  accent: ["impactMetal_light_001.ogg"],
  bell: ["impactBell_heavy_001.ogg"],
};

export function createSoundManager(storage) {
  let enabled = true;
  try {
    storage ??= globalThis.localStorage;
    enabled = storage?.getItem(STORAGE_KEY) !== "false";
  } catch {
    // The game still works when browser storage is unavailable.
  }
  let context = null;
  let armed = false;
  let noiseBuffer = null;
  let output = null;
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
        output = context.destination;
        if (typeof context.createDynamicsCompressor === "function") {
          const limiter = context.createDynamicsCompressor();
          limiter.threshold.value = -15;
          limiter.knee.value = 8;
          limiter.ratio.value = 5;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.2;
          limiter.connect(context.destination);
          output = limiter;
        }
      }
      if (context.state === "suspended") void context.resume().catch(() => {});
      return context;
    } catch {
      return null;
    }
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
    if (typeof audio.createStereoPanner === "function") {
      const stereo = audio.createStereoPanner();
      stereo.pan.value = Math.max(-1, Math.min(1, pan));
      volume.connect(stereo);
      stereo.connect(output);
    } else {
      volume.connect(output);
    }
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
    envelope.connect(output ?? audio.destination);
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
    envelope.connect(output ?? audio.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function play(name, { pan = 0 } = {}) {
    if (!enabled || !armed) return;
    switch (name) {
      case "start":
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
        if (!sample("move", { gain: 0.46, rate: 0.94 + ((sampleIndex.get("move") ?? 0) % 3) * 0.035, pan })) {
          noise({ duration: 0.085, gain: 0.07, frequency: 1050, endFrequency: 280, filterType: "lowpass" });
        }
        tone({ frequency: 128, endFrequency: 74, duration: 0.16, gain: 0.044, type: "triangle" });
        tone({ at: 0.026, frequency: 420, endFrequency: 190, duration: 0.075, gain: 0.018, type: "sine" });
        break;
      case "capture":
        if (!sample("capture", { gain: 0.68, rate: 0.9 + ((sampleIndex.get("capture") ?? 0) % 3) * 0.04, pan })) {
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
        sample("bell", { at: 0.06, gain: 0.24, rate: 0.93 });
        [392, 523, 659, 784].forEach((frequency, index) => {
          tone({ at: index * 0.13, frequency, duration: 0.34, gain: 0.07 });
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
    whenReady: () => samplePromise ?? Promise.resolve(),
    unlock() {
      armed = true;
      audioContext();
      void loadSamples();
    },
    isEnabled: () => enabled,
    setEnabled(value) {
      enabled = Boolean(value);
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
