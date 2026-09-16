# Contributing to Y.A.R.V.I.S.

Bug reports, documentation improvements, performance fixes, and interface enhancements are welcome. For substantial changes, open an issue first to discuss the intended behavior.

## Local setup

1. Fork the repository, clone your fork, and create a branch for your change.
2. Open `index.html` in a modern browser to preview the wallpaper. There is no dependency installation or frontend compilation step.
3. Use Lively Wallpaper on Windows to verify host telemetry, media metadata, audio input, and playback events. A browser preview uses demo telemetry and leaves the host link in `WAITING`.

Install Node.js 24 for the syntax and JSON checks below, and PowerShell 7 (`pwsh`) to build the wallpaper package.

## Project layout

- `index.html`: interface structure and accessible labels.
- `styles.css`: layout, colors, and visual effects.
- `app.js`: rendering, settings, and Lively callbacks.
- `LivelyInfo.json`: wallpaper metadata and requested Lively integrations.
- `LivelyProperties.json`: controls exposed in Lively's Customize Wallpaper panel.
- `thumbnail.jpg` and `preview.gif`: wallpaper previews.
- `build.ps1`: the package file list and ZIP creation.
- `version`: the package version, without a leading `v`.
- `.github/workflows/release.yml`: automated validation, packaging, and releases.

## Making changes

Follow the existing formatting and keep changes focused. When adding or changing a setting, keep `LivelyProperties.json`, the defaults and property handling in `app.js`, and relevant documentation consistent. If you add a runtime asset, include it in the `$packageFiles` list in `build.ps1`.

Preserve the browser demo and graceful handling of unavailable host data. Keep performance in mind: this interface runs continuously as a desktop wallpaper, with 30 FPS as the recommended default.

Use original assets or assets you have permission to redistribute, and include any required attribution. Do not add extracted film assets, Marvel artwork, or third-party branding. Contributions must be compatible with the project's [MIT license](LICENSE).

## Validation before a pull request

Run these commands from the repository root in PowerShell or a Unix shell:

```sh
node --check app.js
node -e "for (const file of ['LivelyInfo.json', 'LivelyProperties.json']) JSON.parse(require('node:fs').readFileSync(file, 'utf8'));"
pwsh -NoProfile -File ./build.ps1
```

The build creates `dist/YARVIS-v<version>.zip` using the value in `version`. To choose a different output file:

```sh
pwsh -NoProfile -File ./build.ps1 -OutputPath dist/YARVIS-local.zip
```

The package must contain `index.html`, the Lively JSON files, and the other packaged assets at the ZIP root. Import the generated ZIP into Lively to check the packaged result. Generated files in `dist/` are ignored by Git; do not commit them.

There is currently no automated behavior or rendering test suite. The workflow checks JavaScript syntax, parses the Lively JSON files, checks the package version, and builds the ZIP. For relevant changes, also verify:

- Browser startup, resizing, and the console for unexpected errors.
- Themes, custom colors, safe area, panel visibility, and other affected settings.
- Live CPU, GPU, RAM, and network telemetry in Lively.
- Media metadata and artwork, including the transition back to standby.
- Audio response, pause/resume behavior, and frame rate.
- Fallbacks when telemetry, media, audio, or battery information is unavailable.

## Issues and pull requests

For bug reports, include reproduction steps, expected and actual behavior, the wallpaper version, your Windows and Lively versions (or browser version), and relevant console errors. Screenshots or a short recording help with visual issues; remove private information before sharing them.

Open pull requests against the repository's default branch. Explain the problem, describe your change, link related issues, and list the checks you ran. Include before/after screenshots for visual changes. State when you could not test a Lively integration so reviewers know what remains to verify.

## Releases for maintainers

Pull requests, pushes to `master` or `main`, version-tag pushes, and manual workflow runs validate and package the wallpaper. Successful builds upload a `YARVIS` workflow artifact containing the package ZIP. Manual runs do not publish a GitHub release, even when run against a tag.

To publish a release:

1. Update `version` to the intended release number, without a leading `v`, and commit it with the release changes.
2. Ensure validation passes and check the package in Lively.
3. Create and push a matching `v<version>` tag on that commit. For example, a `version` value of `1.2.0` requires the tag `v1.2.0`.

The tag-push workflow rejects a tag/version mismatch. After validation and packaging succeed, it creates a GitHub release with generated notes and attaches `YARVIS-v<version>.zip`. Publishing uses the workflow's `GITHUB_TOKEN`, with `contents: write` granted only to the release job; no separate personal access token is needed.
