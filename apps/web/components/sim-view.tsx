"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";
import { probeGuest, registerGuestProxy } from "@/lib/guest-proxy";
import { Progress } from "@/components/ui/progress";

export type SimStatus = "loading" | "booting" | "running" | "error";

/** Boot progress surfaced to the status bar (0-100, monospaced label). */
export interface SimProgress {
  value: number;
  label: string;
}

/** Visitor-facing status copy (the emulator's own wording is an implementation detail). */
const STATUS_MESSAGES: Record<Exclude<SimStatus, "running">, string> = {
  loading: "Loading Linux images, this may take a few minutes…",
  booting: "Booting Linux…",
  error: "Failed to boot the guest",
};

const INITIAL_PROGRESS: SimProgress = { value: 0, label: "Preparing download…" };

type Listener = (status: SimStatus, detail?: string, progress?: SimProgress) => void;

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
let progress: SimProgress = INITIAL_PROGRESS;
/** Called once when the guest reaches an interactive shell prompt. */
let readyCallback: (() => void) | null = null;
let announcedReady = false;
/** Called after the guest's welcome README has finished printing. */
let readmeCompleteCallback: (() => void) | null = null;
let awaitingReadmeCompletion = false;
/** Called once the guest is serving HTTP on port 80. */
let servedCallback: (() => void) | null = null;
let announcedServed = false;
let emulatorRef: SimVm["emulator"] | null = null;
const listeners = new Set<Listener>();
const SNAPSHOT_DB = "lam-linux-sim";
const SNAPSHOT_STORE = "snapshots";
// Bump this whenever provisioning changes so stale snapshots re-provision
// instead of resuming without the new files.
const SNAPSHOT_KEY = "buildroot-bzimage68-v8";
const SNAPSHOT_INTERVAL_MS = 60_000;
const COMMAND_SNAPSHOT_DELAY_MS = 250;
const COMMAND_SNAPSHOT_MIN_INTERVAL_MS = 5_000;
let snapshotInFlight = false;
let lastSnapshotStartedAt = 0;
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
  const emulator = emulatorRef as Partial<StatefulEmulator> | null;
  if (!emulator || !announcedReady || snapshotInFlight || typeof emulator.save_state !== "function") return;
  snapshotInFlight = true;
  lastSnapshotStartedAt = Date.now();
  emulator.save_state((error, state) => {
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
  if (next === "running") {
    progress = { value: 100, label: "Ready" };
  }
  for (const listener of listeners) listener(next, nextDetail, progress);
}

function emitProgress(next: SimProgress) {
  progress = {
    value: Math.max(0, Math.min(100, Math.round(next.value))),
    label: next.label,
  };
  for (const listener of listeners) listener(status, detail, progress);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fetch a URL while reporting byte progress. Falls back to a plain
 * `arrayBuffer()` when streaming is unavailable (e.g. jsdom tests).
 */
async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : NaN;
  const knownTotal = Number.isFinite(total) && total > 0 ? total : null;
  if (!res.body?.getReader) {
    const buf = await res.arrayBuffer();
    onProgress(buf.byteLength, knownTotal ?? buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, knownTotal);
    }
  }
  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(loaded, knownTotal ?? loaded);
  return merged.buffer as ArrayBuffer;
}

/**
 * Download several URLs in parallel, aggregating byte progress. When servers
 * omit `content-length` the fraction falls back to completed-file counting.
 */
async function downloadMany(
  urls: string[],
  onProgress: (fraction: number, loaded: number, total: number | null) => void,
): Promise<ArrayBuffer[]> {
  const loadedBytes = new Array<number>(urls.length).fill(0);
  const totalBytes = new Array<number | null>(urls.length).fill(null);
  const report = () => {
    const loaded = loadedBytes.reduce((sum, n) => sum + n, 0);
    const known = totalBytes.every((n): n is number => typeof n === "number");
    if (known) {
      const total = totalBytes.reduce((sum, n) => sum + (n as number), 0);
      onProgress(total > 0 ? loaded / total : 0, loaded, total);
    } else {
      const done = loadedBytes.filter((n, i) => totalBytes[i] !== null && n >= (totalBytes[i] as number)).length;
      onProgress(done / urls.length, loaded, null);
    }
  };
  const results = await Promise.all(
    urls.map((url, index) =>
      fetchWithProgress(url, (loaded, total) => {
        loadedBytes[index] = loaded;
        totalBytes[index] = total;
        report();
      }),
    ),
  );
  onProgress(1, loadedBytes.reduce((sum, n) => sum + n, 0), totalBytes.every((n): n is number => typeof n === "number") ? (totalBytes as number[]).reduce((sum, n) => sum + n, 0) : null);
  return results;
}

/**
 * v86 boot assets served from `/sim/*`. Prefetching them here warms the HTTP
 * cache (so v86's own fetch hits cache) and — more importantly — gives the
 * progress bar real bytes to report instead of a spinner.
 */
const BOOT_ASSETS = [
  { url: "/sim/libv86.js", name: "emulator runtime" },
  { url: "/sim/v86.wasm", name: "wasm engine" },
  { url: "/sim/seabios.bin", name: "bios" },
  { url: "/sim/vgabios.bin", name: "vga bios" },
  { url: "/sim/buildroot-bzimage68.bin", name: "linux kernel" },
] as const;

/** Prefetch boot assets; never throws — v86 will fetch directly on failure. */
async function prefetchBootAssets(): Promise<void> {
  emitProgress({ value: 1, label: `Downloading ${BOOT_ASSETS[0].name}…` });
  try {
    await downloadMany(
      BOOT_ASSETS.map((a) => a.url),
      (fraction, loaded, total) => {
        // Download phase owns 0–60% of the bar; boot + provision own the rest.
        const value = 1 + fraction * 59;
        const size = total !== null ? ` · ${formatBytes(loaded)} / ${formatBytes(total)}` : loaded > 0 ? ` · ${formatBytes(loaded)}` : "";
        emitProgress({ value, label: `Downloading Linux images…${size}` });
      },
    );
  } catch {
    // Slow/flaky networks still boot: v86 fetches the same URLs itself.
    emitProgress({ value: 60, label: "Starting emulator…" });
  }
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
 * The static build of @lam/finder (produced by `pnpm build:guest`) that the
 * guest serves. Every file is pushed through the 9p share, so adding an asset
 * to the bundle only requires an entry here.
 *
 * Served from `/guest-app/*` rather than `/guest/*`: the latter is the service
 * worker's proxy prefix, which would intercept these fetches and route them
 * back into the guest before the files have been pushed.
 */
export const GUEST_BUNDLE_BASE = "/guest-app";
export const GUEST_BUNDLE_FILES = ["index.html", "assets/app.js", "assets/style.css"] as const;

/** Push the static HTTP server and the web app into the guest (9p share),
 * then start serving on port 80. The stock image ships no httpd, so we hand
 * it a static i686 busybox. */
async function provisionGuest(
  emulator: SimVm["emulator"],
  write: (text: string) => void,
): Promise<void> {
  try {
    emitProgress({ value: 86, label: "Installing guest tools…" });
    const urls = [
      "/sim/busybox-i686",
      "/footer.txt",
      "/readme.txt",
      ...GUEST_BUNDLE_FILES.map((file) => `${GUEST_BUNDLE_BASE}/${file}`),
    ];
    const [busyboxBuf, footerBuf, readmeBuf, ...bundleBufs] = await downloadMany(
      urls,
      (fraction, loaded, total) => {
        // Provision phase owns 85–97% of the bar.
        const value = 85 + fraction * 12;
        const size = total !== null ? ` · ${formatBytes(loaded)} / ${formatBytes(total)}` : loaded > 0 ? ` · ${formatBytes(loaded)}` : "";
        emitProgress({ value, label: `Installing guest tools…${size}` });
      },
    );
    const decoder = new TextDecoder();
    const busybox = busyboxBuf;
    const footer = decoder.decode(footerBuf);
    const readme = decoder.decode(readmeBuf);
    const bundle = bundleBufs;

    // Every file must be in the 9p share *before* the guest mounts it. The
    // guest caches the directory listing at mount time, so files written
    // afterwards never show up in /mnt — the mount has to be the last step.
    await emulator.create_file("/busybox", new Uint8Array(busybox));
    // Each bundle file lands at a flat "/guest-<name>" slot on the 9p share;
    // the guest copies them into /www with the right sub-directories.
    for (let index = 0; index < GUEST_BUNDLE_FILES.length; index += 1) {
      const flat = GUEST_BUNDLE_FILES[index].replace("/", "-");
      await emulator.create_file(`/guest-${flat}`, new Uint8Array(bundle[index]));
    }
    await emulator.create_file("/footer.txt", new TextEncoder().encode(footer));
    await emulator.create_file("/readme.txt", new TextEncoder().encode(readme));
    write(`\r\n[host] pushed busybox (${Math.round(busybox.byteLength / 1024)} KiB) + ${GUEST_BUNDLE_FILES.length}-file web app + footer.txt + readme.txt to the 9p share\r\n`);

    emulator.serial0_send(
      [
        "mkdir -p /www/assets /opt",
        // Mount only now, so the guest sees all the files above.
        "ifconfig eth0 up",
        "udhcpc -i eth0 -n -q -t 8 >/dev/null 2>&1",
        "mkdir -p /mnt",
        "mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt 2>/dev/null || mount -t 9p host9p /mnt 2>/dev/null",
        // busybox only treats argv[1] as the applet when it is invoked as
        // "busybox", so it must be installed under that exact name.
        "cp /mnt/busybox /opt/busybox && chmod +x /opt/busybox",
        "cp /mnt/footer.txt ~/footer.txt",
        "cp /mnt/readme.txt ~/readme.txt",
        ...GUEST_BUNDLE_FILES.map(
          (file) => `cp /mnt/guest-${file.replace("/", "-")} /www/${file}`,
        ),
        "/opt/busybox httpd -h /www -p 80",
        "echo '[guest] httpd listening on :80'",
        "",
      ].join("\n"),
    );

    // Wait until the guest actually accepts connections, then hand control to
    // the window that shows the guest-served page.
    emitProgress({ value: 97, label: "Starting guest web server…" });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await probeGuest(emulator as never)) {
        write("[host] guest httpd is reachable on :80\r\n");
        emitProgress({ value: 99, label: "Almost there…" });
        announcedServed = true;
        servedCallback?.();
        saveSnapshot();
        // Boot is fully done: greet the visitor with the README, the way a
        // freshly provisioned box would.
        // The record separator is intercepted below. It arrives only after
        // `cat` has written every README byte to the serial stream.
        awaitingReadmeCompletion = true;
        emulator.serial0_send("clear; cat ~/readme.txt; printf '\\x1e'\n");
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
    // Warm the HTTP cache with real byte progress before v86 fetches the
    // same URLs itself (its internal loader reports no progress). Restored
    // snapshots skip the multi-MB kernel download entirely.
    if (!initialState) {
      await prefetchBootAssets();
    } else {
      emitProgress({ value: 60, label: "Restoring saved session…" });
    }
    emitProgress({ value: 62, label: "Starting emulator…" });
    // The terminal library still has to load, while the guest starts booting
    // as soon as the emulator is ready. Ease the bar toward 85% meanwhile so
    // a slow boot never looks stuck.
    let eased = 62;
    const easeTimer = setInterval(() => {
      if (announcedReady || eased >= 84) {
        clearInterval(easeTimer);
        return;
      }
      eased += 1;
      emitProgress({
        value: eased,
        label: status === "booting" ? "Booting Linux…" : "Starting emulator…",
      });
    }, 600);
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
    let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

    // Serial arrives byte by byte. Decode the live stream as UTF-8 (streaming
    // so multi-byte characters split across events are handled) instead of
    // mapping each byte to a Latin-1 char, which mangled non-ASCII output such
    // as the "©" in ~/footer.txt.
    const liveDecoder = new TextDecoder("utf-8");

    const rawLog: string[] = [];
    if (typeof window !== "undefined") {
      (window as unknown as { __lamSerialLog?: string[] }).__lamSerialLog = rawLog;
    }

    emulator.add_listener("serial0-output-byte", (byte) => {
      if (byte === 30 && awaitingReadmeCompletion) {
        awaitingReadmeCompletion = false;
        // Give xterm a frame to flush the final README bytes before hiding.
        window.setTimeout(() => readmeCompleteCallback?.(), 100);
        return;
      }
      const char = String.fromCharCode(byte);
      if (terminalWrite) terminalWrite(liveDecoder.decode(new Uint8Array([byte]), { stream: true }));
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
      const atPrompt = /(\/root%|~%)\s*$/.test(tail);
      if (!announcedReady && atPrompt) {
        announcedReady = true;
        clearInterval(easeTimer);
        emitProgress({ value: 85, label: "Shell ready — installing guest tools…" });
        if (mirror !== null) {
          clearInterval(mirror);
          mirror = null;
        }
        readyCallback?.();
        void provisionGuest(emulator, writeOut);
      } else if (announcedReady && atPrompt) {
        // A new prompt means the preceding command completed, including writes
        // to the ramdisk. Snapshot then, rather than relying on page teardown,
        // but never serialize the full VM more than once every five seconds.
        if (snapshotTimer) clearTimeout(snapshotTimer);
        const elapsed = Date.now() - lastSnapshotStartedAt;
        const delay = Math.max(
          COMMAND_SNAPSHOT_DELAY_MS,
          COMMAND_SNAPSHOT_MIN_INTERVAL_MS - elapsed,
        );
        snapshotTimer = setTimeout(saveSnapshot, delay);
      }
    });

    emulator.add_listener("emulator-ready", () => {
      emit("booting");
      emitProgress({ value: Math.max(progress.value, 68), label: "Booting Linux…" });
      refit?.();
    });
    emulator.add_listener("emulator-started", () => {
      clearInterval(easeTimer);
      emit("running");
      refit?.();
      if (initialState) {
        announcedReady = true;
        announcedServed = true;
        readyCallback?.();
        readmeCompleteCallback?.();
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
  onReadmeComplete,
  onServed,
}: { onReady?: () => void; onReadmeComplete?: () => void; onServed?: () => void } = {}) {
  const slot = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<SimStatus>(status);
  const [currentDetail, setCurrentDetail] = useState<string | undefined>(detail);
  const [bootProgress, setBootProgress] = useState<SimProgress>(progress);

  useEffect(() => {
    readyCallback = onReady ?? null;
    readmeCompleteCallback = onReadmeComplete ?? null;
    servedCallback = onServed ?? null;
    const listener: Listener = (next, nextDetail, nextProgress) => {
      setCurrent(next);
      setCurrentDetail(nextDetail);
      if (nextProgress) setBootProgress({ ...nextProgress });
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
      {/* Boot progress: determinate bar with byte counts while downloading,
          easing through boot/provision; hidden once the guest is up so the
          terminal owns the full window. */}
      {current !== "running" && (
        <div className="sim-boot" role="status" aria-label="Simulator loading progress">
          <div className="sim-statusbar">
            <span className="sim-status-dot" data-state={current} aria-hidden />
            <span className="sim-boot-message">
              {STATUS_MESSAGES[current]}
              {currentDetail ? ` — ${currentDetail}` : ""}
            </span>
            <span className="sim-boot-percent" aria-hidden>
              {current === "error" ? "" : `${bootProgress.value}%`}
            </span>
          </div>
          {current !== "error" && (
            <>
              <Progress
                value={bootProgress.value}
                className="sim-boot-bar"
                aria-label={bootProgress.label}
              />
              <div className="sim-boot-label">{bootProgress.label}</div>
            </>
          )}
        </div>
      )}
      <div className="sim-slot" ref={slot} />
    </div>
  );
}
