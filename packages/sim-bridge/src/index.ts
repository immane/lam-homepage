/**
 * @lam/sim-bridge — data RPC between the host page and the static build
 * running inside the guest VM.
 *
 * The guest app is served over plain HTTP by the emulated machine, so it
 * cannot reach the host's API routes directly. It asks the host instead:
 *
 *   guest -> host  { type: "lam:bridge", id, path }        (with a port)
 *   host  -> guest { type: "lam:bridge:result", id, ok, status, body }
 *
 * The host owns the v86 instance, so only the page that embeds the guest can
 * answer. To make sure replies reach the right requester — several windows may
 * embed a guest, and any page could post a forged envelope — the guest sends
 * a fresh `MessagePort` with every request and the host replies on it. A reply
 * therefore only ever reaches the caller that created the channel.
 *
 * JSON only: binary payloads stay on public URLs.
 */

export const BRIDGE_REQUEST = "lam:bridge";
export const BRIDGE_RESULT = "lam:bridge:result";

/** Requests the guest may make, mapped to host API routes. */
export interface BridgeRoute {
  /** Same-origin path on the host that answers the request. */
  target: string;
  /** Restricts the HTTP method the guest may use. Defaults to GET. */
  method?: "GET" | "POST";
  /** Allow-list of query parameters the guest may forward. */
  params?: readonly string[];
}

/**
 * Routes the guest is allowed to call. An explicit allow-list keeps the
 * bridge from becoming an open proxy into the host origin.
 */
export const DEFAULT_ROUTES: Record<string, BridgeRoute> = {
  github: { target: "/api/github" },
};

export interface BridgeRequestMessage {
  type: typeof BRIDGE_REQUEST;
  id: string;
  route: string;
  params?: Record<string, string>;
}

export interface BridgeResultMessage {
  type: typeof BRIDGE_RESULT;
  id: string;
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Build a request for a route, forwarding only params the route explicitly
 * allows.
 *
 * A missing allow-list means "no parameters", never "any parameter" — the
 * bridge must not become an open pass-through into the host API.
 */
export function buildRequestUrl(
  route: BridgeRoute,
  params: Record<string, string> = {},
  origin = "",
): string {
  const url = new URL(route.target, origin || "http://localhost");
  const allowed = route.params ?? [];
  for (const [key, value] of Object.entries(params)) {
    if (allowed.includes(key)) url.searchParams.set(key, value);
  }
  return origin ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Guest side: ask the host for data.
 *
 * Resolves with the parsed JSON body. Rejects when the page is not embedded,
 * the route is unknown, or the host does not answer in time — callers should
 * fall back to their own data or an empty state rather than assume success.
 */
export function requestFromHost(
  route: string,
  params: Record<string, string> = {},
  options: { timeoutMs?: number; routes?: Record<string, BridgeRoute> } = {},
): Promise<unknown> {
  if (typeof window === "undefined" || window.self === window.top) {
    return Promise.reject(new Error("not embedded in a host page"));
  }

  const routes = options.routes ?? DEFAULT_ROUTES;
  const definition = routes[route];
  if (!definition) return Promise.reject(new Error(`unknown bridge route: ${route}`));

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timeoutMs = options.timeoutMs ?? 15000;

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error("bridge request timed out"))),
      timeoutMs,
    );

    channel.port1.onmessage = (event: MessageEvent) => {
      const data = event.data as BridgeResultMessage | null;
      if (!data || data.type !== BRIDGE_RESULT || data.id !== id) return;
      finish(() => {
        if (data.ok) resolve(data.body);
        else reject(new Error(`bridge request failed (${data.status})`));
      });
    };

    const message: BridgeRequestMessage = { type: BRIDGE_REQUEST, id, route, params };
    // Port must be transferred, not cloned, for the host to reply on it.
    window.parent.postMessage(message, "*", [channel.port2]);
  });
}

export interface HostBridgeOptions {
  /** Routes to expose; defaults to {@link DEFAULT_ROUTES}. */
  routes?: Record<string, BridgeRoute>;
  /** Restrict which origins may call the bridge. Defaults to any. */
  allowOrigin?: string | ((origin: string) => boolean);
}

function originAllowed(origin: string, allow: HostBridgeOptions["allowOrigin"]): boolean {
  if (!allow) return true;
  if (typeof allow === "string") return origin === allow;
  return allow(origin);
}

/**
 * Host side: answer guest requests.
 *
 * Mount on the page that owns the v86 instance. Responses go back on the
 * port the requester supplied, so a forged envelope can at worst trigger a
 * call — it can never receive the answer.
 *
 * @returns an unsubscribe function.
 */
export function installHostBridge(options: HostBridgeOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};

  const routes = options.routes ?? DEFAULT_ROUTES;

  const onMessage = (event: MessageEvent) => {
    const data = event.data as BridgeRequestMessage | null;
    if (!data || data.type !== BRIDGE_REQUEST) return;

    const port = event.ports?.[0];
    if (!port) return;

    const reply = (message: BridgeResultMessage) => port.postMessage(message);

    const definition = routes[data.route];
    if (!definition) {
      reply({ type: BRIDGE_RESULT, id: data.id, ok: false, status: 404, body: { error: "unknown route" } });
      return;
    }

    if (!originAllowed(event.origin, options.allowOrigin)) {
      reply({ type: BRIDGE_RESULT, id: data.id, ok: false, status: 403, body: { error: "origin not allowed" } });
      return;
    }

    const url = buildRequestUrl(definition, data.params ?? {});

    void fetch(url, {
      method: definition.method ?? "GET",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        // The host may answer with HTML (e.g. a dev-server fallback); never
        // hand that to the guest as if it were data.
        const text = await response.text();
        let body: unknown = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          reply({
            type: BRIDGE_RESULT,
            id: data.id,
            ok: false,
            status: 502,
            body: { error: "host returned a non-JSON response" },
          });
          return;
        }
        reply({ type: BRIDGE_RESULT, id: data.id, ok: response.ok, status: response.status, body });
      })
      .catch((cause: unknown) => {
        reply({
          type: BRIDGE_RESULT,
          id: data.id,
          ok: false,
          status: 502,
          body: { error: cause instanceof Error ? cause.message : "host request failed" },
        });
      });
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
