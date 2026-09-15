import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (!process.argv[2]) throw new Error('Usage: node scripts/copy-release.mjs /path/to/lecture-repository');
const relative = `plugin/ink/v${version}`;
const target = resolve(process.argv[2], relative);
const files = ['ink.js', 'ink.mjs', 'ink.css', 'ink.LICENSE.txt', 'LICENSE', 'VERSION'];
const content = new Map();
for (const name of files) content.set(name, await readFile(resolve(root, 'dist', name)));
if (content.get('VERSION').toString().trim() !== version) throw new Error('Run npm run build before copying this version');
const hashes = Object.fromEntries([...content].map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]));
content.set('release.json', Buffer.from(JSON.stringify({ name: 'reveal-ink', version, sha256: hashes }, null, 2) + '\n'));
// Validate every existing file before writing any release files.
for (const [name, bytes] of content) {
  try {
    if (!(await readFile(resolve(target, name))).equals(bytes)) throw new Error(`Release ${version} already exists with different contents; bump the version first`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await mkdir(target, { recursive: true });
for (const [name, bytes] of content) await writeFile(resolve(target, name), bytes);
console.log(`Copied Reveal Ink ${version} to ${target}\n<link rel="stylesheet" href="${relative}/ink.css">\n<script src="${relative}/ink.js"></script>`);
