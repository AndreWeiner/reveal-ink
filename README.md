# Reveal Ink

Small, vector-based handwriting plugin for Reveal.js 6. Built for Pointer Events and iPad Safari / Apple Pencil. The first implementation is browser-tested in Chromium; real iPad handwriting latency, pressure feel and palm rejection still require hardware testing.

[**Open the live demo**](https://andreweiner.github.io/reveal-ink/) — works directly in iPad Safari.

## Run the demo

Requires Node.js **22.12 or newer**. From your `reveal-ink` checkout:

```sh
npm ci
npm run build
npm start
```

Open [the local demo](http://localhost:8001/demo/). Stop the server with **Ctrl+C**. The demo is independent of the lecture repositories.

For an iPad on the same network, run `npm start -- --host 0.0.0.0` and open `http://YOUR-COMPUTER-LAN-IP:8001/demo/` in Safari. Use a trusted network. The iPad stores its own annotations; it does not share your desktop browser's storage.

## Write and save annotations

A small red dot marks the stylus position during contact and whenever the device/browser supplies pen hover events. iPads without Pencil hover can only show it during contact. The dot is temporary and is not saved or exported; mouse input keeps the crosshair.

1. Open a presentation that includes Reveal Ink. **Pen** is selected initially, with **white** ink; choose Black for a white slide background.
2. Write using an Apple Pencil/stylus, or hold the primary mouse button and drag. Finger input does not draw. Use Navigate mode for finger swipes or slide arrows; drawing mode blocks both to prevent palm navigation.
3. To change ink, choose **Pen** or **Highlight**, then tap a preset in the vertical palette on the left edge. It stays visible while writing and hides in Navigate mode. Tap the eraser icon below the colors to erase; tap a color to return to the pen. For a custom color or to adjust **Width**, open **More**. Pen and highlighter keep separate settings during the session. These choices affect new strokes; existing annotations keep their colors and widths.
4. Choose **Navigate** when you want normal mouse interaction with links or slide content. Return to Pen to write again.
5. Move to another slide and return: the ink belongs to its original slide. Strokes save automatically after you finish writing. Normal saves do not add text to the toolbar; errors remain visible.
6. After a lecture, choose **More → Export JSON** to download a backup. Export includes annotations from **all slides in the current presentation**, including slides that are not visible. It contains vector strokes, not slide text, images, or screenshots.
7. To restore or transfer notes, open the matching presentation in the destination browser and choose **More → Import JSON…**. Select the backup and confirm replacement. This replaces all annotations in that presentation, not only the current slide. Matching slide IDs (or fallback indices) are needed to display the notes on the correct slides.

Notes are local to each browser/device; export/import is how you transfer them. Changing the default pen color does not recolor saved notes. Tool and color selections reset on reload; annotations persist.

### Color presets

| Preset | Hex value |
| --- | --- |
| White (default pen) | `#ffffff` |
| Black | `#000000` |
| C0 | `#8dd3c7` |
| C1 (default highlighter) | `#feffb3` |
| C2 | `#bfbbd9` |
| C3 | `#fa8174` |
| C4 | `#81b1d2` |

These are built-in presets matching the lecture template; they do not require the host deck to define CSS variables.

The toolbar automatically collapses when a pen, highlighter or eraser gesture starts and stays out of the way. Tap the small **⌃** button at the bottom to bring it back. **⌄** hides it manually.

### Extra working space

Tap the **page-with-plus icon** (Extra canvas) at the bottom of the left color palette to open a blank dark canvas associated with the current slide. It has separate strokes and undo/redo history. Tap the same icon again to return to the slide; reopening Extra canvas restores its notes. There is one extra canvas per slide. Scroll it with two fingers, a mouse wheel, or the right-edge slider; the down-arrow button advances into more blank space. The scroll range extends as you move down or add ink, up to 90 slide heights. One-finger swipes stay blocked to reduce accidental palm scrolling. Scrolling is blocked during active pen strokes. Notes below the initial area are saved/exported normally; reopening the presentation starts at the top, and the scrollbar lets you return to lower notes. It is included in autosave and JSON export under `canvas:<slide-key>`; no lecture slide is inserted or reordered. Clear affects only the currently displayed slide/canvas. Moving to another slide returns to normal slide view.

Writing now extends to the presentation edges, except where palette/tool buttons occupy space. Margin ink stays anchored to the slide on resizing; very narrow viewports can clip margin notes. Stroke outlines use quadratic curves and lower-delay smoothing defaults.

## Controls

- **Pen** / **Highlight**: Apple Pencil or a mouse draws. Slide arrows and finger swipes are disabled while a drawing tool is selected.
- **Navigate**: normal mouse links, selection and slide interactions. SVG paths never receive pointer events.
- **Erase**: remove whole strokes touched by an eraser sweep; radius defaults to 12 model units.
- **Undo** / **Redo**: per-slide editing history, up to 100 commands. An eraser gesture is one command. Clear is undoable. History lasts for the current browser session; saved strokes survive reloads.
- **More**: custom pen/highlighter color and width, clear current slide, JSON export and import.

Import explicitly replaces *all* annotations for the current presentation, after validation. The toolbar asks for confirmation. Export a backup first. Import resets undo history. Files use `<presentation>.annotations.json` with a filesystem-safe name.

The toolbar hides during overview, pause and scroll view. Drawing is supported in normal slide view. In Navigate mode, Reveal handles finger navigation. In drawing mode, touch navigation and slide arrows are disabled, and browser-native touch panning is blocked. Navigate restores normal touch-action. Drawing mode blocks Reveal touch swipes even between Pencil strokes. Actual Pencil pressure feel and palm behavior still need hardware testing.

## Add to an existing Reveal.js deck

Build the plugin and copy its versioned release into your lecture repository:

```sh
npm ci
npm run build
node scripts/copy-release.mjs /path/to/lecture-repository
```

This creates `plugin/ink/v0.3.5/` with the JavaScript, CSS, version, checksums and licenses. Keep these files together when distributing the lecture. It does not rewrite your lecture HTML.

Add the stylesheet in the HTML `<head>`. Load `ink.js` **after Reveal.js itself**, then append `RevealInk` to your existing `plugins` array and add the `ink` settings to your existing `Reveal.initialize` call. Keep any existing plugins such as math, markdown or notes; do not initialize Reveal a second time.

For example, assuming the deck already loads Reveal.js:

```html
<link rel="stylesheet" href="plugin/ink/v0.3.5/ink.css">
<script src="plugin/ink/v0.3.5/ink.js"></script>
<script>
Reveal.initialize({
  plugins: [RevealInk],
  ink: {
    enabled: true,
    presentation: 'lecture-05',
    pen: {
      width: 3.5, color: '#ffffff', thinning: 0.2,
      smoothing: 0.35, streamline: 0.15, pressure: true
    },
    highlighter: { width: 14, color: '#feffb3' },
    eraser: { radius: 12 },
    storage: { type: 'indexeddb', autosave: true }
  }
});
</script>
```

ES module: `import RevealInk from './plugin/ink/v0.3.5/ink.mjs'`. The factory creates an isolated plugin instance for each Reveal deck. Standard global registration uses `plugins: [RevealInk]`.

Use `const ink = Reveal.getPlugin('ink')` for:

```js
ink.setTool('pen'); // navigate | pen | highlighter | eraser
ink.undo(); ink.redo(); ink.clear();
const json = ink.exportJSON();
await ink.importJSON(json); // replaces all annotations, no API confirmation dialog
await ink.flush(); // finish a partial stroke and wait for queued autosaves
await ink.destroy(); // remove DOM/listeners and close storage after pending writes
```

If `enabled: false`, no overlay or storage is created. Enable by reinitializing the plugin/deck. Color values are six-digit hex. Width and radius are measured against a 960-unit reference slide width. Normalized positions and stored aspect ratio allow the same vector stroke to resize with the deck without changing its data. Pen settings apply to new strokes only. Pencil uses actual pressure; mouse input simulates pressure from movement. Set `pressure: false` for constant width.

## Slide and presentation identity

By default presentation identity is `location.origin + location.pathname`, excluding the slide hash and query string. Set `ink.presentation` explicitly to keep a logical identity across URL changes. IndexedDB is still isolated by browser origin: changing host, port or protocol requires exporting/importing your annotations.

Prefer persistent, unique slide IDs:

```html
<section id="spod-eigenvalue-problem">...</section>
```

Keys are `id:spod-eigenvalue-problem`, falling back to `index:H:V`. Slides with IDs retain notes when unrelated slides are inserted or reordered. Index-based notes cannot follow reordered slides. Existing lecture markup is left intact; the demo uses explicit IDs. Do not reuse IDs within a deck.

## Storage and backups

IndexedDB database `reveal-ink`, database version 1, store `presentations`, keyed by presentation identity. Saves are ordered, with a snapshot after each completed stroke/edit/import. Input cancellation, lost pointer capture, slide changes and page hiding finish the current partial stroke. The toolbar reports save failures and unavailable storage; it never silently substitutes nonpersistent storage or overwrites data it could not read.

Browser local data can be removed by clearing site data, private browsing, storage eviction or device failure. Export JSON for durable backups. Use one active editing tab per presentation: multi-tab merging is not implemented (last completed save wins).

Portable format version 2 (version 1 imports are migrated automatically):

```json
{
  "version": 2,
  "presentation": "lecture-05",
  "slides": {
    "id:spod-eigenvalue-problem": [{
      "id": "stroke-example",
      "tool": "pen",
      "width": 3.5,
      "color": "#fa8174",
      "aspect": 1.3714285714285714,
      "options": {
        "thinning": 0.2,
        "smoothing": 0.7,
        "streamline": 0.65,
        "simulatePressure": false
      },
      "points": [[0.214, 0.384, 0.42], [0.216, 0.386, 0.51]]
    }]
  }
}
```

`aspect` is the original slide width/height. Coordinates remain relative to the slide, but version 2 permits x/y outside [0,1] for ink in the viewport margins (bounded to [-100,100]); pressure stays in [0,1]. The database version remains 1. Version 2 exports require Reveal Ink 0.2.0 or newer. Avoid editing the same presentation in old and new plugin versions at once.  `options` preserve the appearance when settings change. Import validates schema, bounds, tool/color values and total point count; unknown versions are rejected pending an explicit migration. No slide images or HTML are stored.

### Future storage / remote sync

Rendering and input do not access IndexedDB directly. `ink.storage.adapter` can supply an object with asynchronous `open()`, `load(presentation)`, `save(presentation, document)` and `close()` methods. `save()` must resolve only when the write succeeds. A future adapter can wrap IndexedDB plus an outbound REST queue; local writes should remain authoritative and immediate. Remote sync, conflict resolution and authentication are deliberately not implemented in this release; no annotation data is sent to a server.

## Development

Source modules in `src/` separate input, coordinates, model/history, renderer, toolbar, serialization, storage and Reveal lifecycle. Vite builds `dist/ink.js`, `dist/ink.mjs`, and copies CSS, licenses and a version file. Build outputs are ignored by Git; source and the dependency lockfile are tracked.

The only third-party library bundled into the ink JavaScript is **perfect-freehand**. Reveal.js is supplied by the host presentation. See [Acknowledgements and licenses](#acknowledgements-and-licenses) for dependencies and upstream links.

```sh
npm run build
npm test
npm run test:browser
```

Browser tests use a temporary browser profile and local server. They cover synthetic pen/coalesced/pressure input, touch exclusion, real mouse capture, cancellation, erasing, history, import validation, IndexedDB reload, nested slides, resize, overview, links and cleanup. Automated tests cannot establish Apple Pencil feel.

### iPad acceptance checklist

- Open the demo in Safari; write small equations and compare slow/fast strokes and pressure variation.
- Test portrait, landscape, browser resize and toolbar controls with Pencil and fingers.
- Rest a palm while writing; check there are no unintended slide changes. Check normal finger swipes between strokes.
- Navigate horizontally and vertically, enter/leave overview, and return to earlier notes.
- Reload, close/reopen Safari, and verify notes; allow completed strokes to finish saving before closing.
- Erase between sampled points; undo/redo and clear/undo. Export, clear, import and verify.
- Try Navigate on links/buttons and verify browser interaction resumes.
- Test with storage unavailable or private browsing; export rather than relying on browser persistence.


## Release and use in lecture repositories

This repository is the source of truth. Lecture repositories keep a pinned copy of the compiled assets; they do not need this repository, Node.js, or a submodule to serve their slides.

```sh
npm ci
npm test
npm run build
npm run test:browser
node scripts/copy-release.mjs /path/to/lecture-repository
```

The copy command creates `plugin/ink/v0.3.5/` in the destination, including JS, CSS, licenses, version and SHA-256 checksums. It refuses to replace an existing release with different contents. Update each lecture's script and stylesheet paths to the paths it prints. Include `RevealInk` in the plugin list. Commit the versioned assets with the lecture changes.

For a later release, update the package version and lockfile, run the checks, commit and tag the source, then copy that new version to each lecture that should receive it. Old lecture releases stay unchanged until explicitly upgraded. The first local source tag is `v0.1.0`.

`private: true` prevents accidental npm publication. There is no Git remote or published npm package configured yet.


## Troubleshooting

- **Changes do not appear:** reload the page. If a development server still serves an old bundle, restart that server. Rebuild after changing plugin source. Lecture repositories use their copied release, so edits in this repository do not automatically update lectures.
- **White ink is invisible:** select Black or another contrasting preset on a light slide background.
- **Notes are missing:** check the browser/device, host/port/protocol, presentation identity and slide IDs. Import your JSON backup if you changed any of these.
- **Storage unavailable / save failed:** drawing and export remain available, but do not rely on local persistence. Export a backup before closing.

## Acknowledgements and licenses

Reveal Ink's integration, input handling, toolbar, storage, history and export code were developed for this project. Its smooth stroke outlines are generated by perfect-freehand. It does **not** incorporate code from the previously used Reveal.js Chalkboard or CustomControls plugins.

| Project | Version used | Role | License |
| --- | --- | --- | --- |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand), by Steve Ruiz / Stephen Ruiz Ltd | 1.2.3 | Generates pressure-sensitive stroke outlines; bundled into `ink.js` and `ink.mjs` | MIT |
| [Reveal.js](https://github.com/hakimel/reveal.js), by Hakim El Hattab and contributors | 6.0.2 | Host presentation framework and standalone demo dependency; not bundled into the ink JavaScript | MIT |
| [Vite](https://github.com/vitejs/vite), by the Vite contributors | 8.2.2 | Development server and build tool; not bundled into the ink JavaScript | MIT |
| [Puppeteer](https://github.com/puppeteer/puppeteer), by the Puppeteer authors | 25.8.0 | Browser automation for tests; not bundled into the ink JavaScript | Apache-2.0 |

The C0–C4 presets were taken from the supplied lecture template, which identifies the palette as Matplotlib's dark-style colors. Standard browser Pointer Events, SVG and IndexedDB provide input, rendering and local persistence; they are browser APIs, not additional plugin dependencies.

- Reveal Ink's own MIT license is in [LICENSE](LICENSE).
- The complete perfect-freehand copyright notice and MIT license are preserved in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). The build copies this to `dist/ink.LICENSE.txt`, and the release-copy command includes it in every lecture release alongside Reveal Ink's own `LICENSE`. Retain both when redistributing those files.
- Reveal.js and the development tools retain their own license files in their installed packages. The host lecture must retain the notices for the Reveal.js files it distributes as well.
- `package-lock.json` records the exact development dependency tree, including transitive packages. The table describes direct dependencies, not every transitive build/test package.

### Handwriting response

Under **More**, **Smoothing** adjusts outline roundness (default 0.35), and **Stabilizer** filters motion (default 0.15). Reduce Stabilizer toward zero for the closest pen tracking; increase it to steady shaky motion. Each pen/highlighter has separate session settings. Changes apply to new strokes; existing strokes preserve their settings.

## Publish the demo

GitHub Pages serves the committed `docs/` folder from `main`. To update it, run `npm ci` and `npm run build:demo`, then commit and push the source changes together with `docs/`. The generated demo bundles Reveal.js, fonts, the ink plugin, and their licenses; no CDN or local server is needed. Annotations stay in the visitor’s browser.
