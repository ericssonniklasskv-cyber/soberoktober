import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const ui = process.argv.includes('--ui');
const ignored = new Set(['.git', 'node_modules', '.vercel', '.github', 'supabase']);
function find(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? find(file) : [file];
  });
}
// Local database E2E is opt-in: the default suite never writes to Supabase.
const files = find(root).filter(file => ui
  ? /(?:^|[/-])ui\.test\.(?:js|cjs)$/.test(file)
  : file.endsWith('.test.js') && !file.endsWith('ui.test.js')).sort();
if (!files.length) throw Error('No tests found');
const commands = ui ? files.map(file => [file]) : [['--test', ...files]];
for (const args of commands) {
  if (ui) console.log(`\nBrowser regression: ${relative(root, args[0])}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
