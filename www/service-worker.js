const CACHE='aperipostumi-0.3.1-pages-beta.1';
const OFFLINE_ASSETS=[
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'data/decks.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-192.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(OFFLINE_ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith('aperipostumi-') && key!==CACHE)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const requestUrl=new URL(event.request.url);
  if(requestUrl.origin!==self.location.origin)return;

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response && response.status===200){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const exact=await caches.match(event.request);
        if(exact)return exact;

        const ignoringQuery=await caches.match(event.request,{ignoreSearch:true});
        if(ignoringQuery)return ignoringQuery;

        if(event.request.mode==='navigate'){
          return caches.match(new URL('index.html',self.registration.scope).href);
        }

        throw new Error('Risorsa non disponibile offline');
      })
  );
});
