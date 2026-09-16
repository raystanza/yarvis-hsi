/* Y.A.R.V.I.S. // Lively host bridge, DOM rendering, and the animation loop.
   State and effects live in core/render/effects/modules/persona; this file wires
   them to the host and to the document. */
(() => {
  "use strict";

  const Y = window.YARVIS;
  const { $, clamp, hexToRgb, cleanText, setStatus, formatBytesPerSec } = Y.util;

  let lastMiniSample = 0;
  let lastPersonaTick = 0;

  /* ------------------------------------------------------- DOM rendering */

  function renderTelemetryDOM() {
    const t = Y.telemetry;
    const cpu = t.cpu, gpu = t.gpu, ram = t.ram;
    $("cpuValue").textContent = `${cpu.toFixed(1)}%`;
    $("gpuValue").textContent = `${gpu.toFixed(1)}%`;
    $("ramValue").textContent = `${ram.toFixed(1)}%`;
    $("cpuBar").style.width = `${cpu}%`;
    $("gpuBar").style.width = `${gpu}%`;
    $("ramBar").style.width = `${ram}%`;
    $("cpuName").textContent = t.cpuName;
    $("gpuName").textContent = t.gpuName;
    $("netName").textContent = t.netName;
    $("ramDetail").textContent = t.ramTotal > 0
      ? `${(t.ramUsed / 1024).toFixed(1)} / ${(t.ramTotal / 1024).toFixed(1)} GB`
      : "-- / -- GB";
    $("netDown").textContent = formatBytesPerSec(t.down);
    $("netUp").textContent = formatBytesPerSec(t.up);
    $("coreCpu").textContent = cpu.toFixed(0).padStart(2, "0");
    $("coreGpu").textContent = gpu.toFixed(0).padStart(2, "0");
    const weighted = clamp((cpu + gpu + ram) / 3, 0, 100);
    $("corePercent").textContent = weighted.toFixed(1).padStart(5, "0");

    const netLevel = clamp(Math.log10(1 + (t.down + t.up) / (128 * 1024)) / 2.25, 0, 1);
    document.querySelectorAll(".signal-strip i").forEach((el, i) => {
      const wave = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.71 + Y.view.phase * 4.3));
      el.style.height = `${18 + 78 * clamp(netLevel * 0.75 + wave * 0.18, 0, 1)}%`;
      el.style.opacity = String(0.2 + 0.8 * clamp(netLevel + 0.15, 0, 1));
    });
  }

  function renderHostState() {
    const state = Y.telemetry.state;
    const badge = $("hostState"), boot = $("bootLog"), link = $("linkStatus");
    const foot = $("footerState"), core = $("coreState"), mode = $("coreMode");
    badge.className = `state ${state}`;

    const copy = {
      live: ["LINK // ONLINE", "[ OK ]", "host telemetry channel synchronized", "ONLINE", "ONLINE", "SYSTEM NOMINAL", "HOST LINKED"],
      stale: ["LINK // DEGRADED", "[ !! ]", "host telemetry channel stale", "STALE", "DEGRADED", "TELEMETRY DEGRADED", "RETRYING"],
      waiting: ["LINK // WAITING", "[ .. ]", "establishing host telemetry channel", "STANDBY", "STANDBY", "SYSTEM INITIALIZATION", "SYNCHRONIZING"]
    }[state] || [];

    badge.textContent = copy[0];
    boot.textContent = "";
    const flag = document.createElement("span");
    flag.textContent = copy[1];
    boot.appendChild(flag);
    boot.appendChild(document.createTextNode(` ${copy[2]}`));
    link.textContent = copy[3];
    foot.textContent = copy[4];
    core.textContent = copy[5];
    mode.textContent = copy[6];

    renderCoreContext();
  }

  function renderCoreContext() {
    const label = $("coreSubLabel");
    if (Y.media.active) label.textContent = "MEDIA UPLINK // ACTIVE";
    else if (Y.telemetry.state === "live") label.textContent = "HOST INTEGRATION // ACTIVE";
    else if (Y.telemetry.state === "stale") label.textContent = "HOST INTEGRATION // DEGRADED";
    else label.textContent = "LOCAL INTERFACE // STANDBY";
  }

  function renderMedia() {
    const m = Y.media;
    const panel = $("mediaPanel"), art = $("mediaArt");
    if (!m.active) {
      panel.classList.remove("has-art");
      setStatus("mediaState", m.supported ? "STANDBY" : "WAITING", "muted");
      $("mediaPlaybackType").textContent = "WINDOWS MEDIA SESSION";
      $("mediaTitle").textContent = "NO ACTIVE MEDIA";
      $("mediaArtist").textContent = m.supported ? "UPLINK // STANDBY" : "UPLINK // WAITING FOR LIVELY";
      $("mediaAlbum").textContent = m.supported ? "Compatible source not currently active" : "Requires Lively system-nowplaying feed";
      $("mediaTrack").textContent = "TRACK -- / --";
      $("mediaGenre").textContent = "UNCATEGORIZED";
      art.removeAttribute("src");
      art.dataset.source = "";
      return;
    }

    setStatus("mediaState", "LINKED", "good");
    $("mediaPlaybackType").textContent = `${(m.playbackType || "MEDIA").toUpperCase()} // WINDOWS SESSION`;
    $("mediaTitle").textContent = m.title || "UNTITLED MEDIA";
    $("mediaArtist").textContent = m.artist || m.subtitle || "UNKNOWN ORIGIN";
    $("mediaAlbum").textContent = m.album || m.subtitle || "ALBUM DATA UNAVAILABLE";
    $("mediaTrack").textContent = m.track || m.trackCount
      ? `TRACK ${String(m.track || "--").padStart(2, "0")} / ${String(m.trackCount || "--").padStart(2, "0")}`
      : "TRACK // UNINDEXED";
    $("mediaGenre").textContent = (m.genre || "UNCATEGORIZED").toUpperCase();

    if (m.thumbnail) {
      if (art.dataset.source !== m.thumbnail) {
        art.dataset.source = m.thumbnail;
        art.src = m.thumbnail.startsWith("data:") ? m.thumbnail : `data:image/png;base64,${m.thumbnail}`;
      }
      panel.classList.add("has-art");
    } else {
      panel.classList.remove("has-art");
      art.removeAttribute("src");
      art.dataset.source = "";
    }
  }

  function renderDeviceIdentity() {
    const d = Y.device;
    $("logicalCores").textContent = d.cores ? `${d.cores} THREADS` : "UNAVAILABLE";
    $("displayGeometry").textContent = `${Math.round(window.innerWidth || Y.view.width)} × ${Math.round(window.innerHeight || Y.view.height)}`;
    $("displayScale").textContent = `${(window.devicePixelRatio || 1).toFixed(2)} ×`;
    setStatus("browserOnline", d.online ? "ONLINE" : "OFFLINE", d.online ? "good" : "warn");
    $("systemLocale").textContent = cleanText(d.locale, "UNKNOWN", 24).toUpperCase();
    $("systemTimezone").textContent = cleanText(d.timezone, "UNKNOWN", 40).replace(/_/g, " ").toUpperCase();

    if (d.battery) {
      const level = Math.round(clamp(d.battery.level, 0, 1) * 100);
      const text = d.battery.charging
        ? (level >= 99 ? "AC // FULL" : `CHARGING // ${level}%`)
        : `BATTERY // ${level}%`;
      setStatus("batteryStatus", text, level <= 20 && !d.battery.charging ? "warn" : "good");
    } else if (d.batteryError) {
      setStatus("batteryStatus", "RESTRICTED", "warn");
    } else if (!d.batteryInitialized) {
      setStatus("batteryStatus", "PROBING", "muted");
    } else if (!d.batterySupported) {
      setStatus("batteryStatus", "UNAVAILABLE", "muted");
    }
  }

  function renderDiagnostics() {
    const t = Y.telemetry;
    const now = performance.now();

    if (t.live) {
      const age = Math.max(0, (now - t.lastSeen) / 1000);
      if (t.state === "live") setStatus("diagTelemetry", `LIVE // ${age.toFixed(1)}s`, "good");
      else setStatus("diagTelemetry", `STALE // ${age.toFixed(1)}s`, "warn");
      setStatus("diagPayload", t.payloadValid ? "VALID" : "FAULT", t.payloadValid ? "good" : "bad");
    } else {
      setStatus("diagTelemetry", "LOCAL DEMO", "muted");
      setStatus("diagPayload", t.payloadValid ? "SIMULATED" : "WAITING", "muted");
    }

    if (Y.view.paused) setStatus("diagRenderer", "PAUSED", "muted");
    else if (Y.renderer.fps > 0) {
      const healthy = Y.renderer.fps >= Y.settings.fps * 0.78;
      setStatus("diagRenderer", `${Y.renderer.fps.toFixed(1)} FPS`, healthy ? "good" : "warn");
    } else setStatus("diagRenderer", "WARMING", "muted");

    if (t.live && t.payloadValid) {
      const active = t.down + t.up > 1024;
      setStatus("diagNetwork", active ? "ACTIVE" : "IDLE", active ? "good" : "muted");
    } else setStatus("diagNetwork", t.source === "demo" ? "SIMULATED" : "WAITING", "muted");

    if (!Y.settings.audioReactive) setStatus("diagAudio", "DISABLED", "muted");
    else if (!Y.audio.sourceSeen) setStatus("diagAudio", "WAITING", "muted");
    else setStatus("diagAudio", Y.audio.level > 0.035 ? "ACTIVE" : "ARMED", Y.audio.level > 0.035 ? "good" : "muted");

    if (Y.media.active) setStatus("diagMedia", "LINKED", "good");
    else if (Y.media.supported) setStatus("diagMedia", "STANDBY", "muted");
    else setStatus("diagMedia", "WAITING", "muted");
  }

  function renderAudioBands() {
    const sensitivity = Y.settings.audioSensitivity / 100;
    const level = (value) => (Y.settings.audioReactive ? clamp(value * sensitivity, 0, 1) * 100 : 0);
    $("audioLowBar").style.width = `${level(Y.audio.bands.low).toFixed(1)}%`;
    $("audioMidBar").style.width = `${level(Y.audio.bands.mid).toFixed(1)}%`;
    $("audioHighBar").style.width = `${level(Y.audio.bands.high).toFixed(1)}%`;

    const beat = $("beatState");
    const hit = Y.audio.bands.beat > 0.45 && Y.settings.audioReactive;
    beat.className = hit ? "hit" : "";
    beat.textContent = !Y.settings.audioReactive ? "OFF" : hit ? "HIT" : Y.audio.sourceSeen ? "ARMED" : "WAIT";

    $("audioStatus").textContent = !Y.settings.audioReactive
      ? "DISABLED"
      : !Y.audio.sourceSeen ? "WAITING" : Y.audio.level > 0.035 ? "ACTIVE" : "ARMED";
  }

  function renderAlertCallouts() {
    const badge = $("alertBadge");
    const stress = $("stressReadout");
    if (badge) {
      badge.dataset.state = Y.alerts.state;
      const value = badge.querySelector("b");
      if (value) value.textContent = Y.alerts.state;
    }
    if (stress) {
      const value = stress.querySelector("b");
      if (value) value.textContent = Y.alerts.stress.toFixed(1).padStart(4, "0");
    }
  }

  function updateClock() {
    const now = new Date();
    const opts = { hour: "2-digit", minute: "2-digit", hour12: !Y.settings.clock24h };
    if (Y.settings.showSeconds) opts.second = "2-digit";
    $("clock").textContent = now.toLocaleTimeString([], opts);
    $("date").textContent = now
      .toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "2-digit" })
      .toUpperCase();

    const sec = Math.floor((Date.now() - Y.view.sessionStart) / 1000);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    $("sessionUptime").textContent = [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  }

    /* ---------------------------------------------------------------- loop */

  function animationLoop(now) {
    if (Y.view.paused) { requestAnimationFrame(animationLoop); return; }

    const interval = 1000 / Y.settings.fps;
    if (now - Y.view.lastFrame >= interval) {
      const dt = Math.min(80, now - Y.view.lastFrame);
      Y.view.lastFrame = now;

      Y.state.updateAudio();
      renderAudioBands();
      Y.alerts.update(dt, now);
      renderAlertCallouts();
      Y.render.frame(dt);
      renderTelemetryDOM();

      if (now - lastMiniSample >= 650) {
        lastMiniSample = now;
        Y.state.sampleHistory();
      }
      Y.modules.update(dt, now);

      if (now - lastPersonaTick >= 1000) {
        lastPersonaTick = now;
        Y.persona.update(now);
      }

      Y.renderer.frames++;
      const sampleElapsed = now - Y.renderer.sampleStart;
      if (sampleElapsed >= 1000) {
        Y.renderer.fps = (Y.renderer.frames * 1000) / sampleElapsed;
        Y.renderer.frames = 0;
        Y.renderer.sampleStart = now;
        renderDiagnostics();
      }
    }
    requestAnimationFrame(animationLoop);
  }

  /* ------------------------------------------------------------- battery */

  async function initializeBattery() {
    const d = Y.device;
    if (typeof navigator.getBattery !== "function") {
      d.batterySupported = false;
      d.batteryInitialized = true;
      renderDeviceIdentity();
      return;
    }
    d.batterySupported = true;
    try {
      const battery = await navigator.getBattery();
      const refresh = () => {
        Y.state.setBattery(battery.level, battery.charging);
        renderDeviceIdentity();
      };
      ["chargingchange", "levelchange", "chargingtimechange", "dischargingtimechange"]
        .forEach((eventName) => battery.addEventListener(eventName, refresh));
      refresh();
    } catch (_) {
      d.battery = null;
      d.batteryError = true;
    }
    d.batteryInitialized = true;
    renderDeviceIdentity();
  }

  /* ------------------------------------------------------ bus wiring */

  Y.bus.on("telemetry", () => { renderTelemetryDOM(); renderDiagnostics(); });
  Y.bus.on("media", () => { renderMedia(); renderCoreContext(); renderDiagnostics(); });
  Y.bus.on("link", () => { renderHostState(); renderDiagnostics(); });
  Y.bus.on("battery", renderDeviceIdentity);
  Y.bus.on("settings", () => { renderDiagnostics(); renderAudioBands(); });
  // Repaint the callouts on the transition itself, not only on the next frame,
  // so the badge stays truthful while the loop is slow or Lively has paused us.
  Y.bus.on("alert:change", renderAlertCallouts);

  /* --------------------------------------------------------- Lively hooks */

  window.livelySystemInformation = function (data) {
    try {
      const obj = typeof data === "string" ? JSON.parse(data) : data;
      if (obj && typeof obj === "object") Y.state.updateTelemetry(obj, true);
    } catch (e) {
      console.error("Invalid Lively telemetry", e);
    }
  };

  window.livelyCurrentTrack = function (data) {
    try {
      const obj = typeof data === "string" ? JSON.parse(data) : data;
      Y.state.updateNowPlaying(obj);
    } catch (e) {
      console.error("Invalid Lively media data", e);
    }
  };

  window.livelyAudioListener = function (arr) {
    if (Array.isArray(arr)) {
      Y.audio.sourceSeen = true;
      Y.audio.bins = arr.slice(0, 128);
    }
  };

  window.livelyWallpaperPlaybackChanged = function (data) {
    try {
      const obj = typeof data === "string" ? JSON.parse(data) : data;
      Y.view.paused = Boolean(obj && obj.IsPaused);
      Y.renderer.frames = 0;
      Y.renderer.sampleStart = performance.now();
      if (!Y.view.paused) Y.view.lastFrame = performance.now();
      renderDiagnostics();
    } catch (e) {
      console.error("Invalid Lively pause event", e);
    }
  };

  window.livelyPropertyListener = function (name, val) {
    Y.setProperty(name, val);
  };

  /* ----------------------------------------------------------------- boot */

  window.addEventListener("resize", () => { Y.render.resize(); renderDeviceIdentity(); }, { passive: true });
  window.addEventListener("online", () => { Y.device.online = true; renderDeviceIdentity(); });
  window.addEventListener("offline", () => { Y.device.online = false; renderDeviceIdentity(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !Y.view.paused) Y.view.lastFrame = performance.now();
  });
  $("mediaArt").addEventListener("error", () => { $("mediaPanel").classList.remove("has-art"); });

  Y.render.attach($("fxCanvas"));
  Y.render.resize();
  Y.applyTheme();
  Y.modules.init();
  Y.persona.init();
  renderMedia();
  renderDeviceIdentity();
  updateClock();
  Y.state.setHostState("waiting");
  Y.state.demoTick();
  initializeBattery();

  setInterval(updateClock, 250);
  setInterval(renderDiagnostics, 500);
  setInterval(() => Y.state.updateHostState(), 1000);
  setInterval(() => Y.state.demoTick(), 1000);
  requestAnimationFrame(animationLoop);
})();
