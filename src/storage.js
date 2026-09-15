import { IndexedDBStorage } from './indexeddb-storage.js';
export function createStorage(config) {
  if (config.adapter) return config.adapter;
  if (config.type !== 'indexeddb') throw new Error('Unknown storage type; supply a storage adapter');
  return new IndexedDBStorage();
}
