import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root, localEnvironment, getLocalStack, runLocalSql } from './local-env.mjs';

const env=localEnvironment(),stack=getLocalStack(env),port=Number(process.env.ADVENTURE_CONNECTED_PORT||3003);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Ogiltig lokal port.');
const dateArg=process.argv.slice(2);
if(dateArg.length>1||dateArg.length&&!/^--date=2026-10-(26|27|28|29|30|31)$/.test(dateArg[0]))throw Error('Använd --date=2026-10-26 till --date=2026-10-31, eller inget datum för verklig tid.');
const testDate=dateArg[0]?.slice(7);
const prior=JSON.parse(runLocalSql("select json_build_object('clock',pg_get_functiondef('private.adventure_clock()'::regprocedure),'enabled',(select enabled from private.adventure_settings));",env).split('\n').find(line=>line.trim().startsWith('{')));
let restored=false;
function restore(){if(restored)return;restored=true;runLocalSql(prior.clock+';update private.adventure_settings set enabled='+prior.enabled+' where singleton;',env);}
if(testDate)runLocalSql(`create or replace function private.adventure_clock()returns timestamptz language sql stable security invoker set search_path=''as $$select timestamptz '${testDate} 12:00:00+01';$$;`,env);
runLocalSql('update private.adventure_settings set enabled=true where singleton;',env);
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!['GET','HEAD'].includes(req.method))throw Error('Metoden stöds inte.');
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/api/config'){
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({supabaseUrl:stack.api,supabasePublishableKey:stack.publishable,votingEnabled:true,adventureEnabled:true,adventureLocalPreview:true,serverTime:testDate?testDate+'T12:00:00+01:00':new Date().toISOString()}));
  }
  let route=decodeURIComponent(url.pathname);if(route.endsWith('/'))route+='index.html';
  if(!/^\/[a-zA-Z0-9/_ .-]+\.(html|js|css|svg|png|jpg|webp|m4a|woff2)$/.test(route)||/(?:^|\/)(?:node_modules|supabase|qa|scripts|test-results)\/|\.test\.|AGENTS|README/.test(route))throw Error('Otillåten fil.');
  const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep))throw Error('Otillåten fil.');
  const content=await fs.readFile(file);const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.m4a':'audio/mp4','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
  res.setHeader('Content-Type',type);
  if(route.endsWith('.m4a')){res.setHeader('Accept-Ranges','bytes');if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);const start=Number(match?.[1]),end=Math.min(Number(match?.[2]||content.length-1),content.length-1);if(!match||start>end||start>=content.length){res.writeHead(416,{'Content-Range':`bytes */${content.length}`}).end();return;}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});res.end(content.subarray(start,end+1));return;}}
  res.setHeader('Content-Length',content.length);res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404).end('Sidan finns inte.');}
});
server.on('error',error=>{console.error(error.message);restore();process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Databaskopplat finaltest: http://localhost:${port}/adventure/?live=1\nTestinloggning: http://localhost:${port}/dev/login.html\n${testDate?'Lokal testklocka: '+testDate:'Verklig svensk servertid'} · Endast lokal Supabase. 3002 är kvar.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{restore();server.close();});
