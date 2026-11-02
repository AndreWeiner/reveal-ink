// At most one write in progress and one latest pending immutable snapshot.
// enqueue() is cheap; serialization happens only when a write actually starts.
export class SaveQueue {
  constructor(write, onError = () => {}, delay = 100) {
    this.write = write; this.onError = onError; this.delay = delay;
    this.pending = null; this.running = false; this.timer = null; this.waiters = [];
  }
  enqueue(snapshot) {
    this.pending = snapshot;
    if (!this.running && this.timer === null) {
      this.timer = setTimeout(() => { this.timer = null; this.drain(); }, this.delay);
    }
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const snapshot = this.pending; this.pending = null;
        try { await this.write(snapshot); }
        catch (error) { this.onError(error); }
      }
    } finally {
      this.running = false;
      const waiters = this.waiters.splice(0);
      for (const resolve of waiters) resolve();
    }
  }
  flush() {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (!this.pending && !this.running) return Promise.resolve();
    const done = new Promise(resolve => this.waiters.push(resolve));
    void this.drain();
    return done;
  }
}
