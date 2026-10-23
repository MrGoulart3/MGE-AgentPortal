'use strict';
// Installable portal: "Share → Agent Portal" on the phone. Stores what was shared (files, text, link) in a local
// cache and opens the portal, which asks before attaching it to the message box. Pages are never cached.
// Portal instalável: "Compartilhar → Agent Portal" no celular; guarda o compartilhado e o portal pergunta antes de anexar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'POST' || u.pathname !== '/share') return;
  // only the system share sheet (navigation started outside any site) or the portal itself; other sites' forms are ignored
  const origem = e.request.headers.get('Sec-Fetch-Site');
  if (e.request.mode !== 'navigate' || (origem && origem !== 'none' && origem !== 'same-origin')) return;
  e.respondWith((async () => {
    const f = await e.request.formData(), c = await caches.open('shared');
    for (const k of await c.keys()) await c.delete(k);
    let i = 0;
    for (const a of f.getAll('files')) if (a && a.size) await c.put('/shared/' + (i++),
      new Response(a, {headers: {'Content-Type': a.type || 'application/octet-stream', 'X-Name': encodeURIComponent(a.name || 'file')}}));
    const texto = [f.get('title'), f.get('text'), f.get('url')].filter(Boolean).join('\n');
    if (texto) await c.put('/shared/text', new Response(texto));
    return Response.redirect('/spaces?shared=1', 303);
  })());
});
