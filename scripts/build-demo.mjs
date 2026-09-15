import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = resolve(root, 'docs');
await mkdir(target, { recursive: true });
await cp(resolve(root, 'dist'), resolve(target, 'ink'), { recursive: true });
await cp(resolve(root, 'node_modules/reveal.js/dist'), resolve(target, 'reveal'), { recursive: true });
await cp(resolve(root, 'node_modules/reveal.js/LICENSE'), resolve(target, 'reveal/LICENSE'));
await cp(resolve(root, 'demo/workflow.svg'), resolve(target, 'workflow.svg'));
const html = (await readFile(resolve(root, 'demo/index.html'), 'utf8'))
  .replaceAll('../node_modules/reveal.js/dist/', './reveal/')
  .replaceAll('../dist/', './ink/');
await writeFile(resolve(target, 'index.html'), html);
await writeFile(resolve(target, '.nojekyll'), '');
console.log('Built self-contained GitHub Pages demo in docs/');
