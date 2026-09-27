import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * The SimView keeps a module-level v86 singleton, so each test gets a fresh
 * module registry (vi.resetModules + dynamic import) to isolate state.
 */
const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (arg: unknown) => void>();
  const calls = {
    write: [] as string[],
    serialSend: [] as string[],
    createSimVm: 0,
    createOptions: undefined as Record<string, unknown> | undefined,
  };
  let onData: ((data: string) => void) | undefined;

  const emulator = {
    add_listener: (event: string, cb: (arg: unknown) => void) => {
      listeners.set(event, cb);
    },
    serial0_send: (data: string) => calls.serialSend.push(data),
    create_file: vi.fn(async () => undefined),
    read_file: vi.fn(async () => new Uint8Array()),
  };

  const Terminal = class {
    open() {}
    loadAddon() {}
    dispose() {}
    write(data: string) {
      calls.write.push(data);
    }
    onData(cb: (data: string) => void) {
      onData = cb;
    }
  };

  const FitAddon = class {
    fit() {}
  };

  return {
    listeners,
    calls,
    emulator,
    Terminal,
    FitAddon,
    getOnData: () => onData,
    reset() {
      listeners.clear();
      calls.write.length = 0;
      calls.serialSend.length = 0;
      calls.createSimVm = 0;
      calls.createOptions = undefined;
      mocks.emulator.create_file.mockClear();
      mocks.emulator.read_file.mockClear();
      onData = undefined;
    },
  };
});

vi.mock("@lam/sim-vm", () => ({
  createSimVm: vi.fn(async (_mount: unknown, options: Record<string, unknown>) => {
    mocks.calls.createSimVm += 1;
    mocks.calls.createOptions = options;
    return { emulator: mocks.emulator, destroy: vi.fn() };
  }),
}));
vi.mock("@xterm/xterm", () => ({ Terminal: mocks.Terminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: mocks.FitAddon }));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

beforeEach(() => {
  vi.resetModules();
  mocks.reset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

async function renderSimView(props: { onReady?: () => void } = {}) {
  const { SimView } = await import("@/components/sim-view");
  return render(<SimView {...props} />);
}

function emitSerial(text: string) {
  const listener = mocks.listeners.get("serial0-output-byte");
  for (const ch of text) listener?.(ch.charCodeAt(0));
}

describe("SimView", () => {
  it("boots a v86 instance into a single terminal pane", async () => {
    const { container } = await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(container.querySelector(".sim-term-host")).not.toBeNull();
    // No separate VGA pane — everything goes through the terminal.
    expect(container.querySelector(".sim-screen")).toBeNull();
  });

  it("restores the same emulator and terminal after the window is minimized", async () => {
    const { SimView } = await import("@/components/sim-view");
    const first = render(<SimView />);
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    const terminalHost = first.container.querySelector(".sim-term-host");
    expect(terminalHost).not.toBeNull();

    first.unmount();
    const restored = render(<SimView />);
    expect(mocks.calls.createSimVm).toBe(1);
    expect(restored.container.querySelector(".sim-term-host")).toBe(terminalHost);
  });

  it("forwards serial output into the terminal (kernel log + shell)", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    emitSerial("VFS: Mounted root");
    expect(mocks.calls.write.join("")).toContain("VFS: Mounted root");
  });

  it("auto-logs in as root when the getty prints a login prompt", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(mocks.calls.serialSend).toHaveLength(0);
    emitSerial("(none) login: ");
    expect(mocks.calls.serialSend).toEqual(["root\n"]);
  });

  it("sends terminal input to the guest serial port", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    mocks.getOnData()?.("ls\n");
    expect(mocks.calls.serialSend).toContain("ls\n");
  });

  it("reports readiness once the shell prompt appears (fired once)", async () => {
    const onReady = vi.fn();
    await renderSimView({ onReady });
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    emitSerial("(none) login: ");
    expect(onReady).not.toHaveBeenCalled();
    emitSerial("\r\n/root% ");
    expect(onReady).toHaveBeenCalledTimes(1);
    emitSerial("\r\n/root% ");
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("boots without restoring an IndexedDB VM snapshot", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(mocks.calls.createOptions).not.toHaveProperty("initialState");
    expect(mocks.emulator).not.toHaveProperty("save_state");
  });

  it("starts the in-guest backup daemon once and never injects per-command saves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    try {
      await renderSimView();
      await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
      emitSerial("(none) login: ");
      emitSerial("\r\n/root% ");
      await waitFor(() =>
        expect(
          mocks.emulator.create_file.mock.calls
            .map((call) => (call as unknown[])[0])
            .includes("/guest-backup.sh"),
        ).toBe(true),
      );
      const sendsAfterBoot = mocks.calls.serialSend.length;
      emitSerial("echo hi\r\n/root% ");
      emitSerial("echo again\r\n/root% ");
      const injected = mocks.calls.serialSend.slice(sendsAfterBoot).join("\n");
      expect(injected).not.toContain("guest-backup");
      expect(injected).not.toContain("save-root");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the loading status visible after the emulator starts booting", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(screen.getByText(/Loading Linux images/)).toBeInTheDocument();
    mocks.listeners.get("emulator-started")?.(undefined);
    expect(screen.getByText(/Loading Linux images/)).toBeInTheDocument();
  });
});
