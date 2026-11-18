/* Shop Stock offline support: keeps the app and its libraries on the phone */
const CACHE='shopstock-v2';
const CORE=['./','./index.html'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.endsWith('supabase.co'))return;            // live data is never cached
  const isPage=req.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/');
  if(isPage){                                                 // newest app when online, saved copy when offline
    // weak internet: wait at most 5 seconds, then open the saved copy (the new one is still saved for next time)
    const saved=()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./index.html')).then(r=>r||caches.match('./'));
    const net=fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r});
    e.respondWith(new Promise(res=>{let done=false;
      const fall=()=>saved().then(r=>{if(r&&!done){done=true;res(r)}});
      const tm=setTimeout(fall,5000);
      net.then(r=>{clearTimeout(tm);if(!done){done=true;res(r)}}).catch(()=>{clearTimeout(tm);saved().then(r=>{if(!done){done=true;res(r||Response.error())}})});
    }));
    e.waitUntil(net.catch(()=>{}));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
    if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r;
  })));                                                       // scanner, Excel and database libraries
});
