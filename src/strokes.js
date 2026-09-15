export class History {
  constructor(limit = 100) { this.limit = limit; this.entries = new Map(); }
  entry(key) {
    if (!this.entries.has(key)) this.entries.set(key, { undo: [], redo: [] });
    return this.entries.get(key);
  }
  record(key, before, after) {
    const entry = this.entry(key);
    entry.undo.push({ before, after });
    if (entry.undo.length > this.limit) entry.undo.shift();
    entry.redo = [];
  }
  undo(key) {
    const e = this.entry(key), command = e.undo.pop();
    if (!command) return null;
    e.redo.push(command); return command.before;
  }
  redo(key) {
    const e = this.entry(key), command = e.redo.pop();
    if (!command) return null;
    e.undo.push(command); return command.after;
  }
  clear() { this.entries.clear(); }
}
