import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const cli = name => path.join(root, 'node_modules', '.bin', name);
export const accounts = [
  { email: 'admin@local.soberoktober.test', name: 'Lokal admin', admin: true },
  { email: 'anna@local.soberoktober.test', name: 'Test Anna', admin: false },
  { email: 'erik@local.soberoktober.test', name: 'Test Erik', admin: false },
];
export const password = 'SoberLocal-2026!';

export function assertLocalUrl(value, port, label = 'URL') {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} saknar en giltig lokal adress.`); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.port !== String(port) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} måste vara en lokal HTTP-adress på port ${port}. Körningen stoppas.`);
  }
  return url.origin;
}

export function checkConfiguredUrls(env = process.env, envText = '') {
  const match = envText.match(/^\s*(?:export\s+)?SUPABASE_URL\s*=\s*(.*?)\s*$/m);
  if (match) assertLocalUrl(match[1].replace(/^(['"])(.*)\1$/, '$2'), 54321, '.env.local SUPABASE_URL');
  if (env.SUPABASE_URL) assertLocalUrl(env.SUPABASE_URL, 54321, 'SUPABASE_URL');
  if (env.DOCKER_HOST && !env.DOCKER_HOST.startsWith('unix://')) throw new Error('En fjärr-Docker tillåts inte för lokala kommandon.');
}

export function localEnvironment() {
  const file = path.join(root, '.env.local');
  checkConfiguredUrls(process.env, existsSync(file) ? readFileSync(file, 'utf8') : '');
  const socket = path.join(homedir(), '.docker/run/docker.sock');
  if (!existsSync(socket)) throw new Error('Starta Docker Desktop först. Den lokala Docker-socketen saknas.');
  return { ...process.env, DOCKER_HOST: `unix://${socket}` };
}

export function runSupabase(args, env) {
  try { return execFileSync(cli('supabase'), args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) {
    const detail = args[0] === 'db' ? String((error.stderr || '') + '\n' + (error.stdout || '')).replace(/eyJ[A-Za-z0-9_.-]+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[nyckel dold]').slice(-1200).trim() : '';
    throw new Error(`Det lokala Supabase-kommandot misslyckades: supabase ${args[0]}. ${detail || 'Kontrollera Docker Desktop och supabase/config.toml.'}`);
  }
}

export function getLocalStack(env, { start = true } = {}) {
  if (start) runSupabase(['start'], env);
  const status = JSON.parse(runSupabase(['status', '--output', 'json'], env));
  const api = assertLocalUrl(status.API_URL, 54321, 'Supabase API');
  const db = new URL(status.DB_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) || db.port !== '54322') throw new Error('Databasen är inte lokal.');
  const publishable = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const serviceRole = status.SERVICE_ROLE_KEY;
  if (!publishable || !serviceRole) throw new Error('Lokal Supabase saknar förväntade API-nycklar.');
  return { api, publishable, serviceRole };
}

export async function localRequest(url, options = {}) {
  const target = new URL(url);
  assertLocalUrl(target.origin, 54321, 'API-anrop');
  const response = await fetch(target, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Lokal API returnerade ${response.status}: ${data.msg || data.message || data.error_description || data.error || 'Okänt fel'}`);
  return data;
}


export function runLocalSql(sql, env) {
  const docker = path.join(homedir(), '.docker/bin/docker');
  if (!existsSync(docker)) throw new Error('Docker Desktop CLI saknas.');
  if (!env.DOCKER_HOST?.startsWith('unix://')) throw new Error('SQL kräver den lokala Docker-socketen.');
  const config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  if (!/^project_id\s*=\s*"soberoktober"\s*$/m.test(config)) throw new Error('Förväntade lokalprojektet soberoktober.');
  try {
    return execFileSync(docker, ['exec', '-i', 'supabase_db_soberoktober', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '--no-psqlrc'], {
      cwd: root, env, input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) { throw new Error(`Lokalt seed-SQL misslyckades: ${String(error.stderr || '').slice(-1200).trim()}`); }
}
