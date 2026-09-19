"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";
import { probeGuest, registerGuestProxy } from "@/lib/guest-proxy";

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
/** Called once the guest is serving HTTP on port 80. */
let servedCallback: (() => void) | null = null;
let announcedServed = false;
let emulatorRef: SimVm["emulator"] | null = null;
const listeners = new Set<Listener>();
const SNAPSHOT_DB = "lam-linux-sim";
const SNAPSHOT_STORE = "snapshots";
const SNAPSHOT_KEY = "buildroot-bzimage68-v1";
const SNAPSHOT_INTERVAL_MS = 60_000;
let snapshotInFlight = false;
let snapshotPageHideRegistered = false;

type StatefulEmulator = SimVm["emulator"] & {
  save_state(callback: (error: Error | null, state?: ArrayBuffer) => void): void;
};

function openSnapshotDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(SNAPSHOT_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SNAPSHOT_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readSnapshot(): Promise<ArrayBuffer | undefined> {
  const db = await openSnapshotDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const request = db.transaction(SNAPSHOT_STORE, "readonly").objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result instanceof ArrayBuffer ? request.result : undefined);
    };
    request.onerror = () => {
      db.close();
      resolve(undefined);
    };
  });
}

async function writeSnapshot(state: ArrayBuffer): Promise<void> {
  const db = await openSnapshotDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(SNAPSHOT_STORE, "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).put(state, SNAPSHOT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

function saveSnapshot() {
  if (!emulatorRef || !announcedReady || snapshotInFlight) return;
  snapshotInFlight = true;
  (emulatorRef as StatefulEmulator).save_state((error, state) => {
    snapshotInFlight = false;
    if (!error && state) void writeSnapshot(state);
  });
}

function registerSnapshotOnPageHide() {
  if (snapshotPageHideRegistered || typeof window === "undefined") return;
  snapshotPageHideRegistered = true;
  window.addEventListener("pagehide", saveSnapshot);
}

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

/**
 * Push the static HTTP server and the single-file site into the guest (9p
 * share), then start serving on port 80. The stock image ships no httpd, so
 * we hand it a static i686 busybox.
 */
async function provisionGuest(
  emulator: SimVm["emulator"],
  write: (text: string) => void,
): Promise<void> {
  try {
    const [busybox, site] = await Promise.all([
      fetch("/sim/busybox-i686").then((res) => {
        if (!res.ok) throw new Error(`busybox fetch ${res.status}`);
        return res.arrayBuffer();
      }),
      fetch("/guest-site.html").then((res) => {
        if (!res.ok) throw new Error(`site fetch ${res.status}`);
        return res.text();
      }),
    ]);

    await emulator.create_file("/busybox", new Uint8Array(busybox));
    await emulator.create_file("/index.html", new TextEncoder().encode(site));
    write(`\r\n[host] pushed busybox (${Math.round(busybox.byteLength / 1024)} KiB) + index.html to the 9p share\r\n`);

    emulator.serial0_send(
      [
        "mkdir -p /www /mnt /opt",
        "mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt 2>/dev/null || mount -t 9p host9p /mnt 2>/dev/null",
        // busybox only treats argv[1] as the applet when it is invoked as
        // "busybox", so it must be installed under that exact name.
        "cp /mnt/busybox /opt/busybox && chmod +x /opt/busybox",
        "cp /mnt/index.html /www/index.html",
        "ifconfig eth0 up",
        "udhcpc -i eth0 -n -q -t 8 >/dev/null 2>&1",
        "/opt/busybox httpd -h /www -p 80",
        "echo '[guest] httpd listening on :80'",
        "",
      ].join("\n"),
    );

    // Wait until the guest actually accepts connections, then hand control to
    // the window that shows the guest-served page.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await probeGuest(emulator as never)) {
        write("[host] guest httpd is reachable on :80\r\n");
        announcedServed = true;
        servedCallback?.();
        saveSnapshot();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    write("[host] guest httpd did not become reachable\r\n");
  } catch (cause) {
    write(`\r\n[host] provisioning failed: ${cause instanceof Error ? cause.message : String(cause)}\r\n`);
  }
}

async function ensureBoot(): Promise<SimVm> {
  if (boot) return boot;

  host = buildHost();
  const vga = buildVgaContainer();
  registerSnapshotOnPageHide();
  emit("loading");

  boot = (async () => {
    const initialState = await readSnapshot();
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
      filesystem: true,
      initialState,
    });
    const emulator = vm.emulator;
    emulatorRef = emulator;
    registerGuestProxy(() => emulatorRef as never);

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
    const pendingText: string[] = [];
    const writeOut = (text: string) => {
      if (terminalWrite) terminalWrite(text);
      else pendingText.push(text);
    };
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
        void provisionGuest(emulator, writeOut);
      }
    });

    emulator.add_listener("emulator-ready", () => {
      emit("booting");
      refit?.();
    });
    emulator.add_listener("emulator-started", () => {
      emit("running");
      refit?.();
      if (initialState) {
        announcedReady = true;
        announcedServed = true;
        readyCallback?.();
        servedCallback?.();
        // The terminal itself is not part of v86's snapshot. Ask the restored
        // shell to redraw its prompt after serial listeners are attached.
        emulator.serial0_send("\n");
      }
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
    if (pendingText.length > 0) {
      terminal.write(pendingText.join(""));
      pendingText.length = 0;
    }

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

    setInterval(saveSnapshot, SNAPSHOT_INTERVAL_MS);

    return vm;
  })();

  boot.catch((cause) => {
    emit("error", cause instanceof Error ? cause.message : String(cause));
  });

  return boot;
}

export function SimView({
  onReady,
  onServed,
}: { onReady?: () => void; onServed?: () => void } = {}) {
  const slot = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<SimStatus>(status);
  const [currentDetail, setCurrentDetail] = useState<string | undefined>(detail);

  useEffect(() => {
    readyCallback = onReady ?? null;
    servedCallback = onServed ?? null;
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
      // Callbacks are intentionally NOT cleared here: the window minimizes (and
      // unmounts this view) as soon as the shell is ready, while boot-time work
      // such as guest provisioning is still running and must be able to report
      // back to the page.
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
