(() => {
  "use strict";

  const fx = document.getElementById("fxCanvas");
  const ctx = fx.getContext("2d", { alpha: false });
  const mini = document.getElementById("miniGraph");
  const mctx = mini.getContext("2d");

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const lerp = (a, b, t) => a + (b - a) * t;

  const themes = [
    { name: "Arc Cyan", accent: "#59e6ff", accent2: "#167dff", hot: "#effcff", bg: "#02070d", warn: "#ffc35a" },
    { name: "Deep Blue", accent: "#65aaff", accent2: "#3657ff", hot: "#f3f7ff", bg: "#02040b", warn: "#ffd36a" },
    { name: "Reactor Teal", accent: "#54ffe3", accent2: "#00a8b5", hot: "#edfffb", bg: "#010a0c", warn: "#ffe77a" },
    { name: "Amber Lab", accent: "#ffc967", accent2: "#ff7a21", hot: "#fff6df", bg: "#0a0602", warn: "#ffef9c" }
  ];

  const settings = {
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
    systemTitle: "J.A.R.V.I.S.",
    coreLabel: "J.A.R.V.I.S.",
    nodeLabel: "DESKTOP // PRIMARY"
  };

  const telemetry = {
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

  const media = {
    supported: false,
    active: false,
    title: "",
    artist: "",
    album: "",
    genre: "",
    playbackType: "",
    subtitle: "",
    track: 0,
    trackCount: 0,
    thumbnail: "",
    lastSeen: 0
  };

  const device = {
    cores: Number(navigator.hardwareConcurrency) || 0,
    locale: navigator.language || "unknown",
    timezone: "unknown",
    online: navigator.onLine !== false,
    battery: null,
    batterySupported: false,
    batteryInitialized: false,
    batteryError: false
  };

  const renderer = {
    fps: 0,
    frames: 0,
    sampleStart: performance.now()
  };

  try {
    device.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch (_) {
    device.timezone = "unknown";
  }

  let width = 1920, height = 1080, dpr = 1;
  let paused = false;
  let lastFrame = performance.now();
  let sessionStart = Date.now();
  let lastMiniSample = 0;
  let phase = 0;
  let audio = new Array(128).fill(0);
  let audioLevel = 0;
  let audioSourceSeen = false;
  let audioBeatFloor = 0;
  let lastBeatAt = 0;
  const audioBands = { low: 0, mid: 0, high: 0, beat: 0 };
  let particles = [];
  const history = { cpu: [], gpu: [], net: [] };

  function hexToRgb(hex) {
    const h = String(hex || "#59e6ff").replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h.padEnd(6, "0").slice(0,6);
    return {
      r: parseInt(full.slice(0,2),16) || 0,
      g: parseInt(full.slice(2,4),16) || 0,
      b: parseInt(full.slice(4,6),16) || 0
    };
  }

  function theme() {
    if (settings.theme === 4) {
      return { accent: settings.customAccent, accent2: settings.customAccent, hot: "#f4ffff", bg: settings.customBackground, warn: "#ffc35a" };
    }
    return themes[settings.theme] || themes[0];
  }

  function applyTheme() {
    const t = theme();
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-2", t.accent2);
    root.setProperty("--hot", t.hot);
    root.setProperty("--bg", t.bg);
    root.setProperty("--warn", t.warn);
    root.setProperty("--hud-opacity", String(settings.hudOpacity / 100));
    root.setProperty("--safe-top", `${settings.topSafeArea}px`);
    root.setProperty("--glow", String(settings.glow / 100));
    document.body.classList.toggle("no-scanlines", !settings.scanlines);
    document.body.classList.toggle("no-panels", !settings.showPanels);
    document.body.classList.toggle("low-glow", settings.glow < 45);
    $("systemTitle").textContent = settings.systemTitle;
    $("coreLabel").textContent = settings.coreLabel;
    $("nodeLabel").textContent = settings.nodeLabel;
  }

  function resize() {
    dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    width = Math.max(320, window.innerWidth);
    height = Math.max(240, window.innerHeight);
    fx.width = Math.floor(width * dpr);
    fx.height = Math.floor(height * dpr);
    fx.style.width = `${width}px`;
    fx.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeParticles();
    renderDeviceIdentity();
  }

  function makeParticles() {
    const count = Math.round(clamp((width * height) / 26000, 40, 150));
    particles = Array.from({length: count}, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - .5) * .035,
      vy: (Math.random() - .5) * .025,
      a: .08 + Math.random() * .24,
      s: .5 + Math.random() * 1.4,
      p: Math.random() * Math.PI * 2
    }));
  }

  function drawGrid(accent) {
    if (!settings.grid) return;
    const grid = Math.max(48, Math.min(76, width / 28));
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},0.045)`;
    ctx.beginPath();
    for (let x = (width % grid) * .5; x < width; x += grid) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
    for (let y = (height % grid) * .5; y < height; y += grid) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},0.075)`;
    ctx.beginPath();
    ctx.moveTo(width/2,0); ctx.lineTo(width/2,height);
    ctx.moveTo(0,height/2); ctx.lineTo(width,height/2);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(dt, accent) {
    if (!settings.particles) return;
    const speed = settings.animationSpeed / 100;
    ctx.save();
    for (const p of particles) {
      p.x += p.vx * dt * speed; p.y += p.vy * dt * speed; p.p += dt * .0008;
      if (p.x < -10) p.x = width + 10; if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10; if (p.y > height + 10) p.y = -10;
      const alpha = p.a * (.65 + .35 * Math.sin(p.p));
      ctx.fillStyle = `rgba(${accent.r},${accent.g},${accent.b},${alpha})`;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();
  }

  function ringTicks(cx, cy, radius, count, rotation, inner, outer, color, alpha=1, majorEvery=8) {
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(rotation);
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i=0;i<count;i++) {
      const a = i * Math.PI * 2 / count;
      const len = i % majorEvery === 0 ? outer : inner;
      ctx.moveTo(Math.cos(a) * (radius-len), Math.sin(a) * (radius-len));
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.stroke(); ctx.restore();
  }

  function arcSegment(cx,cy,r,start,end,color,widthPx,alpha=1) {
    ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=alpha; ctx.lineWidth=widthPx; ctx.lineCap="butt";
    ctx.beginPath(); ctx.arc(cx,cy,r,start,end); ctx.stroke(); ctx.restore();
  }

  function drawCore(dt, t) {
    const accent = hexToRgb(t.accent), accent2 = hexToRgb(t.accent2), hot = hexToRgb(t.hot);
    const cx = width/2;
    const availableH = height - settings.topSafeArea;
    const cy = settings.topSafeArea + availableH * .54;
    const base = Math.min(width * .205, availableH * .39);
    const speed = settings.animationSpeed / 100;
    phase += dt * .00032 * speed;
    const reactive = settings.audioReactive ? audioLevel * (settings.audioSensitivity / 100) : 0;
    const beat = settings.audioReactive ? audioBands.beat : 0;
    const pulse = 1 + reactive * .047 + beat * .045 + Math.sin(phase*2.4) * .004;

    // Wide, barely-visible radial glow.
    const rg = ctx.createRadialGradient(cx,cy,0,cx,cy,base*1.7);
    rg.addColorStop(0,`rgba(${accent.r},${accent.g},${accent.b},${.075 + reactive*.08 + beat*.055})`);
    rg.addColorStop(.42,`rgba(${accent2.r},${accent2.g},${accent2.b},.026)`);
    rg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,base*1.7,0,Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(cx,cy); ctx.scale(pulse,pulse); ctx.translate(-cx,-cy);

    // Outer segmented architecture.
    ringTicks(cx,cy,base*1.28,96,phase*.15,6,13,t.accent,.26,6);
    ringTicks(cx,cy,base*1.16,72,-phase*.23,5,10,t.accent,.19,9);
    arcSegment(cx,cy,base*1.22,phase*.5,phase*.5+1.1,t.accent,2,.46);
    arcSegment(cx,cy,base*1.22,phase*.5+2.0,phase*.5+2.58,t.hot,1,.65);
    arcSegment(cx,cy,base*1.22,phase*.5+3.55,phase*.5+5.3,t.accent2,3,.30);
    arcSegment(cx,cy,base*1.08,-phase*.38+.2,-phase*.38+1.45,t.accent,4,.27);
    arcSegment(cx,cy,base*1.08,-phase*.38+2.2,-phase*.38+3.0,t.hot,1,.48);
    arcSegment(cx,cy,base*1.08,-phase*.38+4.0,-phase*.38+5.72,t.accent2,2,.24);

    // Compass spokes.
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(phase*.05); ctx.strokeStyle=`rgba(${accent.r},${accent.g},${accent.b},.09)`; ctx.lineWidth=1;
    ctx.beginPath();
    for (let i=0;i<12;i++) { const a=i*Math.PI/6; ctx.moveTo(Math.cos(a)*base*.72,Math.sin(a)*base*.72); ctx.lineTo(Math.cos(a)*base*1.04,Math.sin(a)*base*1.04); }
    ctx.stroke(); ctx.restore();

    // Audio radial spectrum.
    if (settings.audioReactive) {
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(-Math.PI/2 + phase*.04);
      for (let i=0;i<64;i++) {
        const v = clamp((audio[i*2] || 0) * settings.audioSensitivity/100,0,1.35);
        const a = i * Math.PI*2/64;
        const r0 = base*.73, r1 = r0 + 5 + v*base*.16;
        ctx.strokeStyle=`rgba(${accent.r},${accent.g},${accent.b},${.12+v*.38})`;
        ctx.lineWidth = i%4===0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0); ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1); ctx.stroke();
      }
      ctx.restore();
    }

    // Inner rotating target rings.
    ringTicks(cx,cy,base*.66,48,-phase*.7,5,12,t.accent,.55,4);
    arcSegment(cx,cy,base*.60,phase*.85,phase*.85+1.55,t.hot,2,.58);
    arcSegment(cx,cy,base*.60,phase*.85+2.15,phase*.85+3.55,t.accent,5,.26);
    arcSegment(cx,cy,base*.49,-phase*1.05+.4,-phase*1.05+1.65,t.accent2,4,.42);
    arcSegment(cx,cy,base*.49,-phase*1.05+2.5,-phase*1.05+5.0,t.accent,1,.52);

    // Four orbital nodes.
    for (let i=0;i<4;i++) {
      const a = phase*(i%2?-.42:.55) + i*Math.PI/2;
      const rr = base*(.86 + (i%2)*.08);
      const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr;
      ctx.fillStyle=`rgba(${hot.r},${hot.g},${hot.b},.9)`;
      ctx.shadowColor=t.accent; ctx.shadowBlur=10*settings.glow/100;
      ctx.fillRect(x-1.5,y-1.5,3,3);
      ctx.shadowBlur=0;
    }

    // Reactor nucleus.
    const coreR = base*.255;
    const cg = ctx.createRadialGradient(cx,cy,0,cx,cy,coreR);
    cg.addColorStop(0,`rgba(${hot.r},${hot.g},${hot.b},${.28+reactive*.24})`);
    cg.addColorStop(.24,`rgba(${accent.r},${accent.g},${accent.b},.13)`);
    cg.addColorStop(.62,`rgba(${accent2.r},${accent2.g},${accent2.b},.055)`);
    cg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(cx,cy,coreR,0,Math.PI*2); ctx.fill();
    ringTicks(cx,cy,coreR*.92,32,phase*1.25,4,10,t.hot,.52,4);
    arcSegment(cx,cy,coreR*.72,-phase*1.55,-phase*1.55+2.15,t.accent,2,.68);
    arcSegment(cx,cy,coreR*.72,-phase*1.55+3.1,-phase*1.55+5.65,t.hot,1,.55);

    ctx.restore();

    // Scanner wedge, kept outside scaled group.
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(phase*.34); const grad=ctx.createLinearGradient(0,0,base*1.17,0);
    grad.addColorStop(0,"rgba(89,230,255,0)"); grad.addColorStop(.65,`rgba(${accent.r},${accent.g},${accent.b},.018)`); grad.addColorStop(1,`rgba(${accent.r},${accent.g},${accent.b},.08)`);
    ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,base*1.16,-.055,.055); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawBackground(dt) {
    const t = theme(), bg = hexToRgb(t.bg), accent = hexToRgb(t.accent);
    // Complete opaque repaint every frame; no persistent ghosting.
    ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over"; ctx.shadowBlur=0;
    const g=ctx.createLinearGradient(0,0,0,height);
    g.addColorStop(0,`rgb(${bg.r},${bg.g},${bg.b})`);
    g.addColorStop(.5,`rgb(${Math.min(255,bg.r+1)},${Math.min(255,bg.g+4)},${Math.min(255,bg.b+8)})`);
    g.addColorStop(1,`rgb(${bg.r},${bg.g},${bg.b})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,width,height);
    drawGrid(accent); drawParticles(dt,accent); drawCore(dt,t);
  }

  function formatBytesPerSec(bytes) {
    const mb = Math.max(0, Number(bytes)||0)/(1024*1024);
    if (mb >= 100) return mb.toFixed(0);
    if (mb >= 10) return mb.toFixed(1);
    return mb.toFixed(2);
  }

  function shortHardwareName(name, fallback) {
    const s=String(name||fallback||"").replace(/\s+/g," ").trim();
    return s.length>54 ? s.slice(0,51)+"…" : s;
  }

  function updateTelemetry(obj, live=true) {
    const numericFields=["CurrentCpu","CurrentGpu3D","TotalRam","CurrentRamAvail","CurrentNetDown","CurrentNetUp"];
    const payloadValid=numericFields.every(key=>Object.prototype.hasOwnProperty.call(obj,key)&&Number.isFinite(Number(obj[key])));
    const total = Math.max(0, Number(obj.TotalRam)||0); // Lively reports RAM in megabytes.
    const rawAvail = Math.max(0, Number(obj.CurrentRamAvail)||0);
    const avail = total>0?Math.min(total,rawAvail):rawAvail;
    const used = Math.max(0,total-avail);
    telemetry.cpu=clamp(obj.CurrentCpu,0,100);
    telemetry.gpu=clamp(obj.CurrentGpu3D,0,100);
    telemetry.ramTotal=total;
    telemetry.ramUsed=used;
    telemetry.ram=total>0?clamp(used/total*100,0,100):0;
    telemetry.down=Math.max(0,Number(obj.CurrentNetDown)||0);
    telemetry.up=Math.max(0,Number(obj.CurrentNetUp)||0);
    telemetry.cpuName=shortHardwareName(obj.NameCpu,"processor");
    telemetry.gpuName=shortHardwareName(obj.NameGpu,"graphics adapter");
    telemetry.netName=shortHardwareName(obj.NameNetCard,"network adapter");
    telemetry.payloadValid=payloadValid;
    telemetry.source=live?"host":"demo";
    if (live) { telemetry.live=true; telemetry.lastSeen=performance.now(); }
    renderTelemetryDOM();
    renderDiagnostics();
  }

  function renderTelemetryDOM() {
    const cpu=telemetry.cpu, gpu=telemetry.gpu, ram=telemetry.ram;
    $("cpuValue").textContent=`${cpu.toFixed(1)}%`; $("gpuValue").textContent=`${gpu.toFixed(1)}%`; $("ramValue").textContent=`${ram.toFixed(1)}%`;
    $("cpuBar").style.width=`${cpu}%`; $("gpuBar").style.width=`${gpu}%`; $("ramBar").style.width=`${ram}%`;
    $("cpuName").textContent=telemetry.cpuName; $("gpuName").textContent=telemetry.gpuName; $("netName").textContent=telemetry.netName;
    $("ramDetail").textContent=telemetry.ramTotal>0?`${(telemetry.ramUsed/1024).toFixed(1)} / ${(telemetry.ramTotal/1024).toFixed(1)} GB`:`-- / -- GB`;
    $("netDown").textContent=formatBytesPerSec(telemetry.down); $("netUp").textContent=formatBytesPerSec(telemetry.up);
    $("coreCpu").textContent=cpu.toFixed(0).padStart(2,"0"); $("coreGpu").textContent=gpu.toFixed(0).padStart(2,"0");
    const weighted=clamp((cpu+gpu+ram)/3,0,100); $("corePercent").textContent=weighted.toFixed(1).padStart(5,"0");
    const netLevel=clamp(Math.log10(1+(telemetry.down+telemetry.up)/(128*1024))/2.25,0,1);
    document.querySelectorAll(".signal-strip i").forEach((el,i)=>{ const wave=.25+.75*Math.abs(Math.sin(i*.71+phase*4.3)); el.style.height=`${18+78*clamp(netLevel*.75+wave*.18,0,1)}%`; el.style.opacity=String(.2+.8*clamp(netLevel+.15,0,1)); });
  }

  function setHostState(state) {
    const badge=$("hostState"), boot=$("bootLog"), link=$("linkStatus"), foot=$("footerState"), core=$("coreState"), mode=$("coreMode");
    telemetry.state=state;
    badge.className=`state ${state}`;
    if (state==="live") {
      badge.textContent="LINK // ONLINE"; boot.innerHTML="<span>[ OK ]</span> host telemetry channel synchronized"; link.textContent="ONLINE"; foot.textContent="ONLINE"; core.textContent="SYSTEM NOMINAL"; mode.textContent="HOST LINKED";
    } else if (state==="stale") {
      badge.textContent="LINK // DEGRADED"; boot.innerHTML="<span>[ !! ]</span> host telemetry channel stale"; link.textContent="STALE"; foot.textContent="DEGRADED"; core.textContent="TELEMETRY DEGRADED"; mode.textContent="RETRYING";
    } else {
      badge.textContent="LINK // WAITING"; boot.innerHTML="<span>[ .. ]</span> establishing host telemetry channel"; link.textContent="STANDBY"; foot.textContent="STANDBY"; core.textContent="SYSTEM INITIALIZATION"; mode.textContent="SYNCHRONIZING";
    }
    renderCoreContext();
    renderDiagnostics();
  }

  function renderCoreContext() {
    const label=$("coreSubLabel");
    if (media.active) label.textContent="MEDIA UPLINK // ACTIVE";
    else if (telemetry.state==="live") label.textContent="HOST INTEGRATION // ACTIVE";
    else if (telemetry.state==="stale") label.textContent="HOST INTEGRATION // DEGRADED";
    else label.textContent="LOCAL INTERFACE // STANDBY";
  }

  function updateHostState() {
    if (!telemetry.live) return setHostState("waiting");
    setHostState(performance.now()-telemetry.lastSeen>6500?"stale":"live");
  }

  function demoTelemetryTick() {
    if (telemetry.live) return;
    const t=Date.now()/1000;
    updateTelemetry({
      CurrentCpu: 18+8*Math.sin(t*.43)+3*Math.sin(t*1.7),
      CurrentGpu3D: 11+6*Math.sin(t*.31+1.2),
      TotalRam: 32*1024, CurrentRamAvail: (20.5+1.1*Math.sin(t*.19))*1024,
      CurrentNetDown: (1.4+.9*Math.abs(Math.sin(t*.37)))*(1024**2), CurrentNetUp:(.15+.12*Math.abs(Math.sin(t*.63)))*(1024**2),
      NameCpu:"DEMO // processor telemetry", NameGpu:"DEMO // graphics telemetry", NameNetCard:"DEMO // network telemetry"
    }, false);
  }

  function updateClock() {
    const now=new Date();
    const opts={hour:"2-digit",minute:"2-digit",hour12:!settings.clock24h}; if(settings.showSeconds)opts.second="2-digit";
    $("clock").textContent=now.toLocaleTimeString([],opts);
    $("date").textContent=now.toLocaleDateString([], {weekday:"short",year:"numeric",month:"short",day:"2-digit"}).toUpperCase();
    const sec=Math.floor((Date.now()-sessionStart)/1000); const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
    $("sessionUptime").textContent=[h,m,s].map(v=>String(v).padStart(2,"0")).join(":");
  }

  function cleanText(value, fallback="", max=120) {
    const text=String(value??"").replace(/\s+/g," ").trim();
    if(!text)return fallback;
    return text.length>max?text.slice(0,max-1)+"…":text;
  }

  function setStatus(id, text, state="muted") {
    const el=$(id);
    if(!el)return;
    el.textContent=text;
    el.classList.remove("good","warn","bad","muted");
    el.classList.add(state);
  }

  function updateNowPlaying(obj) {
    media.supported=true;
    media.lastSeen=performance.now();
    if(!obj||typeof obj!=="object") {
      media.active=false;
      media.title=media.artist=media.album=media.genre=media.playbackType=media.subtitle=media.thumbnail="";
      media.track=media.trackCount=0;
    } else {
      media.title=cleanText(obj.Title,"",160);
      media.artist=cleanText(obj.Artist||obj.AlbumArtist||obj.Subtitle,"",120);
      media.album=cleanText(obj.AlbumTitle,"",120);
      media.subtitle=cleanText(obj.Subtitle,"",120);
      media.playbackType=cleanText(obj.PlaybackType,"MEDIA",32);
      media.genre=Array.isArray(obj.Genres)?cleanText(obj.Genres.filter(Boolean).slice(0,2).join(" / "),"",60):"";
      media.track=Math.max(0,Math.round(Number(obj.TrackNumber)||0));
      media.trackCount=Math.max(0,Math.round(Number(obj.AlbumTrackCount)||0));
      media.thumbnail=typeof obj.Thumbnail==="string"?obj.Thumbnail:"";
      media.active=Boolean(media.title||media.artist||media.album);
    }
    renderMedia();
    renderCoreContext();
    renderDiagnostics();
  }

  function renderMedia() {
    const panel=$("mediaPanel"), art=$("mediaArt");
    if(!media.active) {
      panel.classList.remove("has-art");
      setStatus("mediaState",media.supported?"STANDBY":"WAITING","muted");
      $("mediaPlaybackType").textContent="WINDOWS MEDIA SESSION";
      $("mediaTitle").textContent="NO ACTIVE MEDIA";
      $("mediaArtist").textContent=media.supported?"UPLINK // STANDBY":"UPLINK // WAITING FOR LIVELY";
      $("mediaAlbum").textContent=media.supported?"Compatible source not currently active":"Requires Lively system-nowplaying feed";
      $("mediaTrack").textContent="TRACK -- / --";
      $("mediaGenre").textContent="UNCATEGORIZED";
      art.removeAttribute("src");
      art.dataset.source="";
      return;
    }

    setStatus("mediaState","LINKED","good");
    $("mediaPlaybackType").textContent=`${(media.playbackType||"MEDIA").toUpperCase()} // WINDOWS SESSION`;
    $("mediaTitle").textContent=media.title||"UNTITLED MEDIA";
    $("mediaArtist").textContent=media.artist||media.subtitle||"UNKNOWN ORIGIN";
    $("mediaAlbum").textContent=media.album||media.subtitle||"ALBUM DATA UNAVAILABLE";
    $("mediaTrack").textContent=media.track||media.trackCount?`TRACK ${String(media.track||"--").padStart(2,"0")} / ${String(media.trackCount||"--").padStart(2,"0")}`:"TRACK // UNINDEXED";
    $("mediaGenre").textContent=(media.genre||"UNCATEGORIZED").toUpperCase();
    if(media.thumbnail) {
      if(art.dataset.source!==media.thumbnail) {
        art.dataset.source=media.thumbnail;
        art.src=media.thumbnail.startsWith("data:")?media.thumbnail:`data:image/png;base64,${media.thumbnail}`;
      }
      panel.classList.add("has-art");
    } else {
      panel.classList.remove("has-art");
      art.removeAttribute("src");
      art.dataset.source="";
    }
  }

  function renderDeviceIdentity() {
    $("logicalCores").textContent=device.cores?`${device.cores} THREADS`:"UNAVAILABLE";
    $("displayGeometry").textContent=`${Math.round(window.innerWidth||width)} × ${Math.round(window.innerHeight||height)}`;
    $("displayScale").textContent=`${(window.devicePixelRatio||1).toFixed(2)} ×`;
    setStatus("browserOnline",device.online?"ONLINE":"OFFLINE",device.online?"good":"warn");
    $("systemLocale").textContent=cleanText(device.locale,"UNKNOWN",24).toUpperCase();
    $("systemTimezone").textContent=cleanText(device.timezone,"UNKNOWN",40).replace(/_/g," ").toUpperCase();

    if(device.battery) {
      const level=Math.round(clamp(device.battery.level,0,1)*100);
      const text=device.battery.charging?(level>=99?"AC // FULL":`CHARGING // ${level}%`):`BATTERY // ${level}%`;
      setStatus("batteryStatus",text,level<=20&&!device.battery.charging?"warn":"good");
    } else if(device.batteryError) {
      setStatus("batteryStatus","RESTRICTED","warn");
    } else if(!device.batteryInitialized) {
      setStatus("batteryStatus","PROBING","muted");
    } else if(!device.batterySupported) {
      setStatus("batteryStatus","UNAVAILABLE","muted");
    }
  }

  async function initializeBattery() {
    if(typeof navigator.getBattery!=="function") {
      device.batterySupported=false;
      device.batteryInitialized=true;
      renderDeviceIdentity();
      return;
    }
    device.batterySupported=true;
    try {
      device.battery=await navigator.getBattery();
      const refresh=()=>renderDeviceIdentity();
      ["chargingchange","levelchange","chargingtimechange","dischargingtimechange"].forEach(eventName=>device.battery.addEventListener(eventName,refresh));
    } catch (_) {
      device.battery=null;
      device.batteryError=true;
    }
    device.batteryInitialized=true;
    renderDeviceIdentity();
  }

  function renderDiagnostics() {
    const now=performance.now();
    if(telemetry.live) {
      const age=Math.max(0,(now-telemetry.lastSeen)/1000);
      if(telemetry.state==="live")setStatus("diagTelemetry",`LIVE // ${age.toFixed(1)}s`,"good");
      else setStatus("diagTelemetry",`STALE // ${age.toFixed(1)}s`,"warn");
      setStatus("diagPayload",telemetry.payloadValid?"VALID":"FAULT",telemetry.payloadValid?"good":"bad");
    } else {
      setStatus("diagTelemetry","LOCAL DEMO","muted");
      setStatus("diagPayload",telemetry.payloadValid?"SIMULATED":"WAITING","muted");
    }

    if(paused)setStatus("diagRenderer","PAUSED","muted");
    else if(renderer.fps>0) {
      const healthy=renderer.fps>=settings.fps*.78;
      setStatus("diagRenderer",`${renderer.fps.toFixed(1)} FPS`,healthy?"good":"warn");
    } else setStatus("diagRenderer","WARMING","muted");

    if(telemetry.live&&telemetry.payloadValid) {
      const active=telemetry.down+telemetry.up>1024;
      setStatus("diagNetwork",active?"ACTIVE":"IDLE",active?"good":"muted");
    } else setStatus("diagNetwork",telemetry.source==="demo"?"SIMULATED":"WAITING","muted");

    if(!settings.audioReactive)setStatus("diagAudio","DISABLED","muted");
    else if(!audioSourceSeen)setStatus("diagAudio","WAITING","muted");
    else setStatus("diagAudio",audioLevel>.035?"ACTIVE":"ARMED",audioLevel>.035?"good":"muted");

    if(media.active)setStatus("diagMedia","LINKED","good");
    else if(media.supported)setStatus("diagMedia","STANDBY","muted");
    else setStatus("diagMedia","WAITING","muted");
  }

  function bandRms(start, end) {
    let sum=0,count=0;
    for(let i=start;i<end&&i<audio.length;i++) {
      const value=clamp(audio[i],0,1.5);
      sum+=value*value;
      count++;
    }
    return count?Math.sqrt(sum/count):0;
  }

  function renderAudioBands() {
    const sensitivity=settings.audioSensitivity/100;
    const level=value=>settings.audioReactive?clamp(value*sensitivity,0,1)*100:0;
    $("audioLowBar").style.width=`${level(audioBands.low).toFixed(1)}%`;
    $("audioMidBar").style.width=`${level(audioBands.mid).toFixed(1)}%`;
    $("audioHighBar").style.width=`${level(audioBands.high).toFixed(1)}%`;
    const beat=$("beatState");
    beat.className=audioBands.beat>.45&&settings.audioReactive?"hit":"";
    beat.textContent=!settings.audioReactive?"OFF":audioBands.beat>.45?"HIT":audioSourceSeen?"ARMED":"WAIT";
  }

  function updateAudioLevel() {
    let sum=0, count=0;
    for(let i=2;i<70;i++){const v=Number(audio[i])||0; sum+=v*v; count++;}
    const rms=count?Math.sqrt(sum/count):0;
    audioLevel=lerp(audioLevel,clamp(rms,0,1.5),.18);
    audioBands.low=lerp(audioBands.low,bandRms(1,11),.22);
    audioBands.mid=lerp(audioBands.mid,bandRms(11,40),.2);
    audioBands.high=lerp(audioBands.high,bandRms(40,96),.18);
    audioBands.beat=lerp(audioBands.beat,0,.2);
    const onset=audioBands.low*.72+audioBands.mid*.28;
    const threshold=Math.max(.065,audioBeatFloor*1.34);
    const now=performance.now();
    if(audioSourceSeen&&onset>threshold&&now-lastBeatAt>170) {
      audioBands.beat=1;
      lastBeatAt=now;
    }
    audioBeatFloor=lerp(audioBeatFloor,onset,onset>audioBeatFloor?.025:.11);
    $("audioStatus").textContent=!settings.audioReactive?"DISABLED":!audioSourceSeen?"WAITING":audioLevel>.035?"ACTIVE":"ARMED";
    renderAudioBands();
  }

  function sampleHistory(now) {
    if(now-lastMiniSample<650)return; lastMiniSample=now;
    const net=clamp(Math.log10(1+(telemetry.down+telemetry.up)/(96*1024))*24,0,100);
    history.cpu.push(telemetry.cpu); history.gpu.push(telemetry.gpu); history.net.push(net);
    for(const k of Object.keys(history)) if(history[k].length>48) history[k].shift();
  }

  function drawMiniGraph() {
    const w=mini.clientWidth||420,h=mini.clientHeight||88,ratio=Math.min(2,window.devicePixelRatio||1);
    const rw=Math.floor(w*ratio),rh=Math.floor(h*ratio); if(mini.width!==rw||mini.height!==rh){mini.width=rw;mini.height=rh;}
    mctx.setTransform(ratio,0,0,ratio,0,0); mctx.clearRect(0,0,w,h);
    const t=theme(), rgb=hexToRgb(t.accent);
    mctx.strokeStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},.09)`; mctx.lineWidth=1;
    mctx.beginPath(); for(let y=0;y<=h;y+=h/4){mctx.moveTo(0,y);mctx.lineTo(w,y)} for(let x=0;x<=w;x+=w/8){mctx.moveTo(x,0);mctx.lineTo(x,h)} mctx.stroke();
    const series=[history.cpu,history.gpu,history.net], alphas=[.9,.58,.32];
    series.forEach((arr,si)=>{if(arr.length<2)return;mctx.strokeStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${alphas[si]})`;mctx.lineWidth=si===0?1.6:1;mctx.beginPath();arr.forEach((v,i)=>{const x=i/(47)*w,y=h-clamp(v,0,100)/100*h;i?mctx.lineTo(x,y):mctx.moveTo(x,y)});mctx.stroke();});
  }

  function animationLoop(now) {
    if(paused){requestAnimationFrame(animationLoop);return;}
    const interval=1000/settings.fps;
    if(now-lastFrame>=interval){
      const dt=Math.min(80,now-lastFrame);
      lastFrame=now;
      updateAudioLevel(); drawBackground(dt); renderTelemetryDOM(); sampleHistory(now); drawMiniGraph();
      renderer.frames++;
      const sampleElapsed=now-renderer.sampleStart;
      if(sampleElapsed>=1000) {
        renderer.fps=renderer.frames*1000/sampleElapsed;
        renderer.frames=0;
        renderer.sampleStart=now;
        renderDiagnostics();
      }
    }
    requestAnimationFrame(animationLoop);
  }

  function setProperty(name,val) {
    switch(name){
      case "theme": settings.theme=clamp(val,0,4); break;
      case "customAccent": settings.customAccent=String(val||settings.customAccent); break;
      case "customBackground": settings.customBackground=String(val||settings.customBackground); break;
      case "topSafeArea": settings.topSafeArea=clamp(val,0,180); break;
      case "hudOpacity": settings.hudOpacity=clamp(val,25,100); break;
      case "fps": settings.fps=[20,30,45,60][clamp(val,0,3)]||30; renderer.frames=0; renderer.sampleStart=performance.now(); break;
      case "animationSpeed": settings.animationSpeed=clamp(val,25,200); break;
      case "glow": settings.glow=clamp(val,0,160); break;
      case "scanlines": settings.scanlines=Boolean(val); break;
      case "grid": settings.grid=Boolean(val); break;
      case "particles": settings.particles=Boolean(val); break;
      case "showPanels": settings.showPanels=Boolean(val); break;
      case "audioReactive": settings.audioReactive=Boolean(val); break;
      case "audioSensitivity": settings.audioSensitivity=clamp(val,25,250); break;
      case "clock24h": settings.clock24h=Boolean(val); break;
      case "showSeconds": settings.showSeconds=Boolean(val); break;
      case "systemTitle": settings.systemTitle=String(val||"").slice(0,42); break;
      case "coreLabel": settings.coreLabel=String(val||"").slice(0,42); break;
      case "nodeLabel": settings.nodeLabel=String(val||"").slice(0,64); break;
      default:return;
    }
    applyTheme();
    renderDiagnostics();
    renderAudioBands();
  }

  window.livelySystemInformation=function(data){try{const obj=typeof data==="string"?JSON.parse(data):data;if(obj&&typeof obj==="object")updateTelemetry(obj,true);}catch(e){console.error("Invalid Lively telemetry",e)}};
  window.livelyCurrentTrack=function(data){try{const obj=typeof data==="string"?JSON.parse(data):data;updateNowPlaying(obj);}catch(e){console.error("Invalid Lively media data",e)}};
  window.livelyAudioListener=function(arr){if(Array.isArray(arr)){audioSourceSeen=true;audio=arr.slice(0,128);}};
  window.livelyWallpaperPlaybackChanged=function(data){try{const obj=typeof data==="string"?JSON.parse(data):data;paused=Boolean(obj?.IsPaused);renderer.frames=0;renderer.sampleStart=performance.now();if(!paused)lastFrame=performance.now();renderDiagnostics();}catch(e){console.error("Invalid Lively pause event",e)}};
  window.livelyPropertyListener=function(name,val){setProperty(name,val);};

  window.addEventListener("resize",resize,{passive:true});
  window.addEventListener("online",()=>{device.online=true;renderDeviceIdentity();});
  window.addEventListener("offline",()=>{device.online=false;renderDeviceIdentity();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!paused)lastFrame=performance.now();});
  $("mediaArt").addEventListener("error",()=>{$("mediaPanel").classList.remove("has-art");});

  resize(); applyTheme(); renderMedia(); renderDeviceIdentity(); updateClock(); setHostState("waiting"); demoTelemetryTick(); initializeBattery();
  setInterval(updateClock,250); setInterval(renderDiagnostics,500); setInterval(updateHostState,1000); setInterval(demoTelemetryTick,1000);
  requestAnimationFrame(animationLoop);
})();
