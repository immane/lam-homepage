import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * The SimView keeps a module-level v86 singleton, so each test gets a fresh
 * module registry (vi.resetModules + dynamic import) to isolate state.
 */
const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (arg: unknown) => void>();
  const calls = { createSimVm: 0 };
  const emulator = {
    add_listener: (event: string, cb: (arg: unknown) => void) => {
      listeners.set(event, cb);
    },
  };
  return {
    listeners,
    calls,
    emulator,
    reset() {
      listeners.clear();
      calls.createSimVm = 0;
    },
  };
});

vi.mock("@lam/sim-vm", () => ({
  createSimVm: vi.fn(async () => {
    mocks.calls.createSimVm += 1;
    return { emulator: mocks.emulator, destroy: vi.fn() };
  }),
}));

beforeEach(() => {
  vi.resetModules();
  mocks.reset();
});

afterEach(() => {
  cleanup();
});

async function renderSimView() {
  const { SimView } = await import("@/components/sim-view");
  return render(<SimView />);
}

describe("SimView", () => {
  it("boots a v86 instance and renders the guest console container", async () => {
    const { container } = await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    // A single VGA console hosts both the boot log and the shell: the screen
    // container needs v86's expected structure (text div + canvas).
    expect(container.querySelector(".sim-screen")).not.toBeNull();
    expect(container.querySelector(".sim-screen > div")).not.toBeNull();
    expect(container.querySelector(".sim-screen canvas")).not.toBeNull();
    // No separate serial terminal pane.
    expect(container.querySelector(".sim-term")).toBeNull();
  });

  it("hides the status line once the guest is running (console takes full height)", async () => {
    await renderSimView();
    await waitFor(() => expect(mocks.calls.createSimVm).toBe(1));
    expect(screen.getByText(/guest /)).toBeInTheDocument();
    mocks.listeners.get("emulator-started")?.(undefined);
    await waitFor(() => expect(screen.queryByText(/guest /)).toBeNull());
  });
});
