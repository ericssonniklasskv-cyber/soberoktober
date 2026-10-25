(() => {
 'use strict';
 async function check(){try{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)return;const c=await r.json();if(c.adventureEnabled===true){const query=new URLSearchParams({live:'1'}),callback=new URLSearchParams(location.search||'');for(const key of ['code','error','error_code','error_description'])if(callback.has(key))query.set(key,callback.get(key));location.replace('/adventure/?'+query.toString()+(location.hash||''));}}catch{}}
 check();setInterval(()=>{if(!document.hidden)check();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
})();
