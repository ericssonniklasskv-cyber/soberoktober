import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import { root, cli, localEnvironment, getLocalStack, assertLocalUrl } from './local-env.mjs';

try {
  const voting = process.argv[2] === '--voting';
  if (process.argv.length > (voting ? 3 : 2)) throw new Error('Använd npm run dev:local eller npm run dev:vote.');
  if (process.argv[2] && !voting) throw new Error('Okänt lokalt startläge.');
  const env = localEnvironment();
  if (['project.json', 'repo.json'].some(f => existsSync(path.join(root, '.vercel', f)))) {
    throw new Error('En Vercel-projektlänk finns i .vercel. Flytta den till en lokal backup innan dev:local körs.');
  }
  const stack = getLocalStack(env);
  const portBusy = await new Promise(resolve => {
    const socket = net.connect(3000, '127.0.0.1');
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
  });
  if (portBusy) {
    const response = await fetch('http://localhost:3000/api/config', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    const config = await response.json();
    if (!response.ok) throw new Error('Port 3000 används av en annan server.');
    assertLocalUrl(config.supabaseUrl, 54321, 'Frontendens Supabase API');
    if (Boolean(config.votingPreview) !== voting) throw new Error('En annan lokal temaversion kör redan på port 3000. Stoppa den med Ctrl+C och starta valt tema igen.');
    if (config.rouletteMode !== 'server') throw new Error('Servern på port 3000 kör den äldre rouletteprototypen. Starta om den med npm run dev:local.');
    if (config.supabasePublishableKey !== stack.publishable) throw new Error('Servern på port 3000 använder en annan Supabase-nyckel. Starta om den.');
    console.log('Frontend och lokal Supabase kör redan.');
    console.log('Testinloggning: http://localhost:3000/dev/login.html');
    process.exit(0);
  }
  const childEnv = { ...env, SUPABASE_URL: stack.api, SUPABASE_PUBLISHABLE_KEY: stack.publishable, SOBER_ROULETTE_MODE: 'server', SOBER_VOTING_PREVIEW: voting ? '1' : '0' };
  for (const name of ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_ORG_ID', 'SUPABASE_ACCESS_TOKEN']) delete childEnv[name];
  console.log('Startar lokal frontend på http://localhost:3000');
  console.log('Testinloggning: http://localhost:3000/dev/login.html');
  console.log('Studio: http://127.0.0.1:54323 · Ctrl+C stoppar frontend, databasen behåller data.');
  const child = spawn(cli('vercel'), ['dev', '--local', '--listen', '127.0.0.1:3000'], { cwd: root, env: childEnv, stdio: 'inherit' });
  let interrupted = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; child.kill(signal); });
  child.on('error', () => { console.error('Frontend kunde inte startas. Kör npm install först.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = interrupted ? 0 : (code ?? 1); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
