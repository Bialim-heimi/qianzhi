'use strict';
const CACHE='qianzhi-web-fa1bb0203276';
const ASSETS=["app.js","device.css","device.js","expressive.css","fonts/MaShanZheng-Regular.ttf","fonts/SlideFont-AUTHORS.txt","fonts/SlideFont-OFL.txt","fonts/Slideqiuhong-Regular.ttf","handwriting.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","index.html","ink.css","lots.js","manifest.webmanifest","motion.js","paper-a.png","paper-fibers.svg","prayer-hands-ink.png","prayer.css","pwa.css","pwa.js","quiet.css","ritual.css","sheet.css","style-a.css","style.css"];
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
