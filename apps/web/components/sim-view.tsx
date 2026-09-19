"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";

export type SimStatus = "loading" | "booting" | "running" | "error";

type Listener = (status: SimStatus, detail?: string) => void;

/**
 * The emulator is a module-level singleton whose DOM lives in a detached
 * "host" element. Windows can be minimized (which unmounts their content) and
 * restored; the xterm instance is bound to that host, so we keep it alive
 * across mount/unmount and just re-parent the host instead of rebooting the
 * guest.
 *
 * Everything is shown in one terminal: the guest is booted with
 * `console=ttyS0`, so the kernel boot log and the shell share the serial
 * stream that xterm renders.
 */
let host: HTMLElement | null = null;
let boot: Promise<SimVm> | null = null;
let refit: (() => void) | null = null;
let status: SimStatus = "loading";
let detail: string | undefined;
/** Called once when the guest reaches an interactive shell prompt. */
let readyCallback: (() => void) | null = null;
let announcedReady = false;
const listeners = new Set<Listener>();

function emit(next: SimStatus, nextDetail?: string) {
  status = next;
  detail = nextDetail;
  for (const listener of listeners) listener(next, nextDetail);
}

function buildHost(): HTMLElement {
  const element = document.createElement("div");
  element.className = "sim-term-host";
  return element;
}

async function ensureBoot(): Promise<SimVm> {
  if (boot) return boot;

  host = buildHost();
  emit("loading");

  boot = (async () => {
    // EXPERIMENT: the stock kernel we booted first has no PCI/NIC support, so
    // to validate host->guest networking we boot v86's upstream buildroot
    // image (modern kernel, virtio NIC) with the in-browser "fetch" backend.
    const vm = await createSimVm({}, {
      autostart: true,
      boot: {
        mode: "bzimage",
        bzImage: "/sim/buildroot-bzimage68.bin",
        cmdline: "console=ttyS0,115200 loglevel=7 tsc=reliable mitigations=off random.trust_cpu=on",
      },
      network: { type: "virtio", relayUrl: "fetch" },
    });

    // Debug/proxy hook: exposes v86's networking (tcp_probe/connect) to the
    // host page and devtools — the basis for a guest-service proxy.
    if (typeof window !== "undefined") {
      (window as unknown as { __lamSim?: unknown }).__lamSim = vm.emulator;
    }
    const emulator = vm.emulator;

    // Grab serial output *immediately*. The guest starts booting as soon as
    // the emulator is ready, while the terminal library still has to load —
    // anything that arrives before the terminal exists is buffered and
    // replayed, otherwise the kernel boot log is lost.
    let terminalWrite: ((text: string) => void) | null = null;
    const buffered: number[] = [];
    let tail = "";
    let loggedIn = false;

    // Raw serial capture for diagnostics (unaffected by terminal clearing).
    const rawLog: string[] = [];
    if (typeof window !== "undefined") {
      (window as unknown as { __lamSerialLog?: string[] }).__lamSerialLog = rawLog;
    }

    emulator.add_listener("serial0-output-byte", (byte) => {
      const char = String.fromCharCode(byte);
      if (terminalWrite) terminalWrite(char);
      else buffered.push(byte);
      rawLog.push(char);
      if (rawLog.length > 400000) rawLog.splice(0, 200000);

      tail = (tail + char).slice(-200);
      if (!loggedIn && tail.endsWith("login: ")) {
        emulator.serial0_send("root\n");
        loggedIn = true;
        return;
      }
      if (!announcedReady && /(\/root%|~%)\s*$/.test(tail)) {
        announcedReady = true;
        // This image never forwards the kernel log to the serial console
        // (console=ttyS0 is accepted but produces no boot output), so surface
        // it explicitly once the shell is up.
        emulator.serial0_send("dmesg\n");
        readyCallback?.();
      }
    });

    emulator.add_listener("emulator-ready", () => {
      emit("booting");
      refit?.();
    });
    emulator.add_listener("emulator-started", () => {
      emit("running");
      refit?.();
    });

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      scrollback: 5000,
      theme: { background: "#000000", foreground: "#c8ffd4", cursor: "#39d353" },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    if (host) {
      terminal.open(host);
      refit = () => {
        try {
          if (host && host.clientWidth > 0 && host.clientHeight > 0) fitAddon.fit();
        } catch {
          // ignore fit races while the window is hidden/resized
        }
      };
      refit();
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(() => refit?.()).observe(host);
      }
    }

    terminal.onData((data) => emulator.serial0_send(data));

    // Replay everything captured during boot, then stream live.
    if (buffered.length > 0) {
      terminal.write(new TextDecoder().decode(new Uint8Array(buffered)));
      buffered.length = 0;
    }
    terminalWrite = (text) => terminal.write(text);

    return vm;
  })();

  boot.catch((cause) => {
    emit("error", cause instanceof Error ? cause.message : String(cause));
  });

  return boot;
}

export function SimView({ onReady }: { onReady?: () => void } = {}) {
  const slot = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<SimStatus>(status);
  const [currentDetail, setCurrentDetail] = useState<string | undefined>(detail);

  useEffect(() => {
    readyCallback = onReady ?? null;
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
    refit?.();
    const raf = requestAnimationFrame(() => refit?.());

    return () => {
      cancelAnimationFrame(raf);
      listeners.delete(listener);
      if (readyCallback === onReady) readyCallback = null;
      // Detach (keep alive) so minimize/restore does not reboot the guest.
      if (host && host.parentElement === node) host.remove();
    };
    // onReady identity is stable in practice; the callback is read via module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sim-shell">
      {/* The status line would otherwise steal vertical space from the
          console; once the guest is up the terminal owns the full window. */}
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
