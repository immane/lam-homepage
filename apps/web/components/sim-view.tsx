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
 * Console routing: this guest kernel has **no serial console support**
 * (`/proc/consoles` only lists `tty0`), so the kernel boot log never reaches
 * ttyS0 — it goes to the VGA text console. To show the boot process live, a
 * hidden VGA screen container is attached to v86 and its text rows are
 * streamed line by line into the terminal; the serial port remains the
 * interactive shell.
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

/** Hidden VGA container in v86's expected shape (rows div + canvas). */
function buildVgaContainer(): HTMLElement {
  const container = document.createElement("div");
  container.className = "sim-vga";
  const rows = document.createElement("div");
  rows.style.whiteSpace = "pre";
  rows.style.font = "14px monospace";
  rows.style.lineHeight = "14px";
  const canvas = document.createElement("canvas");
  canvas.style.display = "none";
  container.append(rows, canvas);
  document.body.appendChild(container);
  return container;
}

/** Read the VGA text rows (trailing whitespace stripped). */
function readVgaRows(container: HTMLElement): string[] {
  const rows = container.querySelector("div");
  if (!rows) return [];
  return Array.from(rows.children).map((el) => (el.textContent ?? "").replace(/\s+$/, ""));
}

/**
 * Lines that appeared since the previous snapshot. A console screen scrolls,
 * so we match the tail of the previous screen against the head of the current
 * one and treat the remainder as new output.
 */
function newVgaLines(previous: string[], current: string[]): string[] {
  const maxOverlap = Math.min(previous.length, current.length);
  let overlap = 0;
  for (let candidate = maxOverlap; candidate > 0; candidate--) {
    let matches = true;
    for (let i = 0; i < candidate; i++) {
      if (previous[previous.length - candidate + i] !== current[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      overlap = candidate;
      break;
    }
  }
  return current.slice(overlap);
}

async function ensureBoot(): Promise<SimVm> {
  if (boot) return boot;

  host = buildHost();
  const vga = buildVgaContainer();
  emit("loading");

  boot = (async () => {
    // The stock kernel we started with has no PCI/NIC support, so host<->guest
    // networking needs v86's upstream buildroot image (modern kernel, virtio
    // NIC) with the in-browser "fetch" backend.
    const vm = await createSimVm({ screen: vga }, {
      autostart: true,
      boot: {
        mode: "bzimage",
        bzImage: "/sim/buildroot-bzimage68.bin",
        cmdline: "console=ttyS0,115200 console=tty0 loglevel=7 tsc=reliable mitigations=off random.trust_cpu=on",
      },
      network: { type: "virtio", relayUrl: "fetch" },
    });
    const emulator = vm.emulator;

    // Debug/proxy hook: exposes v86's networking (tcp_probe/connect) to the
    // host page and devtools — the basis for a guest-service proxy.
    if (typeof window !== "undefined") {
      (window as unknown as { __lamSim?: unknown }).__lamSim = emulator;
    }

    // Grab serial output immediately and buffer it: the guest starts booting
    // as soon as the emulator is ready, while the terminal library still has
    // to load.
    let terminalWrite: ((text: string) => void) | null = null;
    const buffered: number[] = [];
    let tail = "";
    let loggedIn = false;
    let mirror: ReturnType<typeof setInterval> | null = null;

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

      tail = (tail + char).slice(-400);
      if (!loggedIn && tail.endsWith("login: ")) {
        emulator.serial0_send("root\n");
        loggedIn = true;
        return;
      }
      // The serial shell is interactive once it prints its prompt.
      if (!announcedReady && /(\/root%|~%)\s*$/.test(tail)) {
        announcedReady = true;
        if (mirror !== null) {
          clearInterval(mirror);
          mirror = null;
        }
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

    if (typeof window !== "undefined") {
      (window as unknown as { __lamTerm?: unknown }).__lamTerm = terminal;
    }

    // Replay everything captured during boot, then stream live.
    if (buffered.length > 0) {
      terminal.write(new TextDecoder().decode(new Uint8Array(buffered)));
      buffered.length = 0;
    }
    terminalWrite = (text) => terminal.write(text);

    // Stream the VGA console (where the kernel logs) into the terminal, line
    // by line, until the interactive shell on serial is ready.
    let previousRows: string[] = [];
    mirror = setInterval(() => {
      const rows = readVgaRows(vga);
      const added = newVgaLines(previousRows, rows);
      previousRows = rows;
      // The last row may still be mid-write; hold it back until the console
      // moves on, so lines are emitted exactly once and complete.
      const ready = added.slice(0, -1);
      let end = ready.length;
      while (end > 0 && ready[end - 1] === "") end--;
      if (end > 0) terminal.write(ready.slice(0, end).map((line) => line + "\r\n").join(""));
    }, 120);

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
