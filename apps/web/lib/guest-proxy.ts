/**
 * Guest HTTP proxy (page side).
 *
 * The service worker intercepts `/guest/*` but cannot reach the v86 instance,
 * so it forwards each request here over a MessageChannel. This module performs
 * the actual exchange against port 80 inside the emulated Linux and hands the
 * parsed response back.
 */

interface GuestConnection {
  on(event: "connect" | "close" | "shutdown", handler: () => void): void;
  on(event: "data", handler: (data: Uint8Array) => void): void;
  write(data: Uint8Array): void;
}

interface GuestEmulator {
  network_adapter: {
    connect(port: number): GuestConnection;
    tcp_probe?(port: number): Promise<boolean>;
  };
}

export interface GuestResponse {
  status: number;
  headers: Record<string, string>;
  body: ArrayBuffer;
}

const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "content-length"]);

/** True once the guest accepts TCP connections on `port`. */
export async function probeGuest(emulator: GuestEmulator, port = 80): Promise<boolean> {
  try {
    const probe = emulator.network_adapter.tcp_probe;
    if (probe) {
      // tcp_probe does not always settle (no listener -> no reply), so race it
      // against a timeout instead of awaiting it forever.
      const result = await Promise.race([
        probe.call(emulator.network_adapter, port).catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
      ]);
      return result === true;
    }
  } catch {
    /* fall through to a connect attempt */
  }
  return new Promise((resolve) => {
    try {
      const connection = emulator.network_adapter.connect(port);
      const timer = setTimeout(() => resolve(false), 3000);
      connection.on("connect", () => {
        clearTimeout(timer);
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

function parseHttpResponse(chunks: Uint8Array[]): GuestResponse {
  const total = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let separator = -1;
  for (let i = 0; i + 3 < buffer.length; i += 1) {
    if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) {
      separator = i;
      break;
    }
  }

  const headerText = new TextDecoder().decode(separator >= 0 ? buffer.subarray(0, separator) : buffer);
  const lines = headerText.split("\r\n");
  const status = Number(lines.shift()?.split(" ")[1]) || 502;

  const headers: Record<string, string> = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim();
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    headers[name] = line.slice(colon + 1).trim();
  }

  const body = separator >= 0 ? buffer.slice(separator + 4) : new Uint8Array();
  return { status, headers, body: body.buffer as ArrayBuffer };
}

export function fetchFromGuest(
  emulator: GuestEmulator,
  request: { method: string; path: string },
): Promise<GuestResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    try {
      const connection = emulator.network_adapter.connect(80);
      const chunks: Uint8Array[] = [];

      connection.on("connect", () => {
        connection.write(
          new TextEncoder().encode(
            `${request.method} ${request.path} HTTP/1.0\r\nHost: guest\r\nConnection: close\r\n\r\n`,
          ),
        );
      });
      connection.on("data", (data: Uint8Array) => chunks.push(data));
      connection.on("close", () => finish(() => resolve(parseHttpResponse(chunks))));
      connection.on("shutdown", () => finish(() => resolve(parseHttpResponse(chunks))));

      setTimeout(() => finish(() => resolve(parseHttpResponse(chunks))), 15000);
    } catch (cause) {
      reject(cause);
    }
  });
}

/**
 * Resolve `true` once a service worker is active and can intercept `/guest/*`.
 *
 * Resolves `false` when the browser has no service worker support at all (e.g.
 * WeChat's X5 browser), so the caller can fall back to the host-served static
 * build instead of letting the request reach the app router and render its 404
 * page. A registration that never activates simply keeps this pending.
 */
export function waitForGuestProxy(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(false);
  }
  return navigator.serviceWorker.ready.then(
    () => true,
    () => false,
  );
}

/**
 * Register the service worker and answer its guest requests. Safe to call more
 * than once; later registrations just replace the emulator lookup.
 */
export function registerGuestProxy(getEmulator: () => GuestEmulator | null): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/sw.js").catch(() => {
    /* the guest window will surface an unavailable error */
  });

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; method?: string; path?: string } | null;
    if (!data || data.type !== "guest-request") return;
    const port = event.ports?.[0];
    if (!port) return;

    const emulator = getEmulator();
    if (!emulator) {
      port.postMessage({ error: "simulator is not running" });
      return;
    }

    void fetchFromGuest(emulator, { method: data.method ?? "GET", path: data.path ?? "/" })
      .then((response) => port.postMessage(response))
      .catch((cause: unknown) =>
        port.postMessage({ error: cause instanceof Error ? cause.message : String(cause) }),
      );
  });
}
