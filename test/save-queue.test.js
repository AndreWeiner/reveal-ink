import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveQueue } from '../src/save-queue.js';
test('coalesces queued snapshots and flush waits for the latest in-flight successor', async () => {
  const writes = []; let release;
  const q = new SaveQueue(async value => {
    writes.push(value);
    if (value === 2) await new Promise(resolve => { release = resolve; });
  }, undefined, 10000);
  q.enqueue(1); q.enqueue(2);
  let complete = false;
  const flushed = q.flush().then(() => { complete = true; });
  assert.deepEqual(writes, [2]);
  q.enqueue(3); q.enqueue(4);
  await Promise.resolve(); assert.equal(complete, false);
  release(); await flushed;
  assert.deepEqual(writes, [2, 4]); assert.equal(complete, true);
});
test('failed storage does not block later writes or flush', async () => {
  const errors = [], writes = [];
  const q = new SaveQueue(async value => { writes.push(value); if (value === 1) throw Error('disk'); }, e => errors.push(e.message));
  q.enqueue(1); await q.flush(); q.enqueue(2); await q.flush();
  assert.deepEqual(writes, [1,2]); assert.deepEqual(errors, ['disk']);
});
