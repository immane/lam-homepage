import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRIDGE_OPEN,
  BRIDGE_REQUEST,
  BRIDGE_RESULT,
  buildRequestUrl,
  installHostBridge,
  requestFromHost,
  requestHostOpen,
  type BridgeRequestMessage,
} from "./index";

/**
 * The guest and host live in different origins in production, and jsdom cannot
 * model that pair in one document. These tests therefore drive each side
 * against a fake partner: the guest side posts to a stubbed `parent`, and the
 * host side is invoked by dispatching a synthetic message carrying a real
 * MessageChannel port.
 */
function fakeParent() {
  const sent: Array<{ data: BridgeRequestMessage; port: MessagePort }> = [];
  return {
    sent,
    parent: {
      postMessage: (data: BridgeRequestMessage, _target: string, transfer?: MessagePort[]) => {
        if (transfer?.[0]) sent.push({ data, port: transfer[0] });
      },
    },
  };
}

/**
 * Make the guest think it is embedded (or not) without replacing the whole
 * `window`, so listeners installed by the host-side suite keep working.
 */
function stubGuestWindow(parent: unknown, { embedded = true } = {}) {
  const self = embedded ? {} : parent;
  Object.defineProperty(window, "self", { value: self, configurable: true });
  Object.defineProperty(window, "top", { value: embedded ? {} : parent, configurable: true });
  Object.defineProperty(window, "parent", { value: parent, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // `self`/`top`/`parent` are redefined by the guest-side tests; put them back.
  for (const key of ["self", "top", "parent"] as const) {
    delete (window as unknown as Record<string, unknown>)[key];
  }
});

describe("buildRequestUrl", () => {
  it("appends only the params the route allows", () => {
    const url = buildRequestUrl(
      { target: "/api/github", params: ["owner"] },
      { owner: "octo", secret: "nope" },
    );
    expect(url).toBe("/api/github?owner=octo");
  });

  it("drops params when the route has no allow-list", () => {
    expect(buildRequestUrl({ target: "/api/github" }, { a: "1" })).toBe("/api/github");
  });
});

describe("requestFromHost (guest side)", () => {
  it("posts a request on a transferred port and resolves the reply", async () => {
    const { parent, sent } = fakeParent();
    const restore = stubGuestWindow(parent);

    const promise = requestFromHost("github");
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toMatchObject({ type: BRIDGE_REQUEST, route: "github" });

    // Reply on the port the guest handed over, as the host would.
    const { data, port } = sent[0];
    port.start();
    port.postMessage({
      type: BRIDGE_RESULT,
      id: data.id,
      ok: true,
      status: 200,
      body: { repos: [{ name: "demo" }] },
    });

    await expect(promise).resolves.toEqual({ repos: [{ name: "demo" }] });
  });

  it("rejects for an unknown route without posting", async () => {
    const { parent, sent } = fakeParent();
    stubGuestWindow(parent);
    await expect(requestFromHost("nope")).rejects.toThrow(/unknown bridge route/);
    expect(sent).toHaveLength(0);
  });

  it("rejects when the page is not embedded", async () => {
    const self = {};
    stubGuestWindow(self, { embedded: false });
    await expect(requestFromHost("github")).rejects.toThrow(/not embedded/);
  });

  it("rejects when the host never answers", async () => {
    const { parent } = fakeParent();
    stubGuestWindow(parent);
    await expect(requestFromHost("github", {}, { timeoutMs: 20 })).rejects.toThrow(
      /timed out/,
    );
  });

  it("rejects when the host reports a failure", async () => {
    const { parent, sent } = fakeParent();
    const restore = stubGuestWindow(parent);

    const promise = requestFromHost("github");
    const { data, port } = sent[0];
    port.start();
    port.postMessage({ type: BRIDGE_RESULT, id: data.id, ok: false, status: 500, body: {} });

    await expect(promise).rejects.toThrow(/failed \(500\)/);
  });
});

describe("requestHostOpen (guest side)", () => {
  function fakeParentChannel() {
    const sent: unknown[] = [];
    return {
      sent,
      parent: { postMessage: (data: unknown) => sent.push(data) },
    };
  }

  it("posts an open intent to the host", () => {
    const { parent, sent } = fakeParentChannel();
    stubGuestWindow(parent);
    requestHostOpen({ action: "project", url: "https://github.com/o/r" });
    expect(sent).toEqual([
      { type: BRIDGE_OPEN, action: "project", url: "https://github.com/o/r", homepage: undefined },
    ]);
  });

  it("does nothing when not embedded", () => {
    const { parent, sent } = fakeParentChannel();
    stubGuestWindow(parent, { embedded: false });
    requestHostOpen({ action: "project", url: "https://github.com/o/r" });
    expect(sent).toHaveLength(0);
  });
});

describe("installHostBridge (host side)", () => {
  function dispatch(data: unknown, port?: MessagePort, origin = "http://guest") {
    const event = new MessageEvent("message", { data, origin });
    if (port) Object.defineProperty(event, "ports", { value: [port] });
    window.dispatchEvent(event);
  }

  function nextReply(port: MessagePort): Promise<unknown> {
    return new Promise((resolve) => {
      port.onmessage = (event) => resolve(event.data);
    });
  }

  it("fetches the route and replies on the requester's port", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ repos: [{ name: "demo" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const stop = installHostBridge();
    const channel = new MessageChannel();
    const reply = nextReply(channel.port1);
    dispatch({ type: BRIDGE_REQUEST, id: "1", route: "github", params: { x: "1" } }, channel.port2);

    await expect(reply).resolves.toMatchObject({ type: BRIDGE_RESULT, id: "1", ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/github", expect.objectContaining({ method: "GET" }));
    stop();
  });

  it("rejects unknown routes without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stop = installHostBridge();
    const channel = new MessageChannel();
    const reply = nextReply(channel.port1);
    dispatch({ type: BRIDGE_REQUEST, id: "2", route: "nope" }, channel.port2);

    await expect(reply).resolves.toMatchObject({ ok: false, status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });

  it("never forwards an HTML response as data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => "<!doctype html>" })),
    );

    const stop = installHostBridge();
    const channel = new MessageChannel();
    const reply = nextReply(channel.port1);
    dispatch({ type: BRIDGE_REQUEST, id: "3", route: "github" }, channel.port2);

    await expect(reply).resolves.toMatchObject({ ok: false, status: 502 });
    stop();
  });

  it("honours an origin allow-list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stop = installHostBridge({ allowOrigin: "http://allowed" });
    const channel = new MessageChannel();
    const reply = nextReply(channel.port1);
    dispatch({ type: BRIDGE_REQUEST, id: "4", route: "github" }, channel.port2, "http://denied");

    await expect(reply).resolves.toMatchObject({ ok: false, status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });

  it("routes open intents to onOpen", () => {
    const onOpen = vi.fn();
    const stop = installHostBridge({ onOpen });
    dispatch({ type: BRIDGE_OPEN, action: "project", url: "https://github.com/o/r" });

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project", url: "https://github.com/o/r" }),
      expect.anything(),
    );
    stop();
  });

  it("ignores open intents from a disallowed origin", () => {
    const onOpen = vi.fn();
    const stop = installHostBridge({ onOpen, allowOrigin: "http://allowed" });
    dispatch({ type: BRIDGE_OPEN, action: "project", url: "x" }, undefined, "http://denied");
    expect(onOpen).not.toHaveBeenCalled();
    stop();
  });

  it("stops listening after unsubscribe", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stop = installHostBridge();
    stop();
    const channel = new MessageChannel();
    dispatch({ type: BRIDGE_REQUEST, id: "5", route: "github" }, channel.port2);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
