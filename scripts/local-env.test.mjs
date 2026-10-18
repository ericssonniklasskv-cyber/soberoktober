import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalUrl, checkConfiguredUrls } from './local-env.mjs';

test('only the intended loopback API can be used', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(assertLocalUrl(`http://${host}:54321`, 54321), `http://${host}:54321`);
  for (const value of ['https://project.supabase.co', 'http://127.0.0.1:54322', 'http://localhost.evil.test:54321', 'https://localhost:54321', 'http://user:secret@localhost:54321', 'http://localhost:54321/proxy', 'http://localhost:54321?remote=1']) assert.throws(() => assertLocalUrl(value, 54321));
});
test('remote environment or dotenv configuration stops local tooling', () => {
  assert.throws(() => checkConfiguredUrls({ SUPABASE_URL: 'https://project.supabase.co' }));
  assert.throws(() => checkConfiguredUrls({}, 'SUPABASE_URL="https://project.supabase.co"\n'));
  assert.throws(() => checkConfiguredUrls({ DOCKER_HOST: 'tcp://remote:2376' }));
  assert.doesNotThrow(() => checkConfiguredUrls({}, 'SUPABASE_URL="http://127.0.0.1:54321"\n'));
});

test('server roulette mode is exposed only for an explicit local API', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../api/config.js', import.meta.url), 'utf8');
  for (const [url, flag, expected] of [
    ['http://127.0.0.1:54321', 'server', 'server'],
    ['http://localhost:54321', 'server', 'server'],
    ['http://127.0.0.1:54321', '', undefined],
    ['https://production.supabase.co', 'server', undefined],
    ['http://localhost.evil.test:54321', 'server', undefined],
  ]) {
    const module = { exports: {} };
    runInNewContext(source, { module, process: { env: { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'fixture', SOBER_ROULETTE_MODE: flag } } });
    let result;
    module.exports({}, { setHeader() {}, status() { return this; }, json(value) { result = value; } });
    assert.equal(result.rouletteMode, expected);
  }
});

test('voting preview flag is withheld for remote API and normal local mode', async () => {
  const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
  const source=readFileSync(new URL('../api/config.js',import.meta.url),'utf8');
  for(const [url,mode,flag,expected] of [
    ['http://127.0.0.1:54321','server','1',true],
    ['http://127.0.0.1:54321','server','0',undefined],
    ['http://127.0.0.1:54321','','1',undefined],
    ['https://production.supabase.co','server','1',undefined],
    ['http://localhost.evil.test:54321','server','1',undefined],
  ]) {
    const module={exports:{}};let result;
    runInNewContext(source,{module,process:{env:{SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'fixture',SOBER_ROULETTE_MODE:mode,SOBER_VOTING_PREVIEW:flag}}});
    module.exports({}, {setHeader(){},status(){return this;},json(value){result=value;}});
    assert.equal(result.votingPreview,expected);
  }
});
