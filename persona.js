/* Y.A.R.V.I.S. // event-driven commentary log and boot sequence.
   Real events drive TEMPLATES; AMBIENT only fills genuine silence, and every
   ambient line is tagged so the log stays auditable. */
(() => {
  "use strict";

  const Y = window.YARVIS;
  const { $, cleanText } = Y.util;

  const MAX_LINES = 40;
  const AMBIENT_AFTER_MS = 25000;
  const TYPE_MS = 18;

  const TEMPLATES = {
    "link:live": "Host telemetry channel synchronised, sir.",
    "link:stale": "Telemetry has gone quiet. Retrying.",
    "link:waiting": "Awaiting a host link.",
    "cpu:spike": (v) => `Processor load elevated, ${Math.round(Number(v) || 0)} per cent.`,
    "cpu:clear": "Processor load has settled.",
    "gpu:spike": (v) => `Graphics load elevated, ${Math.round(Number(v) || 0)} per cent.`,
    "gpu:clear": "Graphics load has settled.",
    "ram:pressure": "Memory headroom is running thin.",
    "ram:clear": "Memory headroom recovered.",
    "net:burst": "Notable traffic on the network bus.",
    "media:change": (m) => `Media uplink acquired: ${(m && m.title) || "unknown track"}.`,
    "media:standby": "Media uplink returned to standby.",
    "battery:low": "Power cell below twenty per cent, sir.",
    "battery:charging": "Power cell is charging.",
    "alert:change": (p) =>
      p && p.to === "CRITICAL"
        ? "Systems under considerable strain."
        : p && p.to === "IDLE"
          ? "Drifting to low power. Do wake me."
          : `System status: ${p && p.to ? p.to.toLowerCase() : "nominal"}.`
  };

  const AMBIENT = [
    "Routine diagnostic sweep complete.",
    "All subsystems nominal.",
    "Holding station.",
    "Nothing further to report, sir.",
    "Interface integrity verified.",
    "Standing by."
  ];

  const BOOT_STEPS = [
    "Initialising cognitive interface",
    "Mounting holographic renderer",
    "Negotiating host telemetry channel",
    "Arming audio spectrum analyser",
    "Calibrating reactor geometry",
    "Interface ready"
  ];

  let lastRealEventAt = 0;
  let lastAmbientIndex = -1;
  let booted = false;

  const P = (Y.persona = {
    lines: [],

    lineFor(event, payload) {
      const template = TEMPLATES[event];
      if (template === undefined) return null;
      return typeof template === "function" ? template(payload) : template;
    },

    say(text, kind = "event") {
      if (!Y.settings.personaLog) return;
      const clean = cleanText(text, "", 160);
      if (!clean) return;

      // A butler does not repeat himself. Repeated events within a minute
      // (recurring net bursts, a flapping link) collapse onto the last line.
      const previous = P.lines[P.lines.length - 1];
      if (previous && previous.text === clean && Date.now() - previous.at < 60000) {
        previous.at = Date.now();
        previous.repeats = (previous.repeats || 1) + 1;
        const host = $("personaLog");
        const lastRow = host && host.lastElementChild;
        if (lastRow) {
          let tally = lastRow.querySelector(".persona-tally");
          if (!tally) {
            tally = document.createElement("i");
            tally.className = "persona-tally";
            lastRow.appendChild(tally);
          }
          tally.textContent = `×${previous.repeats}`;
        }
        return;
      }

      P.lines.push({ text: clean, kind, at: Date.now() });
      while (P.lines.length > MAX_LINES) P.lines.shift();

      const host = $("personaLog");
      if (!host) return;

      const row = document.createElement("div");
      row.className = `persona-line persona-${kind}`;
      const stamp = document.createElement("span");
      stamp.className = "persona-stamp";
      stamp.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const body = document.createElement("b");
      body.className = "persona-text";
      row.appendChild(stamp);
      row.appendChild(body);
      host.appendChild(row);
      while (host.childElementCount > MAX_LINES) host.removeChild(host.firstElementChild);
      typewrite(body, clean);
      host.scrollTop = host.scrollHeight;
    },

    update(now) {
      if (!Y.settings.personaLog) return;
      if (!lastRealEventAt) lastRealEventAt = now;
      if (now - lastRealEventAt < AMBIENT_AFTER_MS) return;
      lastRealEventAt = now;
      let index = Math.floor(Math.random() * AMBIENT.length);
      if (index === lastAmbientIndex) index = (index + 1) % AMBIENT.length;
      lastAmbientIndex = index;
      P.say(AMBIENT[index], "ambient");
    },

    init() {
      for (const event of Object.keys(TEMPLATES)) {
        Y.bus.on(event, (payload) => {
          const line = P.lineFor(event, payload);
          if (!line) return;
          lastRealEventAt = performance.now();
          const critical = event === "alert:change" && payload && payload.to === "CRITICAL";
          P.say(line, critical ? "alert" : "event");
        });
      }

      if (!Y.settings.bootSequence) {
        finishBoot();
        return;
      }
      runBootSequence();
    }
  });

  function typewrite(el, text) {
    // Cheap per-character reveal; one timer per line, cleared when it completes.
    let i = 0;
    el.textContent = "";
    const tick = () => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i < text.length) window.setTimeout(tick, TYPE_MS);
    };
    tick();
  }

  function runBootSequence() {
    const overlay = $("bootOverlay");
    const log = $("bootOverlayLog");
    if (!overlay || !log) {
      finishBoot();
      return;
    }

    overlay.classList.add("visible");
    let step = 0;

    const next = () => {
      if (step >= BOOT_STEPS.length) {
        window.setTimeout(() => {
          overlay.classList.remove("visible");
          overlay.classList.add("dismissed");
          finishBoot();
        }, 420);
        return;
      }
      const row = document.createElement("div");
      row.className = "boot-line";
      const flag = document.createElement("span");
      flag.textContent = "[ OK ]";
      row.appendChild(flag);
      row.appendChild(document.createTextNode(` ${BOOT_STEPS[step]}`));
      log.appendChild(row);
      step += 1;
      window.setTimeout(next, 260);
    };

    next();
  }

  function finishBoot() {
    if (booted) return;
    booted = true;
    lastRealEventAt = performance.now();
    Y.bus.emit("boot:complete");
  }
})();
