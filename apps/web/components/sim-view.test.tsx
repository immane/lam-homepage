import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * The SimView keeps a module-level v86 singleton, so each test gets a fresh
 * module registry (vi.resetModules + dynamic import) to isolate state.
 */
const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (arg: unknown) => void>();
  const calls = { write: [] as string[], serialSend: [] as string[], createSimVm: 0 };
  let onData: ((data: string) => void) | undefined;

  const emulator = {
    add_listener: (event: string, cb: (arg: unknown) => void) => {
      listeners.set(event, cb);
    },
    serial0_send: (data: string) => calls.serialSend.push(data),
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
      onData = undefined;
    },
  };
});

vi.mock("@lam/sim-vm", () => ({
  createSimVm: vi.fn(async () => {
    mocks.calls.createSimVm += 1;
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

  it("hides the status line once running (terminal takes full height)", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(screen.getByText(/guest /)).toBeInTheDocument();
    mocks.listeners.get("emulator-started")?.(undefined);
    await waitFor(() => expect(screen.queryByText(/guest /)).toBeNull());
  });
});
