// A&E Growing Daily Walk — offline cache
// Bump this version any time index.html changes.
const CACHE = "ae-walk-v8";

const PRECACHE = [
  "./",
  "./index.html",
  "./icon-180.png",
  "./icon-192.png",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(PRECACHE.map(url => {
        const cross = url.startsWith("http");
        // cache: "reload" skips the browser's HTTP cache so a new version never precaches a stale page
        return fetch(new Request(url, cross ? { mode: "no-cors" } : { cache: "reload" }))
          .then(resp => cache.put(url, resp))
          .catch(err => console.warn("precache miss", url, err));
      }))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // The app page: network first (always the newest version when online), cache when offline.
    event.respondWith(
      fetch(req, { cache: "no-store" }).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req.mode === "navigate" ? "./index.html" : req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))
      )
    );
    return;
  }

  // Libraries from the CDN: cache first.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && (resp.status === 200 || resp.type === "opaque")) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      });
    })
  );
});
