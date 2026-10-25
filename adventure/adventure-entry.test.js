const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'home-entry.js'),'utf8');
async function route(config,callback={}){const visits=[];vm.runInNewContext(source,{Date,URLSearchParams,fetch:async()=>({ok:true,json:async()=>config}),location:{search:callback.search||'',hash:callback.hash||'',replace:url=>visits.push(url)},document:{hidden:false,addEventListener(){}},setInterval(){}});await new Promise(resolve=>setImmediate(resolve));return visits;}
test('homepage opens immediately when enabled; training dates remain server controlled',async()=>{
 assert.deepEqual(await route({adventureEnabled:false,serverTime:'2026-10-26T00:01:00+01:00'}),[]);
 assert.deepEqual(await route({adventureEnabled:true,serverTime:'2026-10-25T22:59:59Z'}),['/adventure/?live=1']);
 assert.deepEqual(await route({adventureEnabled:true,serverTime:'2026-10-25T23:00:00Z'}),['/adventure/?live=1']);
 assert.deepEqual(await route({adventureEnabled:true,serverTime:'2026-11-01T00:00:00+01:00'}),['/adventure/?live=1']);
 assert.deepEqual(await route({adventureEnabled:true,serverTime:'invalid'}),['/adventure/?live=1']);
});
test('API release flag defaults off, and local preview cannot be enabled against remote Supabase',()=>{
 const code=fs.readFileSync(require('node:path').join(__dirname,'../api/config.js'),'utf8');
 const response=env=>{const module={exports:{}};vm.runInNewContext(code,{module,process:{env},Date});let data;const res={setHeader(){},status(){return this;},json(value){data=value;}};module.exports({},res);return data;};
 assert.equal(response({SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable'}).adventureEnabled,false);
 assert.equal(response({SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable',SOBER_ADVENTURE_ENABLED:'1',SOBER_ADVENTURE_LOCAL_PREVIEW:'1',SOBER_ROULETTE_MODE:'server'}).adventureLocalPreview,undefined);
 assert.equal(response({SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_PUBLISHABLE_KEY:'publishable',SOBER_ADVENTURE_ENABLED:'1',SOBER_ADVENTURE_LOCAL_PREVIEW:'1',SOBER_ROULETTE_MODE:'server'}).adventureLocalPreview,true);
});

test('the homepage preserves auth callbacks across the final-week switch on the same origin',async()=>{
 const config={adventureEnabled:true,serverTime:'2026-10-25T21:00:00+01:00'};
 assert.deepEqual(await route(config,{hash:'#access_token=fixture-only&refresh_token=fixture-only&type=signup'}),['/adventure/?live=1#access_token=fixture-only&refresh_token=fixture-only&type=signup']);
 assert.deepEqual(await route(config,{search:'?code=fixture-code&unrelated=discarded'}),['/adventure/?live=1&code=fixture-code']);
 assert.deepEqual(await route(config,{search:'?error=access_denied&error_description=Cancelled'}),['/adventure/?live=1&error=access_denied&error_description=Cancelled']);
});
