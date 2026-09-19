/* Service worker that proxies /guest/* to the HTTP server running inside the
 * emulated Linux. The service worker has no access to the v86 instance — the
 * page owns it — so each request is forwarded to the page over a
 * MessageChannel and the page performs the actual TCP exchange. */

const GUEST_PREFIX = "/guest/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(GUEST_PREFIX)) return;
  event.respondWith(proxyToGuest(event.request, url));
});

async function proxyToGuest(request, url) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const client = clients[0];
  if (!client) {
    return new Response("simulator is not running", { status: 503 });
  }

  const path = "/" + url.pathname.slice(GUEST_PREFIX.length) + url.search;
  const channel = new MessageChannel();

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 20000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    client.postMessage(
      {
        type: "guest-request",
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        method: request.method,
        path,
      },
      [channel.port2],
    );
  });

  if (!result) return new Response("guest request timed out", { status: 504 });
  if (result.error) return new Response(String(result.error), { status: 502 });

  const headers = new Headers(result.headers || {});
  return new Response(result.body ?? null, { status: result.status || 502, headers });
}
