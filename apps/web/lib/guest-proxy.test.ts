import { describe, expect, it } from "vitest";
import { fetchFromGuest, probeGuest } from "@/lib/guest-proxy";

type Handler = (arg?: unknown) => void;

function fakeConnection() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on(event: string, handler: Handler) {
      (handlers[event] ||= []).push(handler);
    },
    write() {
      /* request bytes are irrelevant to the assertions */
    },
    emit(event: string, arg?: unknown) {
      for (const handler of handlers[event] ?? []) handler(arg);
    },
  };
}

describe("fetchFromGuest", () => {
  it("parses status, headers and body from the guest response", async () => {
    const connection = fakeConnection();
    const emulator = { network_adapter: { connect: () => connection } };

    const pending = fetchFromGuest(emulator as never, { method: "GET", path: "/" });
    connection.emit("connect");
    connection.emit(
      "data",
      new TextEncoder().encode(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\nContent-Length: 5\r\n\r\nhello",
      ),
    );
    connection.emit("close");

    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/html");
    // Hop-by-hop headers must not be forwarded onto the synthesized Response.
    expect(response.headers["Connection"]).toBeUndefined();
    expect(response.headers["Content-Length"]).toBeUndefined();
    expect(new TextDecoder().decode(response.body)).toBe("hello");
  });

  it("joins chunked data and reports the guest status code", async () => {
    const connection = fakeConnection();
    const emulator = { network_adapter: { connect: () => connection } };

    const pending = fetchFromGuest(emulator as never, { method: "GET", path: "/missing" });
    connection.emit("connect");
    connection.emit("data", new TextEncoder().encode("HTTP/1.0 404 Not Found\r\n\r\n"));
    connection.emit("data", new TextEncoder().encode("nope"));
    connection.emit("shutdown");

    const response = await pending;
    expect(response.status).toBe(404);
    expect(new TextDecoder().decode(response.body)).toBe("nope");
  });
});

describe("probeGuest", () => {
  it("returns true when tcp_probe reports an open port", async () => {
    const emulator = { network_adapter: { tcp_probe: async () => true, connect: () => fakeConnection() } };
    await expect(probeGuest(emulator as never, 80)).resolves.toBe(true);
  });

  it("returns false when tcp_probe throws", async () => {
    const emulator = {
      network_adapter: {
        tcp_probe: async () => {
          throw new Error("no backend");
        },
        connect: () => fakeConnection(),
      },
    };
    await expect(probeGuest(emulator as never, 80)).resolves.toBe(false);
  });
});
