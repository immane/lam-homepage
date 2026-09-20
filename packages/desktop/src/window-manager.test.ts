import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWindowManager, type WindowDescriptor } from "./window-manager";

type Meta = { tag?: string };

function setup() {
  return renderHook(() => useWindowManager<Meta>({ baseZ: 100 }));
}

describe("useWindowManager", () => {
  it("opens a window with a cascade offset and focuses it", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "url", label: "a", meta: { tag: "a" } });
    });
    act(() => {
      result.current.open({ kind: "url", label: "b", meta: { tag: "b" } });
    });

    expect(result.current.windows).toHaveLength(2);
    expect(result.current.windows[0].initialOffset).toEqual({ x: 0, y: 0 });
    expect(result.current.windows[1].initialOffset).toEqual({ x: 32, y: 28 });
    // The most recently opened window is active.
    expect(result.current.activeId).toBe(result.current.windows[1].id);
  });

  it("openOrFocus focuses an existing match instead of duplicating", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "repo", label: "octo/hello", meta: { tag: "hello" } });
    });
    const firstId = result.current.windows[0].id;

    act(() => {
      result.current.openOrFocus(
        (w: WindowDescriptor<Meta>) => w.meta?.tag === "hello",
        { kind: "repo", label: "octo/hello", meta: { tag: "hello" } },
      );
    });

    expect(result.current.windows).toHaveLength(1);
    expect(result.current.activeId).toBe(firstId);
  });

  it("minimize clears active; restore focuses again", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "sim", label: "shell", meta: {} });
    });
    const id = result.current.windows[0].id;

    act(() => result.current.minimize(id));
    expect(result.current.windows[0].minimized).toBe(true);
    expect(result.current.activeId).toBeNull();

    act(() => result.current.restore(id));
    expect(result.current.windows[0].minimized).toBe(false);
    expect(result.current.activeId).toBe(id);
  });

  it("close removes the window and clears active if it was active", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "url", label: "x", meta: {} });
    });
    const id = result.current.windows[0].id;

    act(() => result.current.close(id));
    expect(result.current.windows).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
  });

  it("focus raises a window to a new z and unminimizes it", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "url", label: "a", meta: {} });
    });
    act(() => {
      result.current.open({ kind: "url", label: "b", meta: {} });
    });
    const a = result.current.windows[0].id;
    const zBefore = result.current.windows[0].z;

    act(() => result.current.focus(a));
    expect(result.current.activeId).toBe(a);
    expect(result.current.windows[0].z).toBeGreaterThan(zBefore);
    expect(result.current.windows[0].minimized).toBe(false);
  });

  it("deactivateAll clears the active window without closing any", () => {
    const { result } = setup();
    act(() => {
      result.current.open({ kind: "url", label: "a", meta: {} });
    });
    act(() => result.current.deactivateAll());
    expect(result.current.activeId).toBeNull();
    expect(result.current.windows).toHaveLength(1);
  });
});
