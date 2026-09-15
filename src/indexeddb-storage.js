export class IndexedDBStorage {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; this.db = null; }
  open() {
    if (!this.factory) return Promise.reject(new Error('IndexedDB is unavailable'));
    return new Promise((resolve, reject) => {
      const request = this.factory.open('reveal-ink', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('presentations');
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage upgrade blocked; close other presentation tabs'));
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => this.close();
        resolve();
      };
    });
  }
  load(key) { return this.transaction('readonly', store => store.get(key)); }
  save(key, data) { return this.transaction('readwrite', store => store.put(data, key)); }
  transaction(mode, run) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Annotation storage is closed'));
      const tx = this.db.transaction('presentations', mode), request = run(tx.objectStore('presentations'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Annotation save failed'));
    });
  }
  close() { this.db?.close(); this.db = null; }
}
