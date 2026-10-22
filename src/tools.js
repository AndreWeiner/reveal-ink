export function initialTool(value) {
  return ['navigate', 'pen', 'highlighter', 'eraser'].includes(value) ? value : 'navigate';
}
