// ΝΟΜΙΚΟ ΤΟΠΟ — Service Worker
// Κανόνας: σε ΚΑΘΕ αλλαγή των αρχείων, ανέβασε τον αριθμό CACHE (v22 → v23 → ...)
const CACHE = 'nomiko-topo-v22';

// Στατικά αρχεία που προ-φορτώνονται (cache-first).
// ΜΗΝ βάλεις εδώ εξωτερικά CDN (pdf.js, supabase, docx) — φορτώνουν live.
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './emblem-navy.png',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: προ-φόρτωση στατικών ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})) // αν λείπει κάποιο, μη σκάσεις
  );
  self.skipWaiting(); // ενεργοποίηση νέου SW αμέσως
});

// ── ACTIVATE: καθάρισε παλιά caches ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Μόνο GET· ό,τι δεν είναι GET (π.χ. POST στο Supabase/API) περνά κατευθείαν.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Εξωτερικά domains (CDN, Supabase, API): πάντα δίκτυο, χωρίς cache.
  if (url.origin !== self.location.origin) return;

  // HTML / navigation → NETWORK-FIRST (πάντα νέα έκδοση, fallback σε cache offline)
  const isHTML = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./app.html')))
    );
    return;
  }

  // Στατικά (εικόνες, manifest, css, js) → CACHE-FIRST με ενημέρωση στο παρασκήνιο
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchProm = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || fetchProm;
    })
  );
});

// Επιτρέπει στο app να ζητήσει άμεση ενεργοποίηση νέου SW (προαιρετικό)
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
