import { defineConfig } from 'vite';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = import.meta.dirname;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
export default defineConfig({
  server: { watch: { ignored: ['!**/dist/**'] } },
  plugins: [{ name: 'ink-assets', closeBundle() {
    for (const [from, to] of [['src/ink.css', 'ink.css'], ['THIRD_PARTY_LICENSES.txt', 'ink.LICENSE.txt'], ['LICENSE', 'LICENSE']]) {
      copyFileSync(resolve(root, from), resolve(root, 'dist', to));
    }
    writeFileSync(resolve(root, 'dist/VERSION'), pkg.version + '\n');
  } }],
  build: {
    lib: { entry: resolve(root, 'src/plugin.js'), name: 'RevealInk', formats: ['es', 'umd'],
      fileName: format => `ink.${format === 'es' ? 'mjs' : 'js'}` }
  }
});
