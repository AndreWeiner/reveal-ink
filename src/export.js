export const FORMAT_VERSION = 2;
export function emptyDocument(presentation) {
  return { version: FORMAT_VERSION, presentation, slides: Object.create(null) };
}

// Validate before replacing any live data. Reconstruct objects to reject unexpected fields.
export function parseDocument(value, presentation) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!data || ![1, FORMAT_VERSION].includes(data.version) || typeof data.presentation !== 'string' ||
      !data.slides || typeof data.slides !== 'object' || Array.isArray(data.slides)) {
    throw new Error('Unsupported annotation format (expected version 1 or 2)');
  }
  const result = emptyDocument(presentation ?? data.presentation);
  let count = 0;
  for (const [key, strokes] of Object.entries(data.slides)) {
    if (key.length > 512 || !Array.isArray(strokes)) throw new Error('Invalid slide annotations');
    const ids = new Set();
    result.slides[key] = strokes.map(s => {
      if (!s || typeof s.id !== 'string' || ids.has(s.id) || !['pen', 'highlighter'].includes(s.tool) ||
          !/^#[0-9a-f]{6}$/i.test(s.color) || !Number.isFinite(s.width) || s.width <= 0 || s.width > 200 ||
          !Array.isArray(s.points) || !s.points.length || !Number.isFinite(s.aspect) || s.aspect <= 0 || s.aspect > 20 ||
          !s.options || !['thinning', 'smoothing', 'streamline'].every(k => Number.isFinite(s.options[k]) && s.options[k] >= 0 && s.options[k] <= 1) ||
          typeof s.options.simulatePressure !== 'boolean') throw new Error('Invalid stroke');
      ids.add(s.id);
      const points = s.points.map(p => {
        if (++count > 1000000 || !Array.isArray(p) || p.length !== 3 || !p.every((n, i) => Number.isFinite(n) && (i === 2 || data.version === 1 ? n >= 0 && n <= 1 : n >= -100 && n <= 100))) {
          throw new Error('Invalid or excessively large annotation data');
        }
        return [...p];
      });
      return { id: s.id, tool: s.tool, width: s.width, color: s.color, aspect: s.aspect,
        options: { thinning: s.options.thinning, smoothing: s.options.smoothing,
          streamline: s.options.streamline, simulatePressure: s.options.simulatePressure }, points };
    });
  }
  return result;
}
export function serialize(data) { return JSON.stringify(parseDocument(data)); }
export function download(data) {
  const blob = new Blob([serialize(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${data.presentation.replace(/[^a-z0-9_-]/gi, '-').slice(0, 100) || 'presentation'}.annotations.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
