export function createToolbar(root, actions, config) {
  const bar = document.createElement('div');
  bar.className = 'reveal-ink-toolbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Slide handwriting');
  const buttons = {};
  function button(label, action, parent = bar) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.setAttribute('aria-label', label); b.addEventListener('click', action); parent.append(b); return b;
  }
  for (const [tool, label] of [['navigate','Navigate'], ['pen','Pen'], ['highlighter','Highlight'], ['laser','Laser']]) {
    buttons[tool] = button(label, () => actions.tool(tool)); buttons[tool].dataset.tool = tool;
  }
  buttons.undo = button('Undo', actions.undo); buttons.redo = button('Redo', actions.redo);
  const details = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = 'More'; details.append(summary); bar.append(details);
  const panel = document.createElement('div'); panel.className = 'reveal-ink-options'; details.append(panel);
  const colorLabel = document.createElement('label'); colorLabel.textContent = 'Color';
  const color = document.createElement('input'); color.type = 'color'; color.value = config.pen.color;
  color.addEventListener('input', () => actions.color(color.value)); colorLabel.append(color); panel.append(colorLabel);
  const palette = document.createElement('div'); palette.className = 'reveal-ink-palette';
  palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', 'Preset colors');
  const swatches = [];
  function selectColor(value) {
    color.value = value;
    for (const swatch of swatches) swatch.setAttribute('aria-pressed', String(swatch.dataset.color === value.toLowerCase()));
  }
  for (const [name, value] of [['White', '#ffffff'], ['Black', '#000000'],
    ['C0', '#8dd3c7'], ['C1', '#feffb3'], ['C2', '#bfbbd9'], ['C3', '#fa8174'], ['C4', '#81b1d2']]) {
    const swatch = button(name, () => { actions.color(value); selectColor(value); }, palette);
    swatch.className = 'reveal-ink-swatch'; swatch.dataset.color = value;
    swatch.style.setProperty('--ink-swatch-color', value);
    swatch.title = `${name} (${value})`; swatches.push(swatch);
  }
  color.addEventListener('input', () => selectColor(color.value));
  root.append(palette);
  palette.addEventListener('keydown', e => e.stopPropagation());
  const widthLabel = document.createElement('label'); widthLabel.textContent = 'Width';
  const width = document.createElement('input'); width.type = 'range'; width.min = '1'; width.max = '40'; width.step = '0.5'; width.value = config.pen.width;
  width.addEventListener('input', () => actions.width(Number(width.value))); widthLabel.append(width); panel.append(widthLabel);
  function iconButton(label, path, action, className) {
    const control = button('', action, palette);
    control.className = `reveal-ink-palette-tool ${className}`;
    control.setAttribute('aria-label', label); control.title = label;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path); svg.append(shape); control.append(svg);
    return control;
  }
  const eraserButton = iconButton('Erase', 'M4 14 14 4a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L11 21H7l-3-3a3 3 0 0 1 0-4ZM9 9l8 8M11 21h10', () => actions.tool('eraser'), 'reveal-ink-eraser');
  const canvasButton = iconButton('Toggle extra canvas', 'M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M17 2v6M14 5h6M7 12h6M7 16h10', actions.canvas, 'reveal-ink-canvas-toggle');
  canvasButton.setAttribute('aria-label', 'Toggle extra canvas');
  const filters = {};
  for (const [name, text] of [['smoothing', 'Smoothing'], ['streamline', 'Stabilizer']]) {
    const label = document.createElement('label'); label.textContent = text;
    const range = document.createElement('input'); range.type = 'range';
    range.min = '0'; range.max = '1'; range.step = '0.05'; range.value = config.pen[name];
    range.setAttribute('aria-label', text);
    range.title = name === 'streamline' ? 'Lower values follow the pen faster' : 'Round the stroke outline';
    range.addEventListener('input', () => actions.filter(name, Number(range.value)));
    label.append(range); panel.append(label); filters[name] = range;
  }
  button('Clear current surface', actions.clear, panel); button('Export JSON', actions.export, panel);
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  button('Import JSON…', () => file.click(), panel);
  file.addEventListener('change', async () => {
    if (file.files[0] && confirm('Replace all annotations in this presentation with this file? Export first to keep a backup.')) {
      await actions.import(file.files[0]);
    }
    file.value = '';
  });
  panel.append(file);
  const status = document.createElement('span'); status.className = 'reveal-ink-status';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); bar.append(status);
  // Keep keyboard shortcuts in controls from navigating the deck.
  bar.addEventListener('keydown', e => e.stopPropagation());
  let collapsed = false, hidden = false, navigating = false;
  const toggle = button('', () => setCollapsed(false), root);
  toggle.className = 'reveal-ink-toggle';
  toggle.setAttribute('aria-label', 'Show handwriting toolbar');
  toggle.title = 'Show handwriting toolbar';
  const collapse = button('', () => setCollapsed(true));
  collapse.className = 'reveal-ink-collapse';
  collapse.setAttribute('aria-label', 'Hide handwriting toolbar');
  const scrollRail = document.createElement('div'); scrollRail.className = 'reveal-ink-scroll';
  const scroll = document.createElement('input'); scroll.type = 'range'; scroll.min = '0'; scroll.max = '3'; scroll.step = '0.01';
  scroll.setAttribute('aria-label', 'Canvas vertical position');
  scroll.addEventListener('input', () => actions.scrollTo(Number(scroll.value)));
  scrollRail.append(scroll);
  button('↓', () => actions.scrollBy(0.8), scrollRail).setAttribute('aria-label', 'More canvas below');
  scrollRail.addEventListener('keydown', e => e.stopPropagation()); root.append(scrollRail);
  let onCanvas = false;
  function syncVisibility() {
    scrollRail.hidden = hidden || !onCanvas;
    palette.hidden = hidden || navigating;
    bar.hidden = hidden || collapsed;
    toggle.hidden = hidden || !collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
  }
  function setCollapsed(value) {
    collapsed = value;
    if (value) details.open = false;
    syncVisibility();
  }
  toggle.addEventListener('keydown', e => e.stopPropagation());
  root.append(bar);
  syncVisibility();
  return {
    update(tool, history, settings) {
      navigating = tool === 'navigate';
      eraserButton.setAttribute('aria-pressed', String(tool === 'eraser'));
      syncVisibility();
      for (const [name, b] of Object.entries(buttons)) if (b.dataset.tool) b.setAttribute('aria-pressed', String(name === tool));
      buttons.undo.disabled = !history.undo.length; buttons.redo.disabled = !history.redo.length;
      selectColor(settings.color); width.value = settings.width;
      for (const name of Object.keys(filters)) filters[name].value = settings[name];
    },
    status(text, error = false) {
      status.textContent = error ? text : '';
      status.hidden = !error;
      status.classList.toggle('error', error);
      if (error) setCollapsed(false);
    },
    canvas(value) { onCanvas = value; canvasButton.setAttribute('aria-pressed', String(value)); syncVisibility(); },
    scroll(position, maximum) { scroll.max = maximum; scroll.value = position; },
    collapse() { setCollapsed(true); },
    hide(value) { hidden = value; syncVisibility(); },
    destroy() { bar.remove(); toggle.remove(); palette.remove(); scrollRail.remove(); }
  };
}
