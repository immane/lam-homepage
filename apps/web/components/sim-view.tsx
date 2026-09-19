"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";

export type SimStatus = "loading" | "booting" | "running" | "error";

type Listener = (status: SimStatus, detail?: string) => void;

/**
 * The emulator is a module-level singleton whose DOM lives in a detached
 * "host" element. Windows can be minimized (which unmounts their content) and
 * restored; v86 binds its screen/serial adapters to the DOM nodes, so we keep
 * those nodes alive across mount/unmount and just re-parent the host instead
 * of rebooting the guest.
 */
let host: HTMLElement | null = null;
let boot: Promise<SimVm> | null = null;
let resizeObserver: ResizeObserver | null = null;
let status: SimStatus = "loading";
let detail: string | undefined;
const listeners = new Set<Listener>();

function emit(next: SimStatus, nextDetail?: string) {
  status = next;
  detail = nextDetail;
  for (const listener of listeners) listener(next, nextDetail);
}

function buildHost(): HTMLElement {
  const root = document.createElement("div");
  root.className = "sim-view";

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

  const term = document.createElement("div");
  term.className = "sim-term";

  root.append(screen, term);
  return root;
}

async function ensureBoot(): Promise<SimVm> {
  if (boot) return boot;

  host = buildHost();
  const screenEl = host.querySelector<HTMLElement>(".sim-screen");
  const termEl = host.querySelector<HTMLElement>(".sim-term");
  emit("loading");

  boot = (async () => {
    const vm = await createSimVm(screenEl ? { screen: screenEl } : {}, { autostart: true });
    const emulator = vm.emulator;

    // Terminal bound to serial0.
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    const term = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: { background: "#000000", foreground: "#7dffa0", cursor: "#39d353" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    if (termEl) {
      term.open(termEl);
      const refit = () => {
        try {
          if (termEl.clientWidth > 0 && termEl.clientHeight > 0) fit.fit();
        } catch {
          // ignore fit races while the window is hidden/resized
        }
      };
      refit();
      resizeObserver = new ResizeObserver(refit);
      resizeObserver.observe(termEl);
    }

    // Auto-login: the placeholder image runs a getty on ttyS0.
    let line = "";
    let loggedIn = false;
    emulator.add_listener("serial0-output-byte", (byte) => {
      const ch = String.fromCharCode(byte);
      term.write(ch);
      if (loggedIn) return;
      line += ch;
      if (line.endsWith("login: ")) {
        emulator.serial0_send("root\n");
        loggedIn = true;
      }
      if (line.length > 200) line = line.slice(-200);
    });
    term.onData((data) => emulator.serial0_send(data));

    emulator.add_listener("emulator-ready", () => emit("booting"));
    emulator.add_listener("emulator-started", () => emit("running"));

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
      <div className="sim-statusbar">
        <span className="sim-status-dot" data-state={current} aria-hidden />
        <span>
          {current === "running" ? "guest running" : `guest ${current}`}
          {currentDetail ? ` — ${currentDetail}` : ""}
        </span>
        <span className="sim-hint">click the screen to type · serial console below</span>
      </div>
      <div className="sim-slot" ref={slot} />
    </div>
  );
}
