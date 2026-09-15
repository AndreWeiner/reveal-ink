import { normalizePoint } from './coordinates.js';
export function bindInput(root, handlers) {
  const abort = new AbortController();
  let active = null, frame = 0, suppressClickUntil = 0;
  const listen = (type, fn, options = {}) => root.addEventListener(type, fn, { capture: true, signal: abort.signal, ...options });
  const consume = event => { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); };
  function samples(event) {
    let events = event.getCoalescedEvents?.() || [];
    if (!events.length) events = [event];
    return events.map(e => normalizePoint(e, active.rect));
  }
  function finish(event) {
    if (!active || (event && event.pointerId !== active.id)) return;
    const old = active; active = null;
    cancelAnimationFrame(frame); frame = 0;
    handlers.finish();
    if (root.hasPointerCapture?.(old.id)) root.releasePointerCapture(old.id);
    suppressClickUntil = performance.now() + 400;
  }
  listen('pointerdown', event => {
    if (active) { if (event.pointerType !== 'touch') consume(event); return; }
    if (!['pen', 'mouse'].includes(event.pointerType) || event.button !== 0 || !handlers.enabled()) return;
    if (event.target.closest('button, input, select, textarea, .reveal-ink-toolbar, .controls')) return;
    const surface = handlers.surface();
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    consume(event);
    active = { id: event.pointerId, rect };
    handlers.start(normalizePoint(event, rect), event.pointerType);
    try { root.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no native capture. */ }
  });
  listen('pointermove', event => {
    if (!active || active.id !== event.pointerId) return;
    consume(event); handlers.move(samples(event));
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; handlers.preview(); });
  });
  listen('pointerup', event => {
    if (!active || active.id !== event.pointerId) return;
    consume(event);
    // Pointer-up pressure commonly drops to zero; retain the last drawing pressure.
    handlers.move([normalizePoint({ clientX: event.clientX, clientY: event.clientY, pressure: handlers.pressure() }, active.rect)]);
    finish(event);
  });
  listen('pointercancel', finish);
  listen('lostpointercapture', finish);
  // Reveal uses Touch Events for swipes. Stop them only while a pen/mouse stroke is active.
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    listen(type, event => { if (active) consume(event); }, { passive: false });
  }
  listen('click', event => {
    if (performance.now() < suppressClickUntil && !event.target.closest('.reveal-ink-toolbar')) consume(event);
  });
  return { finish: () => finish(), destroy() { finish(); abort.abort(); cancelAnimationFrame(frame); } };
}
