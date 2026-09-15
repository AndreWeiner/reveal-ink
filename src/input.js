import { normalizePoint } from './coordinates.js';
export function bindInput(root, handlers) {
  const abort = new AbortController();
  let active = null, frame = 0, suppressClickUntil = 0;
  const listen = (type, fn, options = {}) => root.addEventListener(type, fn, { capture: true, signal: abort.signal, ...options });
  // A transient pen cursor, separate from annotation data and SVG export.
  const cursor = document.createElement('span');
  cursor.className = 'reveal-ink-pen-cursor'; cursor.hidden = true;
  cursor.setAttribute('aria-hidden', 'true'); root.append(cursor);
  let cursorPointer = null;
  const hideCursor = () => { cursor.hidden = true; cursorPointer = null; };
  function trackCursor(event) {
    // Palm events must not displace the stylus marker.
    if (event.pointerType === 'touch') return;
    if (event.pointerType !== 'pen' || !handlers.enabled()) { hideCursor(); return; }
    const bounds = root.getBoundingClientRect();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom || !target || !root.contains(target) ||
        target.closest('button, input, select, textarea, .reveal-ink-toolbar, .reveal-ink-palette, .reveal-ink-scroll, .controls')) {
      hideCursor(); return;
    }
    const scaleX = root.offsetWidth / bounds.width, scaleY = root.offsetHeight / bounds.height;
    cursor.style.left = `${(event.clientX - bounds.left) * scaleX - root.clientLeft}px`;
    cursor.style.top = `${(event.clientY - bounds.top) * scaleY - root.clientTop}px`;
    cursor.style.width = `${6 * scaleX}px`; cursor.style.height = `${6 * scaleY}px`;
    cursorPointer = event.pointerId; cursor.hidden = false;
  }
  listen('pointerdown', trackCursor);
  listen('pointermove', trackCursor);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) {
    listen(type, event => {
      if (event.pointerId === cursorPointer && (type !== 'pointerleave' || event.target === root)) hideCursor();
    });
  }
  window.addEventListener('blur', hideCursor, { signal: abort.signal });
  const consume = event => { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); };
  function samples(event) {
    let events = event.getCoalescedEvents?.() || [];
    if (!events.length) events = [event];
    return events.map(e => normalizePoint(e, active.rect, true));
  }
  function finish(event) {
    if (!active || (event && event.pointerId !== active.id)) return;
    const old = active; active = null;
    cancelAnimationFrame(frame); frame = 0;
    handlers.finish();
    if (root.hasPointerCapture?.(old.id)) root.releasePointerCapture(old.id);
    suppressClickUntil = performance.now() + 400;
  }
  const inkUI = target => target.closest('.reveal-ink-toolbar, .reveal-ink-toggle, .reveal-ink-palette, .reveal-ink-canvas-return, .reveal-ink-scroll');
  listen('pointerdown', event => {
    if (handlers.enabled() && event.target.closest('.controls')) { consume(event); return; }
    if (active) { if (event.pointerType !== 'touch') consume(event); return; }
    if (!['pen', 'mouse'].includes(event.pointerType) || event.button !== 0 || !handlers.enabled()) return;
    if (event.target.closest('button, input, select, textarea, .reveal-ink-toolbar, .controls')) return;
    const surface = handlers.surface();
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    consume(event);
    active = { id: event.pointerId, rect: surface.inkRect || rect };
    handlers.start(normalizePoint(event, active.rect, true), event.pointerType);
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
    handlers.move([normalizePoint({ clientX: event.clientX, clientY: event.clientY, pressure: handlers.pressure() }, active.rect, true)]);
    finish(event);
  });
  listen('pointercancel', finish);
  listen('lostpointercapture', finish);
  listen('wheel', event => {
    if (handlers.canvas() && !inkUI(event.target)) {
      consume(event);
      if (!active) handlers.scroll(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1));
    }
  }, { passive: false });
  let touchY = null;
  // Reveal uses Touch Events for swipes. Stop them only while a pen/mouse stroke is active.
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    listen(type, event => {
      if (handlers.canvas() && !inkUI(event.target)) {
        consume(event);
        if (!active && event.touches.length === 2) {
          const y = (event.touches[0].clientY + event.touches[1].clientY)/2;
          if (type === 'touchmove' && touchY !== null) handlers.scroll(touchY-y);
          touchY = y;
        } else touchY = null;
        return;
      }
      touchY = null;
      if (handlers.enabled() && (active || !inkUI(event.target))) consume(event);
    }, { passive: false });
  }
  listen('click', event => {
    if (handlers.enabled() && event.target.closest('.controls')) { consume(event); return; }
    if (performance.now() < suppressClickUntil && !event.target.closest('.reveal-ink-toolbar, .reveal-ink-toggle, .reveal-ink-palette, .reveal-ink-scroll, .reveal-ink-canvas-return')) consume(event);
  });
  return { finish() { hideCursor(); finish(); }, destroy() { hideCursor(); finish(); abort.abort(); cancelAnimationFrame(frame); cursor.remove(); } };
}
