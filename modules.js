/* Y.A.R.V.I.S. // cycling module deck.
   Every widget renders from data Lively actually supplies, the audio array,
   media metadata, or browser APIs. Nothing here invents a hardware reading. */
(() => {
  "use strict";

  const Y = window.YARVIS;
  const { clamp, hexToRgb, rgba, $ } = Y.util;

  const CYCLE_MS = 20000;
  const CONTACT_CAP = 12;
  const CONTACT_LIFE = 12000;

  const MIN_DECK_H = 62;

  let radarSweep = 0;

  // Space the stack has left once its fixed panels are laid out. Computed from
  // siblings so it stays correct while the deck itself is hidden.
  function leftoverFor(panel) {
    const stack = panel.parentElement;
    if (!stack) return 0;
    const gap = parseFloat(getComputedStyle(stack).rowGap) || 0;
    let used = 0, siblings = 0;
    for (const child of stack.children) {
      if (child === panel) continue;
      used += child.getBoundingClientRect().height;
      siblings += 1;
    }
    return stack.clientHeight - used - gap * siblings;
  }

  function prep(canvas) {
    const ctx = canvas.getContext("2d");
    // Match the backing store to the CSS box so the deck is not drawn stretched.
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth || canvas.width));
    const h = Math.max(1, Math.round(canvas.clientHeight || canvas.height));
    const rw = Math.floor(w * ratio), rh = Math.floor(h * ratio);
    if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h, accent: hexToRgb(Y.theme().accent), hot: hexToRgb(Y.theme().hot) };
  }

  function frameGrid(ctx, w, h, accent) {
    ctx.strokeStyle = rgba(accent, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y <= h; y += h / 4) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    for (let x = 0; x <= w; x += w / 8) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();
  }

  const M = (Y.modules = {
    contacts: [],
    deck: { left: { index: 0, elapsed: 0 }, right: { index: 0, elapsed: 0 } },

    registry: [
      {
        id: "radar",
        side: "left",
        title: "NETWORK ACTIVITY",
        render(canvas, dt) {
          const { ctx, w, h, accent, hot } = prep(canvas);
          // The deck box is wide and short, so anchor the scope to the left and
          // give the remaining width to a bearing readout rather than dead space.
          const radius = Math.min(w * 0.42, h * 0.46);
          const cx = radius + 8, cy = h / 2;

          ctx.strokeStyle = rgba(accent, 0.18);
          ctx.lineWidth = 1;
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(cx, cy, (radius * i) / 3, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
          ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
          ctx.stroke();

          radarSweep += dt * 0.0013;
          const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(radarSweep) * radius, cy + Math.sin(radarSweep) * radius);
          grad.addColorStop(0, rgba(accent, 0.35));
          grad.addColorStop(1, rgba(accent, 0));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(radarSweep) * radius, cy + Math.sin(radarSweep) * radius);
          ctx.stroke();

          for (const c of M.contacts) {
            const k = c.life / CONTACT_LIFE;
            const x = cx + Math.cos(c.angle) * radius * c.dist;
            const y = cy + Math.sin(c.angle) * radius * c.dist;
            ctx.fillStyle = rgba(hot, clamp(k, 0, 1) * 0.9);
            ctx.fillRect(x - 2, y - 2, 4, 4);
            ctx.strokeStyle = rgba(accent, clamp(k, 0, 1) * 0.4);
            ctx.beginPath();
            ctx.arc(x, y, 6 + (1 - k) * 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Bearing strip: one decaying bar per live contact, newest at the top.
          const stripX = cx + radius + 14;
          const stripW = w - stripX - 8;
          if (stripW > 40) {
            ctx.font = "9px monospace";
            ctx.fillStyle = rgba(accent, 0.75);
            ctx.fillText(`BURST CONTACTS ${String(M.contacts.length).padStart(2, "0")}`, stripX, 11);
            const rowH = Math.max(4, Math.min(9, (h - 20) / CONTACT_CAP));
            M.contacts.slice(-Math.floor((h - 18) / rowH)).forEach((c, i) => {
              const k = clamp(c.life / CONTACT_LIFE, 0, 1);
              const y = 18 + i * rowH;
              ctx.fillStyle = rgba(accent, 0.14);
              ctx.fillRect(stripX, y, stripW, rowH - 2);
              ctx.fillStyle = rgba(hot, 0.25 + k * 0.55);
              ctx.fillRect(stripX, y, stripW * k, rowH - 2);
            });
          } else {
            ctx.fillStyle = rgba(accent, 0.75);
            ctx.font = "10px monospace";
            ctx.fillText(String(M.contacts.length).padStart(2, "0"), w - 20, h - 6);
          }
        }
      },
      {
        id: "memmap",
        side: "left",
        title: "MEMORY MAP",
        render(canvas) {
          const { ctx, w, h, accent, hot } = prep(canvas);
          // Keep cells legible: pick the row count from the height available.
          const gridH = h - 22;
          const rows = clamp(Math.floor(gridH / 7), 3, 10);
          const cols = 24;
          const cellW = (w - 16) / cols, cellH = gridH / rows;
          const total = cols * rows;
          const used = Math.round((clamp(Y.telemetry.ram, 0, 100) / 100) * total);

          for (let i = 0; i < total; i++) {
            const x = 8 + (i % cols) * cellW;
            const y = 4 + Math.floor(i / cols) * cellH;
            const filled = i < used;
            ctx.fillStyle = filled ? rgba(hot, 0.28 + (i / total) * 0.4) : rgba(accent, 0.08);
            ctx.fillRect(x, y, cellW - 2, cellH - 2);
          }

          ctx.fillStyle = rgba(accent, 0.8);
          ctx.font = "10px monospace";
          const detail = Y.telemetry.ramTotal > 0
            ? `${(Y.telemetry.ramUsed / 1024).toFixed(1)} / ${(Y.telemetry.ramTotal / 1024).toFixed(1)} GB`
            : "AWAITING HOST";
          ctx.fillText(`${detail}   ${Y.telemetry.ram.toFixed(1)}%`, 8, h - 8);
        }
      },
      {
        id: "spectrum",
        side: "right",
        title: "SPECTRUM ANALYSER",
        render(canvas) {
          const { ctx, w, h, accent, hot } = prep(canvas);
          frameGrid(ctx, w, h, accent);

          const bins = Y.audio.bins;
          const count = Math.min(128, bins.length);
          const barW = w / count;
          const sensitivity = Y.settings.audioSensitivity / 100;

          for (let i = 0; i < count; i++) {
            const v = Y.settings.audioReactive ? clamp((Number(bins[i]) || 0) * sensitivity, 0, 1) : 0;
            const barH = v * (h - 18);
            ctx.fillStyle = i % 8 === 0 ? rgba(hot, 0.5 + v * 0.5) : rgba(accent, 0.25 + v * 0.6);
            ctx.fillRect(i * barW, h - 14 - barH, Math.max(1, barW - 1), barH);
          }

          ctx.fillStyle = rgba(accent, 0.75);
          ctx.font = "10px monospace";
          const label = !Y.settings.audioReactive ? "AUDIO DISABLED"
            : !Y.audio.sourceSeen ? "AWAITING AUDIO SOURCE"
              : `LOW ${(Y.audio.bands.low * 100).toFixed(0)}  MID ${(Y.audio.bands.mid * 100).toFixed(0)}  HIGH ${(Y.audio.bands.high * 100).toFixed(0)}`;
          ctx.fillText(label, 6, h - 3);
        }
      },
      {
        id: "histogram",
        side: "right",
        title: "LOAD HISTOGRAM",
        render(canvas) {
          const { ctx, w, h, accent, hot } = prep(canvas);
          frameGrid(ctx, w, h, accent);

          const plot = (arr, color, width) => {
            if (!arr || arr.length < 2) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            arr.forEach((v, i) => {
              const x = (i / Math.max(1, arr.length - 1)) * w;
              const y = h - 16 - (clamp(v, 0, 100) / 100) * (h - 26);
              if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
            ctx.stroke();
          };

          plot(Y.history.cpu, rgba(hot, 0.85), 1.6);
          plot(Y.history.gpu, rgba(accent, 0.6), 1.2);

          const cpu = Y.history.cpu;
          ctx.fillStyle = rgba(accent, 0.75);
          ctx.font = "10px monospace";
          if (cpu.length) {
            const min = Math.min(...cpu), max = Math.max(...cpu);
            const mean = cpu.reduce((a, b) => a + b, 0) / cpu.length;
            ctx.fillText(`CPU MIN ${min.toFixed(0)}  MEAN ${mean.toFixed(0)}  MAX ${max.toFixed(0)}`, 6, h - 3);
          } else {
            ctx.fillText("SAMPLING", 6, h - 3);
          }
        }
      },
      {
        id: "chromatics",
        side: "right",
        title: "MEDIA CHROMATICS",
        render(canvas) {
          const { ctx, w, h, accent } = prep(canvas);
          const swatches = sampleArtwork();

          if (!swatches.length) {
            ctx.fillStyle = rgba(accent, 0.6);
            ctx.font = "10px monospace";
            ctx.fillText(Y.media.active ? "NO ALBUM ART IN PAYLOAD" : "MEDIA UPLINK STANDBY", 8, h / 2);
            return;
          }

          const bandW = w / swatches.length;
          swatches.forEach((c, i) => {
            ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
            ctx.fillRect(i * bandW, 8, bandW - 2, h - 34);
          });

          ctx.fillStyle = rgba(accent, 0.8);
          ctx.font = "10px monospace";
          ctx.fillText(`DOMINANT ${swatches.length} // ${(Y.media.title || "UNTITLED").slice(0, 24).toUpperCase()}`, 8, h - 8);
        }
      }
    ],

    advance(side) {
      const pool = M.registry.filter((m) => m.side === side);
      if (!pool.length) return;
      const slot = M.deck[side];
      slot.index = (slot.index + 1) % pool.length;
      slot.elapsed = 0;

      const canvas = $(side === "left" ? "deckLeft" : "deckRight");
      const title = $(side === "left" ? "deckLeftTitle" : "deckRightTitle");
      if (title) title.textContent = pool[slot.index].title;
      if (canvas) {
        canvas.classList.remove("deck-swap");
        void canvas.offsetWidth;
        canvas.classList.add("deck-swap");
      }
    },

    current(side) {
      const pool = M.registry.filter((m) => m.side === side);
      if (!pool.length) return null;
      return pool[M.deck[side].index % pool.length];
    },

    update(dt, now) {
      for (let i = M.contacts.length - 1; i >= 0; i--) {
        M.contacts[i].life -= dt;
        if (M.contacts[i].life <= 0) M.contacts.splice(i, 1);
      }

      for (const side of ["left", "right"]) {
        const slot = M.deck[side];
        if (Y.settings.cyclingDeck) {
          slot.elapsed += dt;
          if (slot.elapsed >= CYCLE_MS) M.advance(side);
        }

        const canvas = $(side === "left" ? "deckLeft" : "deckRight");
        const mod = M.current(side);
        if (!canvas || !mod || !canvas.getContext) continue;

        // The deck only gets the stack's leftover space. Measure that from the
        // stack rather than from the canvas: once collapsed the canvas is
        // display:none, so reading its own height would latch it off forever.
        const panel = canvas.closest(".deck-panel");
        if (panel) {
          panel.classList.toggle("deck-collapsed", leftoverFor(panel) < MIN_DECK_H);
          if (panel.classList.contains("deck-collapsed")) continue;
        }
        if (canvas.clientHeight < 1 || canvas.clientWidth < 1) continue;

        try {
          mod.render(canvas, dt);
        } catch (e) {
          console.error(`YARVIS module ${mod.id} failed`, e);
        }
      }
    },

    init() {
      for (const side of ["left", "right"]) {
        const mod = M.current(side);
        const title = $(side === "left" ? "deckLeftTitle" : "deckRightTitle");
        if (title && mod) title.textContent = mod.title;
      }
    }
  });

  function sampleArtwork() {
    const art = $("mediaArt");
    if (!art || !art.getAttribute("src") || !art.complete || !art.naturalWidth) return [];
    try {
      const off = document.createElement("canvas");
      off.width = 16; off.height = 16;
      const octx = off.getContext("2d");
      octx.drawImage(art, 0, 0, 16, 16);
      const data = octx.getImageData(0, 0, 16, 16).data;

      // Bucket into a coarse RGB cube and keep the most populated cells.
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const key = `${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`;
        const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        entry.r += data[i]; entry.g += data[i + 1]; entry.b += data[i + 2]; entry.n += 1;
        buckets.set(key, entry);
      }
      return [...buckets.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 6)
        .map((e) => ({ r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) }));
    } catch (_) {
      // Album art arrives as a data URI, but a tainted canvas would throw here.
      return [];
    }
  }

  Y.bus.on("net:burst", () => {
    if (M.contacts.length >= CONTACT_CAP) M.contacts.shift();
    M.contacts.push({
      angle: Math.random() * Math.PI * 2,
      dist: 0.25 + Math.random() * 0.7,
      life: CONTACT_LIFE
    });
  });
})();
