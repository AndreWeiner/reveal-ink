import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTool } from '../src/tools.js';
test('ink starts in Navigate unless a deck explicitly chooses a drawing tool', () => {
 for (const value of [undefined, null, '', 'bad', {}, 1]) assert.equal(initialTool(value), 'navigate');
 for (const tool of ['navigate', 'pen', 'highlighter', 'eraser']) assert.equal(initialTool(tool), tool);
});
