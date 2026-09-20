"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A window managed by {@link useWindowManager}.
 *
 * `kind` and `meta` are opaque to the framework: the host decides what they
 * mean and how to render the body. The framework only needs `label` (chrome)
 * and geometry/session fields.
 */
export interface WindowDescriptor<Meta = unknown> {
  id: string;
  /** Host-defined tag identifying the content type (e.g. "repo", "sim"). */
  kind: string;
  /** Title shown in the toolbar and the minimized dock. */
  label: string;
  /** Optional address-bar text; defaults to `label` when rendering. */
  address?: string;
  z: number;
  minimized: boolean;
  initialOffset: { x: number; y: number };
  /** When false the window cannot be closed. */
  closable?: boolean;
  /** Opaque payload for the host's content renderer. */
  meta?: Meta;
}

export interface OpenWindowInput<Meta = unknown> {
  /** Reuse an existing id to control identity; otherwise one is generated. */
  id?: string;
  kind: string;
  label: string;
  address?: string;
  closable?: boolean;
  meta?: Meta;
  /** Overrides the staggered default position. */
  initialOffset?: { x: number; y: number };
}

export interface UseWindowManagerOptions {
  /** First z-index handed out; increments per focus/open. */
  baseZ?: number;
  /** Per-window cascade step for opening multiple windows. */
  cascadeStep?: { x: number; y: number };
}

function makeId(): string {
  return `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Reusable window state machine: opening (with cascade + focus), closing,
 * focusing, minimizing, restoring and deactivating. Deliberately avoids
 * host policy (auto-open, dedupe rules, content rendering) so the same core
 * can back different desktops.
 */
export function useWindowManager<Meta = unknown>(options: UseWindowManagerOptions = {}) {
  const baseZ = options.baseZ ?? 210;
  const cascadeX = options.cascadeStep?.x ?? 32;
  const cascadeY = options.cascadeStep?.y ?? 28;

  const [windows, setWindows] = useState<WindowDescriptor<Meta>[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const nextZRef = useRef(baseZ);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  const takeZ = useCallback(() => nextZRef.current++, []);

  const focus = useCallback(
    (id: string) => {
      const z = takeZ();
      setActiveId(id);
      setWindows((ws) =>
        ws.map((w) => (w.id === id ? { ...w, minimized: false, z } : w)),
      );
    },
    [takeZ],
  );

  const open = useCallback(
    (input: OpenWindowInput<Meta>): string => {
      const id = input.id ?? makeId();
      const z = takeZ();
      setWindows((ws) => {
        const stagger = ws.length % 6;
        const initialOffset =
          input.initialOffset ?? { x: stagger * cascadeX, y: stagger * cascadeY };
        return [
          ...ws,
          {
            id,
            kind: input.kind,
            label: input.label,
            address: input.address,
            closable: input.closable,
            meta: input.meta,
            z,
            minimized: false,
            initialOffset,
          },
        ];
      });
      setActiveId(id);
      return id;
    },
    [cascadeX, cascadeY, takeZ],
  );

  /** Focus the first window matching `match`, otherwise open a new one. */
  const openOrFocus = useCallback(
    (match: (w: WindowDescriptor<Meta>) => boolean, input: OpenWindowInput<Meta>): string => {
      const existing = windowsRef.current.find(match);
      if (existing) {
        focus(existing.id);
        return existing.id;
      }
      return open(input);
    },
    [focus, open],
  );

  const close = useCallback((id?: string) => {
    if (!id) return;
    setWindows((ws) => ws.filter((w) => w.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const restore = useCallback(
    (id: string) => {
      focus(id);
    },
    [focus],
  );

  const deactivateAll = useCallback(() => setActiveId(null), []);

  const updateMeta = useCallback((id: string, meta: Meta) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, meta } : w)));
  }, []);

  return {
    windows,
    activeId,
    open,
    openOrFocus,
    close,
    focus,
    minimize,
    restore,
    deactivateAll,
    updateMeta,
    setActiveId,
  };
}
