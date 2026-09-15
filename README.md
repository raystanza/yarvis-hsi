# Y.A.R.V.I.S. // Holographic System Interface

**Y**et **A**nother **R**ather **V**ery **I**ntelligent **S**ystem

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

## Effect intensity

`Effect intensity` scales every new per-frame layer at once, so you can dial the
wallpaper between "quiet desktop" and "showing off" without hunting through
individual switches.

| Level | Lightning arcs | Globe points | Vortex | Klaxon rings | Glitch |
| --- | --- | --- | --- | --- | --- |
| Minimal | off | off | off | off | off |
| Standard | 3 | 120 | light | 2 | light |
| Maximum | 6 | 240 | strong | 4 | strong |
| Overdrive | 10 | 380 | full | 6 | full |

**Minimal disables every layer added in 1.2**, returning the wallpaper to roughly
its 1.1 cost. Standard is the default.

## Reactive alert states

The interface derives a `stress` figure from CPU, GPU, and memory load and moves
between four states. Peak subsystem load sets the floor, so a pegged CPU alone
still registers as strain, and simultaneous pressure elsewhere pushes it higher.

| State | Enters at | Leaves at | Behaviour |
| --- | --- | --- | --- |
| `IDLE` | quiet for 90 s | any activity | Dims, slows, stops volunteering commentary |
| `NOMINAL` | default | n/a | Standard palette |
| `ELEVATED` | stress > 70 | stress < 60 | Palette shifts toward the warning colour |
| `CRITICAL` | stress > 88 | stress < 78 | Red shift, klaxon rings, glitch bursts |

Hysteresis plus a four-second minimum dwell keeps the state from flapping around
a threshold.

## Cycling module deck

Each side stack ends with a deck that rotates through modules every 20 seconds:

- **Network activity** - a sweep scope whose contacts are spawned by genuine
  throughput bursts. They represent traffic spikes, not discovered hosts.
- **Memory map** - a cell grid tracking used against free memory.
- **Spectrum analyser** - all 128 audio bins.
- **Load histogram** - windowed CPU and GPU history with min, mean, and max.
  This replaces the standalone Vector Analysis panel from 1.1.
- **Media chromatics** - dominant colours sampled from album art.

The deck claims whatever vertical space the stack has left. On short displays it
hides itself rather than squeezing the always-on panels off screen.

## Y.A.R.V.I.S. commentary

A log above the footer reacts to real events: the telemetry link coming up or
going stale, load crossing a threshold, a new track on the media uplink, network
bursts, battery state. After 25 seconds with nothing real to report it offers an
ambient line instead; ambient lines are styled differently so the log stays
readable as a record of what actually happened. Repeated identical lines collapse
into a single entry with a tally.

## A note on derived data

Lively supplies CPU, GPU 3D, total and available RAM, network throughput, and the
three adapter names. Everything else on screen is derived from those figures, the
audio spectrum, media metadata, or browser APIs. The interface does not display
per-core load, disk activity, or temperatures, because the host does not report
them and inventing them would make the panels fiction.

## Recommended defaults

- Theme: Arc Cyan
- FPS: 30
- Animation speed: 100%
- Glow: 100%
- HUD opacity: 92%
- Audio-reactive reactor: On
- Audio sensitivity: 100%
- Effect intensity: Standard
- Reactor spectacle / alert states / cycling deck / callouts / commentary: On
- Top safe area: 44 px

## Performance

30 FPS is the recommended balance for a desktop wallpaper. Lower the frame rate to 20 FPS and disable ambient particles if you want minimal GPU usage.
