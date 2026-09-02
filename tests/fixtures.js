// Placeholder elements for every id the wallpaper scripts read, so
// core/render/effects/modules/persona can load outside index.html.
(function () {
  const ids = [
    "systemTitle","coreLabel","nodeLabel","hostState","clock","date","cpuValue","cpuBar","cpuName",
    "gpuValue","gpuBar","gpuName","ramValue","ramBar","ramDetail","netDown","netUp","netName",
    "linkStatus","audioStatus","sessionUptime","coreMode","coreCpu","coreGpu","coreSubLabel",
    "coreState","corePercent","mediaPanel","mediaState","mediaArtFrame","mediaArt","mediaPlaybackType",
    "mediaTitle","mediaArtist","mediaAlbum","mediaTrack","mediaGenre","audioLowBar","audioMidBar",
    "audioHighBar","beatState","diagTelemetry","diagPayload","diagRenderer","diagNetwork","diagAudio",
    "diagMedia","logicalCores","displayGeometry","displayScale","browserOnline","systemLocale",
    "systemTimezone","batteryStatus","bootLog","footerState","personaLog","alertBadge","stressReadout",
    "deckLeft","deckRight","deckLeftTitle","deckRightTitle","bootOverlay","bootOverlayLog","glitchLayer"
  ];
  const host = document.getElementById("fixtures") || document.body;
  for (const id of ids) {
    if (document.getElementById(id)) continue;
    const el = document.createElement(id === "mediaArt" ? "img" : "div");
    el.id = id;
    host.appendChild(el);
  }
})();
