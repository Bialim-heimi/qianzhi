'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../dist');
function walk(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(folder,e.name)):[path.join(folder,e.name)]);}
const files=walk(dir).filter(f=>!['sw.js','OFL.txt'].includes(path.basename(f))).map(f=>path.relative(dir,f).split(path.sep).join('/')).sort();
const hash=crypto.createHash('sha256');for(const f of files)hash.update(f).update(fs.readFileSync(path.join(dir,f)));
const version=hash.digest('hex').slice(0,12);
const worker=`'use strict';
const CACHE='qianzhi-web-${version}';
const ASSETS=${JSON.stringify(files)};
const urls=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
function reusable(response,url){return response.ok&&!response.redirected&&new URL(response.url||url).origin===self.location.origin;}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const asset of ASSETS){const url=new URL(asset,self.registration.scope).href;const response=await fetch(url,{cache:'reload'});if(!reusable(response,url))throw Error('Static resource unavailable');await cache.put(url,response);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('qianzhi-web-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(event.request.mode==='navigate'){
   event.respondWith((async()=>{try{return await fetch(event.request);}catch{return await (await caches.open(CACHE)).match(new URL('index.html',self.registration.scope).href)||Response.error();}})());return;
 }
 url.search='';if(!urls.has(url.href))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(url.href);if(saved)return saved;const response=await fetch(event.request);if(reusable(response,url.href))await cache.put(url.href,response.clone());return response;})());
});
`;
fs.writeFileSync(path.join(dir,'sw.js'),worker);console.log('PWA cache prepared:',version,files.length,'assets');
