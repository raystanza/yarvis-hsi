/* Y.A.R.V.I.S. // canvas pipeline: background, grid, particles, reactor core. */
(() => {
  "use strict";

  const Y = window.YARVIS;
  const { clamp, hexToRgb, rgba } = Y.util;

  let fx = null;
  let ctx = null;

  const R = (Y.render = {
    particles: [],

    attach(canvas) {
      fx = canvas;
      ctx = fx ? fx.getContext("2d", { alpha: false }) : null;
    },

    resize() {
      if (!fx || !ctx) return;
      const v = Y.view;
      v.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      v.width = Math.max(320, window.innerWidth);
      v.height = Math.max(240, window.innerHeight);
      fx.width = Math.floor(v.width * v.dpr);
      fx.height = Math.floor(v.height * v.dpr);
      fx.style.width = `${v.width}px`;
      fx.style.height = `${v.height}px`;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      R.makeParticles();
    },

    makeParticles() {
      const { width, height } = Y.view;
      const count = Math.round(clamp((width * height) / 26000, 40, 150));
      R.particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.035,
        vy: (Math.random() - 0.5) * 0.025,
        a: 0.08 + Math.random() * 0.24,
        s: 0.5 + Math.random() * 1.4,
        p: Math.random() * Math.PI * 2
      }));
    },

    geometry() {
      const cx = Y.view.width / 2;
      const availableH = Y.view.height - Y.settings.topSafeArea;
      const cy = Y.settings.topSafeArea + availableH * 0.54;
      const base = Math.min(Y.view.width * 0.205, availableH * 0.39);
      return { cx, cy, base };
    },

    ringTicks(cx, cy, radius, count, rotation, inner, outer, color, alpha = 1, majorEvery = 8) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count;
        const len = i % majorEvery === 0 ? outer : inner;
        ctx.moveTo(Math.cos(a) * (radius - len), Math.sin(a) * (radius - len));
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      ctx.stroke();
      ctx.restore();
    },

    arcSegment(cx, cy, r, start, end, color, widthPx, alpha = 1) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = widthPx;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
      ctx.restore();
    },

    frame(dt) {
      if (!ctx) return;
      const t = Y.theme();
      const bg = hexToRgb(t.bg);
      const accent = hexToRgb(t.accent);
      const { width, height } = Y.view;

      // Complete opaque repaint every frame; no persistent ghosting.
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;

      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, `rgb(${bg.r},${bg.g},${bg.b})`);
      g.addColorStop(0.5, `rgb(${Math.min(255, bg.r + 1)},${Math.min(255, bg.g + 4)},${Math.min(255, bg.b + 8)})`);
      g.addColorStop(1, `rgb(${bg.r},${bg.g},${bg.b})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      drawGrid(accent);
      drawParticles(dt, accent);

      const geo = R.geometry();
      if (Y.effects && Y.effects.drawUnder) Y.effects.drawUnder(ctx, geo, dt);
      drawCore(dt, t, geo);
      if (Y.effects && Y.effects.drawOver) Y.effects.drawOver(ctx, geo, dt);
      drawScanner(t, geo);
    }
  });

  function drawGrid(accent) {
    if (!Y.settings.grid) return;
    const { width, height } = Y.view;
    const grid = Math.max(48, Math.min(76, width / 28));
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(accent, 0.045);
    ctx.beginPath();
    for (let x = (width % grid) * 0.5; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = (height % grid) * 0.5; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    ctx.strokeStyle = rgba(accent, 0.075);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(dt, accent) {
    if (!Y.settings.particles) return;
    const { width, height } = Y.view;
    const speed = Y.settings.animationSpeed / 100;
    // The vortex layer nudges velocities before we integrate them.
    if (Y.effects && Y.effects.applyVortex) Y.effects.applyVortex(R.particles, dt);
    ctx.save();
    for (const p of R.particles) {
      p.x += p.vx * dt * speed;
      p.y += p.vy * dt * speed;
      p.p += dt * 0.0008;
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;
      const alpha = p.a * (0.65 + 0.35 * Math.sin(p.p));
      ctx.fillStyle = rgba(accent, alpha);
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();
  }

  function drawCore(dt, t, geo) {
    const accent = hexToRgb(t.accent), accent2 = hexToRgb(t.accent2), hot = hexToRgb(t.hot);
    const { cx, cy, base } = geo;
    const speed = Y.settings.animationSpeed / 100;
    Y.view.phase += dt * 0.00032 * speed;
    const phase = Y.view.phase;

    const sensitivity = Y.settings.audioSensitivity / 100;
    const reactive = Y.settings.audioReactive ? Y.audio.level * sensitivity : 0;
    const beat = Y.settings.audioReactive ? Y.audio.bands.beat : 0;
    const pulse = 1 + reactive * 0.047 + beat * 0.045 + Math.sin(phase * 2.4) * 0.004;

    // Wide, barely-visible radial glow.
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.7);
    rg.addColorStop(0, rgba(accent, 0.075 + reactive * 0.08 + beat * 0.055));
    rg.addColorStop(0.42, rgba(accent2, 0.026));
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, base * 1.7, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);

    // Outer segmented architecture.
    R.ringTicks(cx, cy, base * 1.28, 96, phase * 0.15, 6, 13, t.accent, 0.26, 6);
    R.ringTicks(cx, cy, base * 1.16, 72, -phase * 0.23, 5, 10, t.accent, 0.19, 9);
    R.arcSegment(cx, cy, base * 1.22, phase * 0.5, phase * 0.5 + 1.1, t.accent, 2, 0.46);
    R.arcSegment(cx, cy, base * 1.22, phase * 0.5 + 2.0, phase * 0.5 + 2.58, t.hot, 1, 0.65);
    R.arcSegment(cx, cy, base * 1.22, phase * 0.5 + 3.55, phase * 0.5 + 5.3, t.accent2, 3, 0.30);
    R.arcSegment(cx, cy, base * 1.08, -phase * 0.38 + 0.2, -phase * 0.38 + 1.45, t.accent, 4, 0.27);
    R.arcSegment(cx, cy, base * 1.08, -phase * 0.38 + 2.2, -phase * 0.38 + 3.0, t.hot, 1, 0.48);
    R.arcSegment(cx, cy, base * 1.08, -phase * 0.38 + 4.0, -phase * 0.38 + 5.72, t.accent2, 2, 0.24);

    // Compass spokes.
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(phase * 0.05);
    ctx.strokeStyle = rgba(accent, 0.09); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.moveTo(Math.cos(a) * base * 0.72, Math.sin(a) * base * 0.72);
      ctx.lineTo(Math.cos(a) * base * 1.04, Math.sin(a) * base * 1.04);
    }
    ctx.stroke(); ctx.restore();

    // Audio radial spectrum.
    if (Y.settings.audioReactive) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2 + phase * 0.04);
      for (let i = 0; i < 64; i++) {
        const v = clamp((Y.audio.bins[i * 2] || 0) * sensitivity, 0, 1.35);
        const a = (i * Math.PI * 2) / 64;
        const r0 = base * 0.73, r1 = r0 + 5 + v * base * 0.16;
        ctx.strokeStyle = rgba(accent, 0.12 + v * 0.38);
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Inner rotating target rings.
    R.ringTicks(cx, cy, base * 0.66, 48, -phase * 0.7, 5, 12, t.accent, 0.55, 4);
    R.arcSegment(cx, cy, base * 0.60, phase * 0.85, phase * 0.85 + 1.55, t.hot, 2, 0.58);
    R.arcSegment(cx, cy, base * 0.60, phase * 0.85 + 2.15, phase * 0.85 + 3.55, t.accent, 5, 0.26);
    R.arcSegment(cx, cy, base * 0.49, -phase * 1.05 + 0.4, -phase * 1.05 + 1.65, t.accent2, 4, 0.42);
    R.arcSegment(cx, cy, base * 0.49, -phase * 1.05 + 2.5, -phase * 1.05 + 5.0, t.accent, 1, 0.52);

    // Four orbital nodes.
    for (let i = 0; i < 4; i++) {
      const a = phase * (i % 2 ? -0.42 : 0.55) + (i * Math.PI) / 2;
      const rr = base * (0.86 + (i % 2) * 0.08);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      ctx.fillStyle = rgba(hot, 0.9);
      ctx.shadowColor = t.accent;
      ctx.shadowBlur = (10 * Y.settings.glow) / 100;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.shadowBlur = 0;
    }

    // Reactor nucleus.
    const coreR = base * 0.255;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    cg.addColorStop(0, rgba(hot, 0.28 + reactive * 0.24));
    cg.addColorStop(0.24, rgba(accent, 0.13));
    cg.addColorStop(0.62, rgba(accent2, 0.055));
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
    R.ringTicks(cx, cy, coreR * 0.92, 32, phase * 1.25, 4, 10, t.hot, 0.52, 4);
    R.arcSegment(cx, cy, coreR * 0.72, -phase * 1.55, -phase * 1.55 + 2.15, t.accent, 2, 0.68);
    R.arcSegment(cx, cy, coreR * 0.72, -phase * 1.55 + 3.1, -phase * 1.55 + 5.65, t.hot, 1, 0.55);

    // The wireframe globe sits inside the nucleus, under the scaled group.
    if (Y.effects && Y.effects.drawGlobe) Y.effects.drawGlobe(ctx, { cx, cy, base }, dt, t);

    ctx.restore();
  }

  function drawScanner(t, geo) {
    const accent = hexToRgb(t.accent);
    const { cx, cy, base } = geo;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Y.view.phase * 0.34);
    const grad = ctx.createLinearGradient(0, 0, base * 1.17, 0);
    grad.addColorStop(0, rgba(accent, 0));
    grad.addColorStop(0.65, rgba(accent, 0.018));
    grad.addColorStop(1, rgba(accent, 0.08));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, base * 1.16, -0.055, 0.055);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
})();
