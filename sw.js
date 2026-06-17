// ΝΟΜΙΚΟ ΤΟΠΟ — service worker (network-first)
const CACHE = 'nomiko-topo-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './emblem-header.png'
];

self.addEventListener('install', (e) => {
  // skipWaiting → η νέα έκδοση ενεργοποιείται αμέσως, χωρίς να περιμένει
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Εξωτερικά (Supabase/Anthropic/CDN) → πάντα δίκτυο, χωρίς ανάμειξη
  if (url.origin !== location.origin) return;

  // NETWORK-FIRST: πάντα προσπάθησε δίκτυο (νέα έκδοση).
  // Cache μόνο ως εφεδρεία όταν δεν υπάρχει σύνδεση (offline).
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        // ενημέρωσε το cache με τη φρέσκια έκδοση
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
