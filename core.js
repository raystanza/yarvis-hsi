/* Y.A.R.V.I.S. // core state, event bus, theme, and Lively property bridge.
   Classic script: Lively serves over file://, where Chromium blocks ES modules. */
(() => {
  "use strict";

  const Y = (window.YARVIS = window.YARVIS || {});

  /* ---------------------------------------------------------------- utils */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);

  function hexToRgb(hex) {
    const h = String(hex || "#59e6ff").replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
    return {
      r: parseInt(full.slice(0, 2), 16) || 0,
      g: parseInt(full.slice(2, 4), 16) || 0,
      b: parseInt(full.slice(4, 6), 16) || 0
    };
  }

  const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;

  function cleanText(value, fallback = "", max = 120) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return fallback;
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  function setStatus(id, text, state = "muted") {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove("good", "warn", "bad", "muted");
    el.classList.add(state);
  }

  function formatBytesPerSec(bytes) {
    const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);
    if (mb >= 100) return mb.toFixed(0);
    if (mb >= 10) return mb.toFixed(1);
    return mb.toFixed(2);
  }

  function shortHardwareName(name, fallback) {
    const text = cleanText(name, "", 64);
    return text ? text.toLowerCase() : `awaiting ${fallback}`;
  }

  Y.util = { clamp, lerp, hexToRgb, rgba, $, cleanText, setStatus, formatBytesPerSec, shortHardwareName };

  /* ------------------------------------------------------------ event bus */

  const handlers = new Map();

  Y.bus = {
    on(evt, fn) {
      if (!handlers.has(evt)) handlers.set(evt, []);
      handlers.get(evt).push(fn);
    },
    off(evt, fn) {
      const list = handlers.get(evt);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(evt, payload) {
      const list = handlers.get(evt);
      if (!list) return;
      // Iterate a copy so a handler may unsubscribe during dispatch.
      for (const fn of list.slice()) {
        try {
          fn(payload);
        } catch (e) {
          console.error(`YARVIS handler failed for ${evt}`, e);
        }
      }
    }
  };

  /* --------------------------------------------------------------- themes */

  const themes = [
    { name: "Arc Cyan", accent: "#59e6ff", accent2: "#167dff", hot: "#effcff", bg: "#02070d", warn: "#ffc35a" },
    { name: "Deep Blue", accent: "#65aaff", accent2: "#3657ff", hot: "#f3f7ff", bg: "#02040b", warn: "#ffd36a" },
    { name: "Reactor Teal", accent: "#54ffe3", accent2: "#00a8b5", hot: "#edfffb", bg: "#010a0c", warn: "#ffe77a" },
    { name: "Amber Lab", accent: "#ffc967", accent2: "#ff7a21", hot: "#fff6df", bg: "#0a0602", warn: "#ffef9c" }
  ];

  /* ------------------------------------------------------------- settings */

  Y.settings = {
    theme: 0,
    customAccent: "#59e6ff",
    customBackground: "#02070d",
    topSafeArea: 44,
    hudOpacity: 92,
    fps: 30,
    animationSpeed: 100,
    glow: 100,
    scanlines: true,
    grid: true,
    particles: true,
    showPanels: true,
    audioReactive: true,
    audioSensitivity: 100,
    clock24h: true,
    showSeconds: true,
    systemTitle: "Y.A.R.V.I.S.",
    coreLabel: "Y.A.R.V.I.S.",
    nodeLabel: "DESKTOP // PRIMARY",
    // Expansion clusters.
    intensity: 1,
    reactorSpectacle: true,
    alertStates: true,
    cyclingDeck: true,
    cornerCallouts: true,
    personaLog: true,
    bootSequence: true
  };

  /* ------------------------------------------------------ intensity budget */

  const BUDGETS = [
    { name: "MINIMAL",   arcs: 0,  globePoints: 0,   vortex: 0,    klaxon: 0, glitch: 0,    trails: 0 },
    { name: "STANDARD",  arcs: 3,  globePoints: 120, vortex: 0.35, klaxon: 2, glitch: 0.35, trails: 0 },
    { name: "MAXIMUM",   arcs: 6,  globePoints: 240, vortex: 0.7,  klaxon: 4, glitch: 0.7,  trails: 1 },
    { name: "OVERDRIVE", arcs: 10, globePoints: 380, vortex: 1,    klaxon: 6, glitch: 1,    trails: 1 }
  ];

  Y.budget = () => BUDGETS[clamp(Y.settings.intensity, 0, 3)] || BUDGETS[1];

  /* ---------------------------------------------------------------- state */

  Y.telemetry = {
    cpu: 0, gpu: 0, ram: 0, ramUsed: 0, ramTotal: 0,
    down: 0, up: 0,
    cpuName: "awaiting processor identity",
    gpuName: "awaiting graphics adapter",
    netName: "awaiting network adapter",
    payloadValid: false,
    source: "demo",
    state: "waiting",
    live: false,
    lastSeen: 0
  };

  Y.media = {
    supported: false, active: false,
    title: "", artist: "", album: "", genre: "", playbackType: "", subtitle: "",
    track: 0, trackCount: 0, thumbnail: "", lastSeen: 0
  };

  Y.device = {
    cores: Number(navigator.hardwareConcurrency) || 0,
    locale: navigator.language || "unknown",
    timezone: "unknown",
    online: navigator.onLine !== false,
    battery: null,
    batterySupported: false,
    batteryInitialized: false,
    batteryError: false
  };

  try {
    Y.device.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch (_) {
    Y.device.timezone = "unknown";
  }

  Y.renderer = { fps: 0, frames: 0, sampleStart: performance.now() };

  Y.view = {
    width: 1920, height: 1080, dpr: 1,
    phase: 0,
    paused: false,
    lastFrame: performance.now(),
    sessionStart: Date.now()
  };

  Y.audio = {
    bins: new Array(128).fill(0),
    level: 0,
    sourceSeen: false,
    beatFloor: 0,
    lastBeatAt: 0,
    bands: { low: 0, mid: 0, high: 0, beat: 0 }
  };

  Y.history = { cpu: [], gpu: [], net: [] };

  /* ---------------------------------------------------------------- theme */

  Y.theme = function () {
    if (Y.settings.theme === 4) {
      return {
        accent: Y.settings.customAccent,
        accent2: Y.settings.customAccent,
        hot: "#f4ffff",
        bg: Y.settings.customBackground,
        warn: "#ffc35a"
      };
    }
    return themes[Y.settings.theme] || themes[0];
  };

  Y.applyTheme = function () {
    const t = Y.theme();
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-2", t.accent2);
    root.setProperty("--hot", t.hot);
    root.setProperty("--bg", t.bg);
    root.setProperty("--warn", t.warn);
    root.setProperty("--hud-opacity", String(Y.settings.hudOpacity / 100));
    root.setProperty("--safe-top", `${Y.settings.topSafeArea}px`);
    root.setProperty("--glow", String(Y.settings.glow / 100));

    const body = document.body;
    if (!body) return;
    body.classList.toggle("no-scanlines", !Y.settings.scanlines);
    body.classList.toggle("no-panels", !Y.settings.showPanels);
    body.classList.toggle("low-glow", Y.settings.glow < 45);
    body.classList.toggle("no-callouts", !Y.settings.cornerCallouts);
    body.classList.toggle("no-persona", !Y.settings.personaLog);
    body.classList.toggle("no-deck", !Y.settings.cyclingDeck);
    body.dataset.intensity = Y.budget().name;

    const title = $("systemTitle"), core = $("coreLabel"), node = $("nodeLabel");
    if (title) title.textContent = Y.settings.systemTitle;
    if (core) core.textContent = Y.settings.coreLabel;
    if (node) node.textContent = Y.settings.nodeLabel;
  };

  /* ------------------------------------------------- telemetry thresholds */

  const latched = { cpu: false, gpu: false, ram: false, battery: false, lastNetBurst: 0 };

  function crossing(key, value, hi, lo, hiEvent, loEvent) {
    if (!latched[key] && value > hi) {
      latched[key] = true;
      Y.bus.emit(hiEvent, value);
    } else if (latched[key] && value < lo) {
      latched[key] = false;
      Y.bus.emit(loEvent, value);
    }
  }

  const NET_BURST_BYTES = 8 * 1024 * 1024;
  const NET_BURST_COOLDOWN = 6000;

  let lastMediaSignature = "";

  /* ---------------------------------------------------------------- state */

  Y.state = {
    updateTelemetry(obj, live = true) {
      const t = Y.telemetry;
      const numericFields = ["CurrentCpu", "CurrentGpu3D", "TotalRam", "CurrentRamAvail", "CurrentNetDown", "CurrentNetUp"];
      const payloadValid = numericFields.every(
        (key) => Object.prototype.hasOwnProperty.call(obj, key) && Number.isFinite(Number(obj[key]))
      );
      const total = Math.max(0, Number(obj.TotalRam) || 0); // Lively reports RAM in megabytes.
      const rawAvail = Math.max(0, Number(obj.CurrentRamAvail) || 0);
      const avail = total > 0 ? Math.min(total, rawAvail) : rawAvail;
      const used = Math.max(0, total - avail);

      t.cpu = clamp(obj.CurrentCpu, 0, 100);
      t.gpu = clamp(obj.CurrentGpu3D, 0, 100);
      t.ramTotal = total;
      t.ramUsed = used;
      t.ram = total > 0 ? clamp((used / total) * 100, 0, 100) : 0;
      t.down = Math.max(0, Number(obj.CurrentNetDown) || 0);
      t.up = Math.max(0, Number(obj.CurrentNetUp) || 0);
      t.cpuName = shortHardwareName(obj.NameCpu, "processor");
      t.gpuName = shortHardwareName(obj.NameGpu, "graphics adapter");
      t.netName = shortHardwareName(obj.NameNetCard, "network adapter");
      t.payloadValid = payloadValid;
      t.source = live ? "host" : "demo";
      if (live) {
        t.live = true;
        t.lastSeen = performance.now();
      }

      crossing("cpu", t.cpu, 85, 70, "cpu:spike", "cpu:clear");
      crossing("gpu", t.gpu, 85, 70, "gpu:spike", "gpu:clear");
      crossing("ram", t.ram, 88, 80, "ram:pressure", "ram:clear");

      const throughput = t.down + t.up;
      const now = performance.now();
      if (throughput > NET_BURST_BYTES && now - latched.lastNetBurst > NET_BURST_COOLDOWN) {
        latched.lastNetBurst = now;
        Y.bus.emit("net:burst", throughput);
      }

      Y.bus.emit("telemetry", t);
    },

    updateNowPlaying(obj) {
      const m = Y.media;
      const wasActive = m.active;
      m.supported = true;
      m.lastSeen = performance.now();

      if (!obj || typeof obj !== "object") {
        m.active = false;
        m.title = m.artist = m.album = m.genre = m.playbackType = m.subtitle = m.thumbnail = "";
        m.track = m.trackCount = 0;
      } else {
        m.title = cleanText(obj.Title, "", 160);
        m.artist = cleanText(obj.Artist || obj.AlbumArtist || obj.Subtitle, "", 120);
        m.album = cleanText(obj.AlbumTitle, "", 120);
        m.subtitle = cleanText(obj.Subtitle, "", 120);
        m.playbackType = cleanText(obj.PlaybackType, "MEDIA", 32);
        m.genre = Array.isArray(obj.Genres)
          ? cleanText(obj.Genres.filter(Boolean).slice(0, 2).join(" / "), "", 60)
          : "";
        m.track = Math.max(0, Math.round(Number(obj.TrackNumber) || 0));
        m.trackCount = Math.max(0, Math.round(Number(obj.AlbumTrackCount) || 0));
        m.thumbnail = typeof obj.Thumbnail === "string" ? obj.Thumbnail : "";
        m.active = Boolean(m.title || m.artist || m.album);
      }

      Y.bus.emit("media", m);
      // Only announce transitions and genuine track changes, never every poll.
      const signature = `${m.title} ${m.artist}`;
      if (m.active && signature !== lastMediaSignature) Y.bus.emit("media:change", m);
      else if (!m.active && wasActive) Y.bus.emit("media:standby", m);
      lastMediaSignature = m.active ? signature : "";
    },

    setBattery(level, charging) {
      const d = Y.device;
      d.battery = { level: clamp(level, 0, 1), charging: Boolean(charging) };
      if (charging && !latched.battery) Y.bus.emit("battery:charging", d.battery);
      if (!latched.battery && !charging && d.battery.level < 0.2) {
        latched.battery = true;
        Y.bus.emit("battery:low", d.battery);
      } else if (latched.battery && (charging || d.battery.level > 0.25)) {
        latched.battery = false;
      }
      Y.bus.emit("battery", d.battery);
    },

    setHostState(state) {
      Y.telemetry.state = state;
      Y.bus.emit(`link:${state}`, state);
      Y.bus.emit("link", state);
    },

    updateHostState() {
      if (!Y.telemetry.live) {
        if (Y.telemetry.state !== "waiting") Y.state.setHostState("waiting");
        return;
      }
      const next = performance.now() - Y.telemetry.lastSeen > 6500 ? "stale" : "live";
      if (Y.telemetry.state !== next) Y.state.setHostState(next);
    },

    bandRms(start, end) {
      const bins = Y.audio.bins;
      let sum = 0, count = 0;
      for (let i = start; i < end && i < bins.length; i++) {
        const value = clamp(bins[i], 0, 1.5);
        sum += value * value;
        count++;
      }
      return count ? Math.sqrt(sum / count) : 0;
    },

    updateAudio() {
      const a = Y.audio;
      let sum = 0, count = 0;
      for (let i = 2; i < 70; i++) {
        const v = Number(a.bins[i]) || 0;
        sum += v * v;
        count++;
      }
      const rms = count ? Math.sqrt(sum / count) : 0;
      const wasActive = a.level > 0.035;

      a.level = lerp(a.level, clamp(rms, 0, 1.5), 0.18);
      a.bands.low = lerp(a.bands.low, Y.state.bandRms(1, 11), 0.22);
      a.bands.mid = lerp(a.bands.mid, Y.state.bandRms(11, 40), 0.2);
      a.bands.high = lerp(a.bands.high, Y.state.bandRms(40, 96), 0.18);
      a.bands.beat = lerp(a.bands.beat, 0, 0.2);

      const onset = a.bands.low * 0.72 + a.bands.mid * 0.28;
      const threshold = Math.max(0.065, a.beatFloor * 1.34);
      const now = performance.now();
      if (a.sourceSeen && onset > threshold && now - a.lastBeatAt > 170) {
        a.bands.beat = 1;
        a.lastBeatAt = now;
        Y.bus.emit("audio:beat", onset);
      }
      a.beatFloor = lerp(a.beatFloor, onset, onset > a.beatFloor ? 0.025 : 0.11);

      const isActive = a.level > 0.035;
      if (isActive !== wasActive) Y.bus.emit(isActive ? "audio:active" : "audio:idle", a.level);
    },

    demoTick() {
      if (Y.telemetry.live) return;
      const t = Date.now() / 1000;
      Y.state.updateTelemetry({
        CurrentCpu: 18 + 8 * Math.sin(t * 0.43) + 3 * Math.sin(t * 1.7),
        CurrentGpu3D: 11 + 6 * Math.sin(t * 0.31 + 1.2),
        TotalRam: 32 * 1024,
        CurrentRamAvail: (20.5 + 1.1 * Math.sin(t * 0.19)) * 1024,
        CurrentNetDown: (1.4 + 0.9 * Math.abs(Math.sin(t * 0.37))) * (1024 ** 2),
        CurrentNetUp: (0.15 + 0.12 * Math.abs(Math.sin(t * 0.63))) * (1024 ** 2),
        NameCpu: "DEMO // processor telemetry",
        NameGpu: "DEMO // graphics telemetry",
        NameNetCard: "DEMO // network telemetry"
      }, false);
    },

    sampleHistory() {
      const t = Y.telemetry;
      const net = clamp(Math.log10(1 + (t.down + t.up) / (96 * 1024)) * 24, 0, 100);
      Y.history.cpu.push(t.cpu);
      Y.history.gpu.push(t.gpu);
      Y.history.net.push(net);
      for (const k of Object.keys(Y.history)) {
        if (Y.history[k].length > 48) Y.history[k].shift();
      }
    }
  };

  /* --------------------------------------------------- Lively property map */

  Y.setProperty = function (name, val) {
    const s = Y.settings;
    switch (name) {
      case "theme": s.theme = clamp(val, 0, 4); break;
      case "customAccent": s.customAccent = String(val || s.customAccent); break;
      case "customBackground": s.customBackground = String(val || s.customBackground); break;
      case "topSafeArea": s.topSafeArea = clamp(val, 0, 180); break;
      case "hudOpacity": s.hudOpacity = clamp(val, 25, 100); break;
      case "fps":
        s.fps = [20, 30, 45, 60][clamp(val, 0, 3)] || 30;
        Y.renderer.frames = 0;
        Y.renderer.sampleStart = performance.now();
        break;
      case "animationSpeed": s.animationSpeed = clamp(val, 25, 200); break;
      case "glow": s.glow = clamp(val, 0, 160); break;
      case "scanlines": s.scanlines = Boolean(val); break;
      case "grid": s.grid = Boolean(val); break;
      case "particles": s.particles = Boolean(val); break;
      case "showPanels": s.showPanels = Boolean(val); break;
      case "audioReactive": s.audioReactive = Boolean(val); break;
      case "audioSensitivity": s.audioSensitivity = clamp(val, 25, 250); break;
      case "clock24h": s.clock24h = Boolean(val); break;
      case "showSeconds": s.showSeconds = Boolean(val); break;
      case "systemTitle": s.systemTitle = String(val || "").slice(0, 42); break;
      case "coreLabel": s.coreLabel = String(val || "").slice(0, 42); break;
      case "nodeLabel": s.nodeLabel = String(val || "").slice(0, 64); break;
      case "intensity": s.intensity = clamp(val, 0, 3); break;
      case "reactorSpectacle": s.reactorSpectacle = Boolean(val); break;
      case "alertStates": s.alertStates = Boolean(val); break;
      case "cyclingDeck": s.cyclingDeck = Boolean(val); break;
      case "cornerCallouts": s.cornerCallouts = Boolean(val); break;
      case "personaLog": s.personaLog = Boolean(val); break;
      case "bootSequence": s.bootSequence = Boolean(val); break;
      default: return;
    }
    Y.applyTheme();
    Y.bus.emit("settings", name);
  };
})();
