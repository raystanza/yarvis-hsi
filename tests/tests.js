window.YARVIS_TESTS = [
  // ---- Task 1: bus, utils, budgets ----
  ["bus delivers payload to subscriber", () => {
    const Y = window.YARVIS;
    let got = null;
    const fn = (p) => { got = p; };
    Y.bus.on("test:evt", fn);
    Y.bus.emit("test:evt", { v: 42 });
    Y.bus.off("test:evt", fn);
    assertEqual(got && got.v, 42);
  }],
  ["bus survives a throwing subscriber", () => {
    const Y = window.YARVIS;
    let reached = false;
    const bad = () => { throw new Error("boom"); };
    const good = () => { reached = true; };
    Y.bus.on("test:throw", bad);
    Y.bus.on("test:throw", good);
    Y.bus.emit("test:throw");
    Y.bus.off("test:throw", bad);
    Y.bus.off("test:throw", good);
    assertEqual(reached, true);
  }],
  ["off removes only the named handler", () => {
    const Y = window.YARVIS;
    let a = 0, b = 0;
    const fa = () => { a++; };
    const fb = () => { b++; };
    Y.bus.on("test:off", fa);
    Y.bus.on("test:off", fb);
    Y.bus.off("test:off", fa);
    Y.bus.emit("test:off");
    Y.bus.off("test:off", fb);
    assertEqual(a, 0);
    assertEqual(b, 1);
  }],
  ["hexToRgb expands shorthand", () => {
    const c = window.YARVIS.util.hexToRgb("#0f8");
    assertEqual(c.r, 0); assertEqual(c.g, 255); assertEqual(c.b, 136);
  }],
  ["clamp bounds both ends", () => {
    const cl = window.YARVIS.util.clamp;
    assertEqual(cl(5, 0, 3), 3);
    assertEqual(cl(-5, 0, 3), 0);
    assertEqual(cl("nonsense", 0, 3), 0);
  }],
  ["budget MINIMAL zeroes every new layer", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.intensity;
    Y.settings.intensity = 0;
    const b = Y.budget();
    Y.settings.intensity = prev;
    assertEqual(b.name, "MINIMAL");
    assertEqual(b.arcs, 0);
    assertEqual(b.globePoints, 0);
    assertEqual(b.vortex, 0);
    assertEqual(b.klaxon, 0);
    assertEqual(b.glitch, 0);
  }],
  ["budget OVERDRIVE exceeds STANDARD on every axis", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.intensity;
    Y.settings.intensity = 1; const s = Y.budget();
    Y.settings.intensity = 3; const o = Y.budget();
    Y.settings.intensity = prev;
    assertEqual(o.arcs > s.arcs, true);
    assertEqual(o.globePoints > s.globePoints, true);
    assertEqual(o.vortex > s.vortex, true);
  }],

  // ---- Task 2: render geometry ----
  ["geometry centres horizontally and respects the top safe area", () => {
    const Y = window.YARVIS;
    Y.view.width = 1000; Y.view.height = 800;
    const prev = Y.settings.topSafeArea;
    Y.settings.topSafeArea = 100;
    const g = Y.render.geometry();
    Y.settings.topSafeArea = prev;
    assertEqual(g.cx, 500);
    assertEqual(Math.round(g.cy), Math.round(100 + 700 * 0.54));
    assertEqual(g.base > 0, true);
  }],
  ["geometry base fits inside the available height", () => {
    const Y = window.YARVIS;
    Y.view.width = 3000; Y.view.height = 600;
    const g = Y.render.geometry();
    assertEqual(g.base <= 600 * 0.39, true);
  }],
  ["frame runs without an effects layer attached", () => {
    const Y = window.YARVIS;
    const saved = Y.effects;
    Y.effects = null;
    Y.render.attach(document.getElementById("fxCanvas"));
    Y.render.resize();
    Y.render.frame(16);
    Y.effects = saved;
    assertEqual(true, true);
  }],

  // ---- Task 3: telemetry state and threshold events ----
  ["cpu:spike fires once on crossing, not repeatedly", () => {
    const Y = window.YARVIS;
    let spikes = 0, clears = 0;
    const onSpike = () => { spikes++; };
    const onClear = () => { clears++; };
    const payload = (cpu) => ({
      CurrentCpu: cpu, CurrentGpu3D: 0, TotalRam: 32768, CurrentRamAvail: 16384,
      CurrentNetDown: 0, CurrentNetUp: 0,
      NameCpu: "test", NameGpu: "test", NameNetCard: "test"
    });
    Y.state.updateTelemetry(payload(10), false);
    Y.bus.on("cpu:spike", onSpike);
    Y.bus.on("cpu:clear", onClear);
    Y.state.updateTelemetry(payload(90), false);
    Y.state.updateTelemetry(payload(92), false);
    Y.state.updateTelemetry(payload(95), false);
    Y.state.updateTelemetry(payload(10), false);
    Y.bus.off("cpu:spike", onSpike);
    Y.bus.off("cpu:clear", onClear);
    assertEqual(spikes, 1);
    assertEqual(clears, 1);
  }],
  ["cpu spike does not clear inside the hysteresis band", () => {
    const Y = window.YARVIS;
    let clears = 0;
    const onClear = () => { clears++; };
    const payload = (cpu) => ({
      CurrentCpu: cpu, CurrentGpu3D: 0, TotalRam: 32768, CurrentRamAvail: 16384,
      CurrentNetDown: 0, CurrentNetUp: 0,
      NameCpu: "test", NameGpu: "test", NameNetCard: "test"
    });
    Y.state.updateTelemetry(payload(10), false);
    Y.state.updateTelemetry(payload(90), false);
    Y.bus.on("cpu:clear", onClear);
    Y.state.updateTelemetry(payload(78), false);
    Y.bus.off("cpu:clear", onClear);
    Y.state.updateTelemetry(payload(10), false);
    assertEqual(clears, 0);
  }],
  ["RAM is read as megabytes and converted for display", () => {
    const Y = window.YARVIS;
    Y.state.updateTelemetry({
      CurrentCpu: 0, CurrentGpu3D: 0, TotalRam: 32768, CurrentRamAvail: 8192,
      CurrentNetDown: 0, CurrentNetUp: 0,
      NameCpu: "t", NameGpu: "t", NameNetCard: "t"
    }, false);
    assertEqual(Y.telemetry.ramTotal, 32768);
    assertEqual(Y.telemetry.ramUsed, 24576);
    assertEqual(Math.round(Y.telemetry.ram), 75);
  }],
  ["an incomplete payload is marked invalid", () => {
    const Y = window.YARVIS;
    Y.state.updateTelemetry({ CurrentCpu: 5 }, false);
    assertEqual(Y.telemetry.payloadValid, false);
  }],
  ["media:standby fires when the payload goes empty", () => {
    const Y = window.YARVIS;
    let standby = 0;
    const fn = () => { standby++; };
    Y.state.updateNowPlaying({ Title: "Song", Artist: "Artist" });
    Y.bus.on("media:standby", fn);
    Y.state.updateNowPlaying(null);
    Y.bus.off("media:standby", fn);
    assertEqual(standby, 1);
  }],
  ["battery:low latches once below twenty per cent", () => {
    const Y = window.YARVIS;
    let low = 0;
    const fn = () => { low++; };
    Y.state.setBattery(0.9, false);
    Y.bus.on("battery:low", fn);
    Y.state.setBattery(0.15, false);
    Y.state.setBattery(0.1, false);
    Y.bus.off("battery:low", fn);
    Y.state.setBattery(0.9, false);
    assertEqual(low, 1);
  }],

  // ---- Task 4: alert state machine ----
  ["alert machine escalates to CRITICAL and back with hysteresis", () => {
    const Y = window.YARVIS;
    Y.alerts.reset();
    const settle = (cpu) => {
      Y.telemetry.cpu = cpu; Y.telemetry.gpu = 0; Y.telemetry.ram = 0;
      for (let i = 0; i < 400; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    };
    settle(0);
    assertEqual(Y.alerts.state, "NOMINAL");
    settle(100);
    assertEqual(Y.alerts.state, "CRITICAL");
    settle(82);
    assertEqual(Y.alerts.state, "CRITICAL");
    settle(0);
    assertEqual(Y.alerts.state, "NOMINAL");
  }],
  ["alert machine holds a new state for the minimum dwell time", () => {
    const Y = window.YARVIS;
    Y.alerts.reset();
    Y.telemetry.gpu = 0; Y.telemetry.ram = 0;
    // Settle low, then spike: the first change is allowed, dwell having elapsed.
    Y.telemetry.cpu = 0;
    for (let i = 0; i < 400; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    Y.telemetry.cpu = 100;
    for (let i = 0; i < 400; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    assertEqual(Y.alerts.state, "CRITICAL");
    // Load vanishes, but only ~1s passes: the machine must not flip straight back.
    Y.telemetry.cpu = 0;
    for (let i = 0; i < 60; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    assertEqual(Y.alerts.state, "CRITICAL");
  }],
  ["alert machine holds NOMINAL when the cluster is disabled", () => {
    const Y = window.YARVIS;
    Y.alerts.reset();
    const prev = Y.settings.alertStates;
    Y.settings.alertStates = false;
    Y.telemetry.cpu = 100; Y.telemetry.gpu = 100; Y.telemetry.ram = 100;
    for (let i = 0; i < 600; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    Y.settings.alertStates = prev;
    assertEqual(Y.alerts.state, "NOMINAL");
  }],
  ["alert:change reports both endpoints", () => {
    const Y = window.YARVIS;
    Y.alerts.reset();
    let seen = null;
    const fn = (p) => { seen = p; };
    Y.bus.on("alert:change", fn);
    Y.telemetry.cpu = 100; Y.telemetry.gpu = 100; Y.telemetry.ram = 100;
    for (let i = 0; i < 600; i++) Y.alerts.update(16, Y.alerts.clock + 16);
    Y.bus.off("alert:change", fn);
    assertEqual(seen && seen.from, "NOMINAL");
    assertEqual(seen && seen.to, "CRITICAL");
  }],

  // ---- Task 5: spectacle layers ----
  ["arc spawning is capped by the intensity budget", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.intensity;
    Y.effects.arcs.length = 0;
    Y.settings.intensity = 1;
    for (let i = 0; i < 50; i++) Y.effects.spawnArc();
    const standard = Y.effects.arcs.length;
    Y.settings.intensity = prev;
    assertEqual(standard, 3);
  }],
  ["MINIMAL intensity spawns no arcs", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.intensity;
    Y.effects.arcs.length = 0;
    Y.settings.intensity = 0;
    for (let i = 0; i < 20; i++) Y.effects.spawnArc();
    Y.settings.intensity = prev;
    assertEqual(Y.effects.arcs.length, 0);
  }],
  ["disabling the spectacle cluster spawns no arcs", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.reactorSpectacle;
    Y.effects.arcs.length = 0;
    Y.settings.reactorSpectacle = false;
    for (let i = 0; i < 20; i++) Y.effects.spawnArc();
    Y.settings.reactorSpectacle = prev;
    assertEqual(Y.effects.arcs.length, 0);
  }],
  ["arcs expire after their lifetime", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.intensity;
    Y.effects.arcs.length = 0;
    Y.settings.intensity = 2;
    Y.effects.spawnArc();
    assertEqual(Y.effects.arcs.length, 1);
    const ctx = document.getElementById("fxCanvas").getContext("2d");
    Y.effects.drawOver(ctx, { cx: 100, cy: 100, base: 80 }, 1000);
    Y.settings.intensity = prev;
    assertEqual(Y.effects.arcs.length, 0);
  }],
  ["draw layers tolerate a zero-radius geometry", () => {
    const Y = window.YARVIS;
    const ctx = document.getElementById("fxCanvas").getContext("2d");
    Y.effects.drawUnder(ctx, { cx: 0, cy: 0, base: 0 }, 16);
    Y.effects.drawOver(ctx, { cx: 0, cy: 0, base: 0 }, 16);
    assertEqual(true, true);
  }],

  // ---- Task 6: persona ----
  ["lineFor produces distinct copy per event", () => {
    const Y = window.YARVIS;
    const a = Y.persona.lineFor("link:live");
    const b = Y.persona.lineFor("media:change", { title: "Song", artist: "Artist" });
    assertEqual(typeof a, "string");
    assertEqual(typeof b, "string");
    assertEqual(a !== b, true);
  }],
  ["lineFor returns null for an unknown event", () => {
    assertEqual(window.YARVIS.persona.lineFor("nonsense:event"), null);
  }],
  ["media line includes the track title", () => {
    const line = window.YARVIS.persona.lineFor("media:change", { title: "Blue Monday", artist: "New Order" });
    assertEqual(line.indexOf("Blue Monday") >= 0, true);
  }],
  ["the log is capped at 40 lines", () => {
    const Y = window.YARVIS;
    Y.persona.lines.length = 0;
    for (let i = 0; i < 60; i++) Y.persona.say(`line ${i}`, "event");
    assertEqual(Y.persona.lines.length, 40);
    assertEqual(Y.persona.lines[39].text, "line 59");
  }],
  ["ambient lines are tagged so they stay auditable", () => {
    const Y = window.YARVIS;
    Y.persona.lines.length = 0;
    Y.persona.say("routine sweep complete", "ambient");
    assertEqual(Y.persona.lines[0].kind, "ambient");
  }],
  ["repeated identical lines collapse into a tally", () => {
    const Y = window.YARVIS;
    Y.persona.lines.length = 0;
    for (let i = 0; i < 5; i++) Y.persona.say("Notable traffic on the network bus.", "event");
    assertEqual(Y.persona.lines.length, 1);
    assertEqual(Y.persona.lines[0].repeats, 5);
  }],
  ["a different line after a repeat starts a new entry", () => {
    const Y = window.YARVIS;
    Y.persona.lines.length = 0;
    Y.persona.say("Holding station.", "ambient");
    Y.persona.say("Holding station.", "ambient");
    Y.persona.say("Processor load has settled.", "event");
    assertEqual(Y.persona.lines.length, 2);
    assertEqual(Y.persona.lines[1].text, "Processor load has settled.");
  }],
  ["disabling the persona suppresses new lines", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.personaLog;
    Y.persona.lines.length = 0;
    Y.settings.personaLog = false;
    Y.persona.say("should not appear", "event");
    Y.settings.personaLog = prev;
    assertEqual(Y.persona.lines.length, 0);
  }],

  // ---- Task 7: module deck ----
  ["deck advance wraps within a side", () => {
    const Y = window.YARVIS;
    const count = Y.modules.registry.filter((m) => m.side === "left").length;
    assertEqual(count > 1, true);
    Y.modules.deck.left.index = count - 1;
    Y.modules.advance("left");
    assertEqual(Y.modules.deck.left.index, 0);
  }],
  ["deck advances on the cycle interval", () => {
    const Y = window.YARVIS;
    Y.modules.deck.right.index = 0;
    Y.modules.deck.right.elapsed = 0;
    Y.modules.update(19000, 19000);
    assertEqual(Y.modules.deck.right.index, 0);
    Y.modules.update(1500, 20500);
    assertEqual(Y.modules.deck.right.index, 1);
  }],
  ["deck holds still when cycling is disabled", () => {
    const Y = window.YARVIS;
    const prev = Y.settings.cyclingDeck;
    Y.settings.cyclingDeck = false;
    Y.modules.deck.left.index = 0;
    Y.modules.deck.left.elapsed = 0;
    Y.modules.update(60000, 60000);
    Y.settings.cyclingDeck = prev;
    assertEqual(Y.modules.deck.left.index, 0);
  }],
  ["radar contacts are capped and expire", () => {
    const Y = window.YARVIS;
    Y.modules.contacts.length = 0;
    for (let i = 0; i < 40; i++) Y.bus.emit("net:burst", 9 * 1024 * 1024);
    assertEqual(Y.modules.contacts.length, 12);
    Y.modules.update(13000, 100000);
    assertEqual(Y.modules.contacts.length, 0);
  }],
  ["every registered module renders without throwing", () => {
    const Y = window.YARVIS;
    for (const m of Y.modules.registry) {
      const c = document.createElement("canvas");
      c.width = 300; c.height = 120;
      m.render(c, 16);
    }
    assertEqual(true, true);
  }],

  // ---- Task 8: settings surface ----
  ["setProperty maps the intensity dropdown index", () => {
    const Y = window.YARVIS;
    Y.setProperty("intensity", 3);
    assertEqual(Y.budget().name, "OVERDRIVE");
    Y.setProperty("intensity", 1);
    assertEqual(Y.budget().name, "STANDARD");
  }],
  ["setProperty clamps an out-of-range intensity", () => {
    const Y = window.YARVIS;
    Y.setProperty("intensity", 99);
    assertEqual(Y.budget().name, "OVERDRIVE");
    Y.setProperty("intensity", -5);
    assertEqual(Y.budget().name, "MINIMAL");
    Y.setProperty("intensity", 1);
  }],
  ["setProperty toggles every new cluster", () => {
    const Y = window.YARVIS;
    for (const key of ["reactorSpectacle", "alertStates", "cyclingDeck", "cornerCallouts", "personaLog", "bootSequence"]) {
      Y.setProperty(key, false);
      assertEqual(Y.settings[key], false);
      Y.setProperty(key, true);
      assertEqual(Y.settings[key], true);
    }
  }],
  ["setProperty ignores an unknown key", () => {
    const Y = window.YARVIS;
    Y.setProperty("notARealSetting", 5);
    assertEqual(Y.settings.notARealSetting, undefined);
  }]
];
