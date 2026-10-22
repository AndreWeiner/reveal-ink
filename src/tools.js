export function initialTool(value) {
  return ['navigate', 'pen', 'highlighter', 'laser', 'eraser'].includes(value) ? value : 'navigate';
}
