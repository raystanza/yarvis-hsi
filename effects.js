/* Y.A.R.V.I.S. // reactive alert state machine and reactor spectacle layers.
   Every layer is budgeted by Y.budget(); MINIMAL zeroes all of them. */
(() => {
  "use strict";

  const Y = window.YARVIS;
  const { clamp, lerp, hexToRgb, rgba } = Y.util;

  /* ------------------------------------------------- alert state machine */

  const DWELL_MS = 4000;
  const IDLE_MS = 90000;
  const STRESS_TAU_MS = 420;

  Y.alerts = {
    state: "NOMINAL",
    stress: 0,
    clock: 0,
    _since: 0,
    _quiet: 0,

    reset() {
      this.state = "NOMINAL";
      this.stress = 0;
      this.clock = 0;
      this._since = 0;
      this._quiet = 0;
      if (document.body) document.body.dataset.alert = "NOMINAL";
    },

    update(dt, now) {
      this.clock = typeof now === "number" ? now : this.clock + dt;
      const t = Y.telemetry;
      // Peak subsystem load sets the floor, so a pegged CPU alone still reads as
      // strain; simultaneous pressure elsewhere pushes it the rest of the way up.
      const peak = Math.max(t.cpu, t.gpu, t.ram);
      const others = (t.cpu + t.gpu + t.ram - peak) / 2;
      const raw = clamp(peak + (100 - peak) * (others / 100) * 0.5, 0, 100);
      // Smooth against elapsed time, not frame count: the user can pick 20-60
      // FPS, and the alert thresholds must not shift with that setting.
      this.stress = lerp(this.stress, raw, 1 - Math.exp(-Math.max(0, dt) / STRESS_TAU_MS));

      if (!Y.settings.alertStates) {
        this._transition("NOMINAL");
        return;
      }

      const quiet = this.stress < 12 && !Y.media.active && Y.audio.level < 0.035;
      this._quiet = quiet ? this._quiet + dt : 0;

      // Hysteresis: CRITICAL holds until 78, ELEVATED holds until 60.
      let want = "NOMINAL";
      if (this.stress > 88) want = "CRITICAL";
      else if (this.state === "CRITICAL" && this.stress >= 78) want = "CRITICAL";
      else if (this.stress > 70) want = "ELEVATED";
      else if (this.state === "ELEVATED" && this.stress >= 60) want = "ELEVATED";
      else if (this._quiet > IDLE_MS) want = "IDLE";

      if (want !== this.state && this.clock - this._since >= DWELL_MS) this._transition(want);
    },

    _transition(to) {
      if (to === this.state) return;
      const from = this.state;
      this.state = to;
      this._since = this.clock;
      if (document.body) document.body.dataset.alert = to;
      Y.bus.emit("alert:change", { from, to });
    }
  };

  Y.alerts.reset();

  /* ----------------------------------------------------- spectacle layers */

  const ARC_LIFE = 420;
  const RING_LIFE = 1400;
  const GLITCH_COOLDOWN = 400;

  let globeCache = { count: -1, points: [] };
  let globeSpin = 0;
  let lastGlitchAt = 0;
  let klaxonTimer = 0;

  const E = (Y.effects = {
    arcs: [],
    rings: [],

    enabled() {
      return Boolean(Y.settings.reactorSpectacle);
    },

    spawnArc() {
      const budget = Y.budget();
      if (!E.enabled() || !budget.arcs) return;
      if (E.arcs.length >= budget.arcs) return;

      // A jagged polyline in normalised radius space; geometry is applied at draw time.
      const startAngle = Math.random() * Math.PI * 2;
      const spread = (Math.random() - 0.5) * 1.1;
      const segments = 7 + Math.floor(Math.random() * 5);
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const k = i / segments;
        points.push({
          angle: startAngle + spread * k + (Math.random() - 0.5) * 0.09,
          radius: lerp(0.5, 1.2, k) + (Math.random() - 0.5) * 0.06
        });
      }
      E.arcs.push({ points, life: ARC_LIFE, max: ARC_LIFE });
    },

    spawnRing() {
      const budget = Y.budget();
      if (!E.enabled() || !budget.klaxon) return;
      if (E.rings.length >= budget.klaxon) return;
      E.rings.push({ life: RING_LIFE, max: RING_LIFE });
    },

    glitchBurst(strength) {
      if (!E.enabled()) return;
      const budget = Y.budget();
      if (!budget.glitch) return;
      const now = performance.now();
      if (now - lastGlitchAt < GLITCH_COOLDOWN) return;
      lastGlitchAt = now;
      const layer = document.getElementById("glitchLayer");
      if (!layer) return;
      const amount = clamp(strength, 0, 1) * budget.glitch;
      layer.style.setProperty("--glitch-amount", amount.toFixed(3));
      layer.classList.remove("glitch-active");
      // Force a reflow so the animation restarts on rapid repeats.
      void layer.offsetWidth;
      layer.classList.add("glitch-active");
      window.setTimeout(() => layer.classList.remove("glitch-active"), 180);
    },

    applyVortex(particles, dt) {
      const budget = Y.budget();
      if (!E.enabled() || !budget.vortex || !particles || !particles.length) return;
      const geo = Y.render.geometry();
      if (!geo.base) return;

      const reach = geo.base * 2.2;
      const pull = budget.vortex * 0.0000085 * dt;
      for (const p of particles) {
        const dx = geo.cx - p.x;
        const dy = geo.cy - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist > reach) continue;
        const falloff = 1 - dist / reach;
        const nx = dx / dist, ny = dy / dist;
        // Inward pull plus a tangential component gives the spiral.
        p.vx += (nx * 0.55 - ny * 0.85) * pull * falloff * 60;
        p.vy += (ny * 0.55 + nx * 0.85) * pull * falloff * 60;
        p.vx = clamp(p.vx, -0.5, 0.5);
        p.vy = clamp(p.vy, -0.5, 0.5);
      }
    },

    drawUnder(ctx, geo, dt) {
      if (!ctx || !geo || !geo.base) {
        E.rings.length = 0;
        return;
      }
      if (!E.enabled()) {
        E.rings.length = 0;
        return;
      }

      const budget = Y.budget();
      const t = Y.theme();
      const critical = Y.alerts.state === "CRITICAL";

      // Klaxon rings pulse outward only while the host is genuinely struggling.
      if (critical && budget.klaxon) {
        klaxonTimer -= dt;
        if (klaxonTimer <= 0) {
          klaxonTimer = 620;
          E.spawnRing();
        }
      } else {
        klaxonTimer = 0;
      }

      const warn = hexToRgb(t.warn);
      for (let i = E.rings.length - 1; i >= 0; i--) {
        const ring = E.rings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          E.rings.splice(i, 1);
          continue;
        }
        const k = 1 - ring.life / ring.max;
        const r = geo.base * (0.3 + k * 1.5);
        ctx.save();
        ctx.strokeStyle = rgba(warn, (1 - k) * 0.32);
        ctx.lineWidth = 2 + (1 - k) * 2;
        ctx.beginPath();
        ctx.arc(geo.cx, geo.cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },

    drawOver(ctx, geo, dt) {
      if (!ctx || !geo || !geo.base) {
        E.arcs.length = 0;
        return;
      }
      if (!E.enabled()) {
        E.arcs.length = 0;
        return;
      }

      const budget = Y.budget();
      const t = Y.theme();

      // At CRITICAL the arcs become continuous rather than incidental.
      if (Y.alerts.state === "CRITICAL" && budget.arcs && Math.random() < 0.22) E.spawnArc();

      const hot = hexToRgb(t.hot);
      const accent = hexToRgb(t.accent);

      for (let i = E.arcs.length - 1; i >= 0; i--) {
        const arc = E.arcs[i];
        arc.life -= dt;
        if (arc.life <= 0) {
          E.arcs.splice(i, 1);
          continue;
        }
        const k = arc.life / arc.max;
        ctx.save();
        ctx.globalAlpha = k * 0.85;
        ctx.lineWidth = 1 + k * 1.4;
        ctx.strokeStyle = k > 0.6 ? rgba(hot, 0.9) : rgba(accent, 0.75);
        ctx.shadowColor = t.accent;
        ctx.shadowBlur = (8 * Y.settings.glow) / 100;
        ctx.beginPath();
        arc.points.forEach((pt, idx) => {
          const x = geo.cx + Math.cos(pt.angle) * geo.base * pt.radius;
          const y = geo.cy + Math.sin(pt.angle) * geo.base * pt.radius;
          if (idx) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      }
    },

    drawGlobe(ctx, geo, dt, t) {
      const budget = Y.budget();
      if (!E.enabled() || !budget.globePoints || !geo.base) return;

      if (globeCache.count !== budget.globePoints) globeCache = buildGlobe(budget.globePoints);

      globeSpin += dt * 0.00042 * (Y.settings.animationSpeed / 100);
      const radius = geo.base * 0.19;
      const cos = Math.cos(globeSpin), sin = Math.sin(globeSpin);
      const tiltCos = Math.cos(0.42), tiltSin = Math.sin(0.42);
      const accent = hexToRgb(t.hot);

      ctx.save();
      for (const p of globeCache.points) {
        // Spin about the vertical axis, then apply a fixed tilt.
        const x1 = p.x * cos - p.z * sin;
        const z1 = p.x * sin + p.z * cos;
        const y2 = p.y * tiltCos - z1 * tiltSin;
        const z2 = p.y * tiltSin + z1 * tiltCos;
        // Orthographic projection; depth only drives brightness.
        const depth = (z2 + 1) * 0.5;
        ctx.fillStyle = rgba(accent, 0.1 + depth * 0.5);
        const size = 0.6 + depth * 1.1;
        ctx.fillRect(geo.cx + x1 * radius - size / 2, geo.cy + y2 * radius - size / 2, size, size);
      }
      ctx.restore();
    }
  });

  function buildGlobe(count) {
    // Fibonacci sphere: even coverage without clustering at the poles.
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / Math.max(1, count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
    }
    return { count, points };
  }

  /* -------------------------------------------------------- subscriptions */

  Y.bus.on("audio:beat", () => {
    const b = Y.budget();
    if (b.arcs && Math.random() < 0.25 + b.glitch * 0.3) E.spawnArc();
  });
  Y.bus.on("cpu:spike", () => { E.spawnArc(); E.glitchBurst(0.6); });
  Y.bus.on("gpu:spike", () => { E.spawnArc(); E.glitchBurst(0.6); });
  Y.bus.on("alert:change", (p) => { if (p && p.to === "CRITICAL") E.glitchBurst(1); });
})();
