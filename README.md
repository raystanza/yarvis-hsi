# J.A.R.V.I.S. // Holographic System Interface

A custom Lively Wallpaper inspired by the cinematic language of futuristic holographic AI interfaces: concentric reactor rings, real diagnostic panels, animated vector graphics, live host telemetry, Windows media metadata, and an optional audio-reactive spectrum.

This is an original fan-made interface. It does **not** include Marvel artwork, movie footage, character portraits, Stark Industries logos, or extracted film assets.

## Lively integration

The wallpaper requests:

- `--system-information` for CPU, GPU, RAM, and network telemetry.
- `--system-nowplaying` for compatible Windows media-session metadata and album art.
- `--audio` for the optional reactor spectrum / pulse response.
- `--pause-event true` so animation can pause when Lively pauses the wallpaper.

When opened in a normal browser, the telemetry panels show demo values while the host-link indicator remains in WAITING state. In Lively, real host telemetry changes the link state to ONLINE.

## Live interface modules

- **Media Uplink** shows title, artist, album, genre, track index, playback type, and album art when the active player publishes metadata to the Windows media overlay. It returns to STANDBY when no compatible source is active.
- **Diagnostic Matrix** reports host-data freshness, payload validity, measured wallpaper FPS, network activity, audio-spectrum state, and media-uplink state.
- **Audio energy analysis** derives low-, mid-, and high-frequency energy plus beat impulses from Lively's 128-value audio data. Beat energy also pulses the central reactor.
- **Interface Identity** reports logical processor threads, viewport size, display scale, browser link state, locale, time zone, and battery state when the browser permits it.

Battery information is optional. Chromium restricts the Battery Status API in some contexts, so the interface will display `RESTRICTED` or `UNAVAILABLE` rather than treating it as an error.

Lively reports `TotalRam` and `CurrentRamAvail` in megabytes. The wallpaper converts those readings to gigabytes for display while retaining the original units for usage calculations.

## PowerToys toolbar

`Top safe area / PowerToys toolbar (px)` defaults to **44 px**. Adjust it from Lively's Customize Wallpaper panel if your toolbar is taller or shorter.

## Recommended defaults

- Theme: Arc Cyan
- FPS: 30
- Animation speed: 100%
- Glow: 100%
- HUD opacity: 92%
- Audio-reactive reactor: On
- Audio sensitivity: 100%
- Top safe area: 44 px

## Performance

30 FPS is the recommended balance for a desktop wallpaper. Lower the frame rate to 20 FPS and disable ambient particles if you want minimal GPU usage.
