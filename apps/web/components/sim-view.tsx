"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";

export type SimStatus = "loading" | "booting" | "running" | "error";

type Listener = (status: SimStatus, detail?: string) => void;

/**
 * The emulator is a module-level singleton whose DOM lives in a detached
 * "host" element. Windows can be minimized (which unmounts their content) and
 * restored; v86 binds its screen adapter to the DOM nodes, so we keep those
 * nodes alive across mount/unmount and just re-parent the host instead of
 * rebooting the guest.
 *
 * A single VGA console (tty0) shows both the kernel boot log and the shell —
 * there is no separate serial terminal.
 */
let host: HTMLElement | null = null;
let boot: Promise<SimVm> | null = null;
let status: SimStatus = "loading";
let detail: string | undefined;
const listeners = new Set<Listener>();

function emit(next: SimStatus, nextDetail?: string) {
  status = next;
  detail = nextDetail;
  for (const listener of listeners) listener(next, nextDetail);
}

function buildHost(): HTMLElement {
  // v86 ScreenAdapter expects: firstChild = text div, plus a <canvas>.
  const screen = document.createElement("div");
  screen.className = "sim-screen";
  screen.tabIndex = 0;

  const text = document.createElement("div");
  text.style.whiteSpace = "pre";
  text.style.font = "14px monospace";
  text.style.lineHeight = "14px";

  const canvas = document.createElement("canvas");
  canvas.style.display = "none";

  screen.append(text, canvas);
  return screen;
}

async function ensureBoot(): Promise<SimVm> {
  if (boot) return boot;

  host = buildHost();
  emit("loading");

  boot = (async () => {
    const vm = await createSimVm({ screen: host }, { autostart: true });
    vm.emulator.add_listener("emulator-ready", () => emit("booting"));
    vm.emulator.add_listener("emulator-started", () => emit("running"));
    return vm;
  })();

  boot.catch((cause) => {
    emit("error", cause instanceof Error ? cause.message : String(cause));
  });

  return boot;
}

export function SimView() {
  const slot = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<SimStatus>(status);
  const [currentDetail, setCurrentDetail] = useState<string | undefined>(detail);

  useEffect(() => {
    const listener: Listener = (next, nextDetail) => {
      setCurrent(next);
      setCurrentDetail(nextDetail);
    };
    listeners.add(listener);
    void ensureBoot().catch(() => {
      /* surfaced through emit() */
    });

    const node = slot.current;
    if (node && host) node.appendChild(host);

    return () => {
      listeners.delete(listener);
      // Detach (keep alive) so minimize/restore does not reboot the guest.
      if (host && host.parentElement === node) host.remove();
    };
  }, []);

  return (
    <div className="sim-shell">
      {/* The status line would otherwise steal vertical space from the
          console; once the guest is up the console owns the full window. */}
      {current !== "running" && (
        <div className="sim-statusbar">
          <span className="sim-status-dot" data-state={current} aria-hidden />
          <span>
            {`guest ${current}`}
            {currentDetail ? ` — ${currentDetail}` : ""}
          </span>
        </div>
      )}
      <div className="sim-slot" ref={slot} />
    </div>
  );
}
