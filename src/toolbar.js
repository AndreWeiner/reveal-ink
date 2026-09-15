export function createToolbar(root, actions, config) {
  const bar = document.createElement('div');
  bar.className = 'reveal-ink-toolbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Slide handwriting');
  const buttons = {};
  function button(label, action, parent = bar) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.setAttribute('aria-label', label); b.addEventListener('click', action); parent.append(b); return b;
  }
  for (const [tool, label] of [['navigate','Navigate'], ['pen','Pen'], ['highlighter','Highlight'], ['eraser','Erase']]) {
    buttons[tool] = button(label, () => actions.tool(tool)); buttons[tool].dataset.tool = tool;
  }
  buttons.undo = button('Undo', actions.undo); buttons.redo = button('Redo', actions.redo);
  const details = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = 'Colors & more'; details.append(summary); bar.append(details);
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
  panel.append(palette);
  const widthLabel = document.createElement('label'); widthLabel.textContent = 'Width';
  const width = document.createElement('input'); width.type = 'range'; width.min = '1'; width.max = '40'; width.step = '0.5'; width.value = config.pen.width;
  width.addEventListener('input', () => actions.width(Number(width.value))); widthLabel.append(width); panel.append(widthLabel);
  button('Clear slide', actions.clear, panel); button('Export JSON', actions.export, panel);
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
  root.append(bar);
  return {
    update(tool, history, settings) {
      for (const [name, b] of Object.entries(buttons)) if (b.dataset.tool) b.setAttribute('aria-pressed', String(name === tool));
      buttons.undo.disabled = !history.undo.length; buttons.redo.disabled = !history.redo.length;
      selectColor(settings.color); width.value = settings.width;
    },
    status(text, error = false) { status.textContent = text; status.classList.toggle('error', error); },
    hide(value) { bar.hidden = value; },
    destroy() { bar.remove(); }
  };
}
