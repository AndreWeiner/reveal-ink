# Reveal Ink

Small, vector-based handwriting plugin for Reveal.js 6. Built for Pointer Events and iPad Safari / Apple Pencil. The first implementation is browser-tested in Chromium; real iPad handwriting latency, pressure feel and palm rejection still require hardware testing.

## Try it

From `/home/andre/Development/reveal-ink`:

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:8001/demo/`. The demo is independent of the lecture repositories.

For an iPad on the same network, run `npm start -- --host 0.0.0.0` and open `http://YOUR-COMPUTER-LAN-IP:8001/demo/` in Safari. Use a trusted network. The iPad stores its own annotations; it does not share your desktop browser's storage.

## Controls

- **Pen** / **Highlight**: Apple Pencil or a mouse draws. Finger input is left to Reveal's swipe navigation.
- **Navigate**: normal mouse links, selection and slide interactions. SVG paths never receive pointer events.
- **Erase**: remove whole strokes touched by an eraser sweep; radius defaults to 12 model units.
- **Undo** / **Redo**: per-slide editing history, up to 100 commands. An eraser gesture is one command. Clear is undoable. History lasts for the current browser session; saved strokes survive reloads.
- **Colors & more**: pen/highlighter color (White, Black, C0–C4 presets or a custom color) and width, clear current slide, JSON export and import.

Import explicitly replaces *all* annotations for the current presentation, after validation. The toolbar asks for confirmation. Export a backup first. Import resets undo history. Files use `<presentation>.annotations.json` with a filesystem-safe name.

The toolbar hides during overview, pause and scroll view. Drawing is supported in normal slide view. Finger navigation remains handled by Reveal; browser-native touch panning is disabled over the slide while a drawing tool is selected. Navigate restores normal touch-action. Palm touches during an active Pencil stroke cannot trigger Reveal swipes. Palm touches before/after a Pencil stroke remain a hardware/browser behavior to evaluate on iPad.

## Add to a deck

```html
<link rel="stylesheet" href="plugin/ink/v0.1.0/ink.css">
<script src="plugin/ink/v0.1.0/ink.js"></script>
<script>
Reveal.initialize({
  plugins: [RevealInk],
  ink: {
    enabled: true,
    presentation: 'lecture-05',
    pen: {
      width: 3.5, color: '#ffffff', thinning: 0.2,
      smoothing: 0.7, streamline: 0.65, pressure: true
    },
    highlighter: { width: 14, color: '#feffb3' },
    eraser: { radius: 12 },
    storage: { type: 'indexeddb', autosave: true }
  }
});
</script>
```

ES module: `import RevealInk from './plugin/ink/v0.1.0/ink.mjs'`. The factory creates an isolated plugin instance for each Reveal deck. Standard global registration uses `plugins: [RevealInk]`.

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

Portable format version 1:

```json
{
  "version": 1,
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

`aspect` is the original slide width/height. `options` preserve the appearance when settings change. Import validates schema, bounds, tool/color values and total point count; unknown versions are rejected pending an explicit migration. No slide images or HTML are stored.

### Future storage / remote sync

Rendering and input do not access IndexedDB directly. `ink.storage.adapter` can supply an object with asynchronous `open()`, `load(presentation)`, `save(presentation, document)` and `close()` methods. `save()` must resolve only when the write succeeds. A future adapter can wrap IndexedDB plus an outbound REST queue; local writes should remain authoritative and immediate. Remote sync, conflict resolution and authentication are deliberately not implemented in this release; no annotation data is sent to a server.

## Development

Source modules in `src/` separate input, coordinates, model/history, renderer, toolbar, serialization, storage and Reveal lifecycle. Vite builds `dist/ink.js`, `dist/ink.mjs`, and copies CSS, licenses and a version file. Build outputs are ignored by Git; source and the dependency lockfile are tracked.

The sole added dependency is MIT-licensed **perfect-freehand 1.2.3**, bundled in the output (about 7.4 kB gzipped for the whole plugin). It generates pressure-sensitive stroke outlines; SVG renders them. No CDN or raster canvas is needed for ink.

```sh
npm test
npm run test:browser
npm run build
```

Browser tests use a temporary browser profile and local server. They cover synthetic pen/coalesced/pressure input, touch exclusion, real mouse capture, cancellation, erasing, history, import validation, IndexedDB reload, nested slides, resize, overview, links and cleanup. Automated tests cannot establish Apple Pencil feel.

### iPad acceptance checklist

- Open the demo in Safari; write small equations and compare slow/fast strokes and pressure variation.
- Test portrait, landscape, browser resize and toolbar controls with Pencil and fingers.
- Rest a palm while writing; check there are no unintended slide changes. Check normal finger swipes between strokes.
- Navigate horizontally and vertically, enter/leave overview, and return to earlier notes.
- Reload, close/reopen Safari, and verify notes; check “Saved on this device” before closing.
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

The copy command creates `plugin/ink/v0.1.0/` in the destination, including JS, CSS, licenses, version and SHA-256 checksums. It refuses to replace an existing release with different contents. Update each lecture's script and stylesheet paths to the paths it prints. Include `RevealInk` in the plugin list. Commit the versioned assets with the lecture changes.

For a later release, update the package version and lockfile, run the checks, commit and tag the source, then copy that new version to each lecture that should receive it. Old lecture releases stay unchanged until explicitly upgraded. The first local source tag is `v0.1.0`.

`private: true` prevents accidental npm publication. There is no Git remote or published npm package configured yet.
