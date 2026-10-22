import { initialTool } from './tools.js';
import { Renderer, MODEL_WIDTH, hitStroke } from './renderer.js';
import { slideKey } from './coordinates.js';
import { History } from './strokes.js';
import { createStorage } from './storage.js';
import { emptyDocument, parseDocument, serialize, download } from './export.js';
import { bindInput } from './input.js';
import { createToolbar } from './toolbar.js';

export default function RevealInk() {
  let reveal, root, config, data, storage, toolbar, renderer, input, slide, key;
  let canvas = false, baseKey;
  let tool = 'navigate', draft = null, before = null, last = null, disposed = false;
  let writable = false, queue = Promise.resolve(), revision = 0;
  const history = new History(), listeners = [];
  const canvasOffsets = new Map();
  const offset = () => canvas ? canvasOffsets.get(baseKey) || 0 : 0;
  const scrollMaximum = () => Math.min(90, strokes().reduce((max, s) => s.points.reduce((m, p) => Math.max(m, p[1]+1), max), Math.max(3, offset()+2)));
  function layout() {
    if (!slide) return;
    const {width, height} = size();
    renderer.layout(slide, width, height, root, reveal.getScale(), offset());
    toolbar.scroll(offset(), scrollMaximum());
  }
  function scrollTo(position) {
    if (!canvas || blocked()) return;
    input?.finish();
    canvasOffsets.set(baseKey, Math.max(0, Math.min(90, position)));
    layout();
  }
  const settings = () => config[tool === 'highlighter' ? 'highlighter' : 'pen'];
  const size = () => reveal.getComputedSlideSize();
  const aspect = () => size().width / size().height;
  const strokes = () => data.slides[key] || [];
  const on = (name, fn) => { reveal.on(name, fn); listeners.push([name, fn]); };
  const blocked = () => reveal.isOverview() || reveal.isPaused() || reveal.isScrollView?.();
  function update() {
    toolbar.update(tool, history.entry(key), settings());
    toolbar.canvas(canvas);
    toolbar.scroll(offset(), scrollMaximum());
    root.classList.toggle('ink-active', tool !== 'navigate' && !blocked());
    toolbar.hide(!!blocked());
  }
  function paint() { if (slide) { renderer.surface(slide).classList.toggle('ink-extra-canvas', canvas); renderer.render(slide, strokes(), aspect()); } }
  function save() {
    if (!writable || !config.storage.autosave) return queue;
    const snapshot = structuredClone(data), current = ++revision;
    toolbar.status('Saving…');
    queue = queue.then(() => storage.save(config.presentation, snapshot)).then(() => {
      if (!disposed && current === revision) toolbar.status('Saved on this device');
    }).catch(error => {
      if (!disposed) toolbar.status('Save failed — export a backup', true);
      console.error('Reveal Ink:', error);
    });
    return queue;
  }
  function commit(previous) {
    if (previous !== strokes()) { history.record(key, previous, strokes()); save(); }
    paint(); update();
  }
  function finish() {
    if (!before) return;
    if (draft) data.slides[key] = [...before, draft];
    const previous = before; before = null; draft = null; last = null;
    commit(previous);
  }
  function refresh() {
    input?.finish();
    const nextSlide = reveal.getCurrentSlide();
    if (slide !== nextSlide) { if (slide) renderer.surface(slide).classList.remove('ink-extra-canvas'); canvas = false; }
    slide = nextSlide;
    if (!slide) return;
    baseKey = slideKey(slide, reveal.getIndices(slide));
    key = canvas ? `canvas:${baseKey}` : baseKey;
    layout(); paint(); update();
  }
  function toggleCanvas() {
    input?.finish();
    if (!slide) return;
    canvas = !canvas;
    key = canvas ? `canvas:${baseKey}` : baseKey;
    layout(); paint(); update();
  }
  function setTool(value) {
    if (!['pen', 'highlighter', 'eraser', 'navigate'].includes(value)) throw new Error('Unknown ink tool');
    input?.finish(); tool = value; if (slide) update();
  }
  function edit(kind) {
    input?.finish(); if (!slide) return;
    const value = history[kind](key);
    if (value) { data.slides[key] = value; paint(); update(); save(); }
  }
  function erase(point) {
    const remaining = strokes().filter(s => !hitStroke(s, last || point, point, aspect(), config.eraser.radius));
    if (remaining.length !== strokes().length) data.slides[key] = remaining;
    last = point;
  }
  async function importJSON(value) {
    const next = parseDocument(value, config.presentation);
    input?.finish(); data = next; history.clear(); paint(); update(); await save();
  }
  const api = {
    id: 'ink',
    async init(deck) {
      reveal = deck;
      const opts = reveal.getConfig().ink || {};
      if (opts.enabled === false) return;
      tool = initialTool(opts.initialTool);
      config = {
        presentation: opts.presentation || `${location.origin}${location.pathname}`,
        pen: { width: 3.5, color: '#ffffff', thinning: 0.2, smoothing: 0.35, streamline: 0.15, pressure: true, ...opts.pen },
        highlighter: { width: 14, color: '#feffb3', thinning: 0, smoothing: 0.35, streamline: 0.15, pressure: false, ...opts.highlighter },
        eraser: { radius: 12, ...opts.eraser },
        storage: { type: 'indexeddb', autosave: true, ...opts.storage }
      };
      root = reveal.getRevealElement(); renderer = new Renderer();
      data = emptyDocument(config.presentation);
      toolbar = createToolbar(root, {
        tool: setTool, canvas: toggleCanvas, scrollTo, scrollBy: amount => scrollTo(offset()+amount),
        filter(name, value) { input?.finish(); settings()[name] = value; }, undo: () => edit('undo'), redo: () => edit('redo'),
        color(value) { input?.finish(); if (tool === 'eraser') tool = 'pen'; settings().color = value; update(); },
        width(value) { input?.finish(); settings().width = value; },
        clear() { input?.finish(); if (!slide || !strokes().length) return; const old = strokes(); data.slides[key] = []; commit(old); },
        export() { input?.finish(); download(data); },
        async import(file) {
          try {
            if (file.size > 50 * 1024 * 1024) throw new Error('Annotation file is too large');
            await importJSON(await file.text());
          } catch (error) { toolbar.status(`Import failed: ${error.message}`, true); }
        }
      }, config);
      toolbar.hide(true);
      try {
        storage = createStorage(config.storage); await storage.open();
        const stored = await storage.load(config.presentation);
        if (stored) data = parseDocument(stored, config.presentation);
        writable = true;
        toolbar.status(config.storage.autosave ? '' : 'Autosave off — export to keep', !config.storage.autosave);
      } catch (error) {
        // Never overwrite data that could not be read or migrated.
        toolbar.status('Storage unavailable — use Export', true); console.error('Reveal Ink:', error);
      }
      if (disposed) { storage?.close(); return; }
      input = bindInput(root, {
        enabled: () => !!slide && tool !== 'navigate' && !blocked(),
        surface: () => slide && renderer.surface(slide),
        canvas: () => canvas && !blocked(),
        scroll: pixels => scrollTo(offset() + pixels / (size().height * reveal.getScale())),
        start(point, pointerType) {
          toolbar.collapse();
          before = strokes(); last = point;
          if (tool === 'eraser') { erase(point); paint(); return; }
          const p = settings();
          draft = { id: globalThis.crypto?.randomUUID?.() || `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            tool, width: p.width, color: p.color, aspect: aspect(),
            options: { thinning: p.pressure ? p.thinning : 0, smoothing: p.smoothing, streamline: p.streamline,
              simulatePressure: p.pressure && pointerType !== 'pen' }, points: [point] };
          renderer.preview(slide, draft);
        },
        move(points) {
          for (const p of points) {
            if (draft) {
              const prev = draft.points.at(-1);
              if (Math.hypot((p[0]-prev[0])*MODEL_WIDTH, (p[1]-prev[1])*MODEL_WIDTH/aspect()) > 0.1 || p[2] !== prev[2]) draft.points.push(p);
            } else erase(p);
          }
        },
        preview() { if (draft) renderer.preview(slide, draft); else paint(); },
        pressure: () => draft?.points.at(-1)?.[2] || 0.5,
        finish
      });
      let settleFrame;
      const refreshWhenCentered = (attempt = 0) => {
        const current = reveal.getCurrentSlide();
        const viewport = root.getBoundingClientRect();
        const rect = current?.getBoundingClientRect();
        const centered = rect && Math.abs((rect.left+rect.width/2) - (viewport.left+viewport.width/2)) < 2;
        if (centered || attempt >= 120) { refresh(); settleFrame = 0; return; }
        settleFrame = requestAnimationFrame(() => refreshWhenCentered(attempt+1));
      };
      const changed = () => {
        refresh();
        cancelAnimationFrame(settleFrame);
        settleFrame = requestAnimationFrame(() => refreshWhenCentered());
      };
      on('slidechanged', changed);
      for (const name of ['ready', 'slidetransitionend', 'resize', 'overviewshown', 'overviewhidden', 'paused', 'resumed', 'scrollviewactivated', 'scrollviewdeactivated']) on(name, refresh);
      // Reveal may recenter a slide after fonts/media load or a second layout
      // pass without changing scale (and therefore without a resize event).
      // Watch only slide ancestors, never the SVG styles that layout() writes.
      const layoutObserver = new MutationObserver(records => {
        const current = reveal.getCurrentSlide();
        if (current && records.some(record => record.target.contains(current))) {
          cancelAnimationFrame(settleFrame);
          settleFrame = requestAnimationFrame(() => refreshWhenCentered());
        }
      });
      layoutObserver.observe(reveal.getSlidesElement(), { subtree: true, attributes: true, attributeFilter: ['style'] });
      // Flush the current partial stroke before a tab is hidden or navigated away.
      const flush = () => input?.finish();
      window.addEventListener('pagehide', flush);
      const visibility = () => { if (document.hidden) flush(); };
      document.addEventListener('visibilitychange', visibility);
      api.cleanup = () => { layoutObserver.disconnect(); cancelAnimationFrame(settleFrame); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
      if (reveal.isReady()) refresh();
    },
    setTool, toggleCanvas, scrollCanvas: scrollTo,
    undo: () => edit('undo'), redo: () => edit('redo'),
    clear() { input?.finish(); if (slide && strokes().length) { const old = strokes(); data.slides[key] = []; commit(old); } },
    exportJSON() { input?.finish(); return serialize(data); },
    importJSON,
    flush() { input?.finish(); return queue; },
    async destroy() {
      input?.destroy(); disposed = true;
      for (const [name, fn] of listeners) reveal.off(name, fn);
      api.cleanup?.(); toolbar?.destroy(); renderer?.destroy(); root?.classList.remove('ink-active');
      await queue; storage?.close();
    }
  };
  return api;
}
