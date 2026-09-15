export const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));

export function normalizePoint(event, rect, margins = false) {
  if (!(rect.width > 0 && rect.height > 0)) throw new Error('Ink surface has no size');
  return [clamp((event.clientX - rect.left) / rect.width, margins ? -100 : 0, margins ? 100 : 1),
    clamp((event.clientY - rect.top) / rect.height, margins ? -100 : 0, margins ? 100 : 1),
    clamp(event.pressure > 0 ? event.pressure : 0.5)];
}

export function denormalizePoint([x, y, pressure], width, height) {
  return [x * width, y * height, pressure];
}

export function slideKey(slide, indices) {
  return slide.id ? `id:${slide.id}` : `index:${indices.h}:${indices.v || 0}`;
}

// Distance to a segment (rather than only recorded samples) avoids gaps in erasing.
export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = dx || dy ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
