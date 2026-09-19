/**
 * @lam/sim-vm — v86 integration layer.
 *
 * Boots a Linux guest in the browser and exposes the pieces the app needs:
 * - a VGA `screen` container (optional; rendered by the caller with v86's
 *   expected structure: a `white-space: pre` div followed by a `<canvas>`),
 * - a serial console the caller can drive directly (used for the terminal),
 * - a manifest-driven boot config: by default a prebuilt `bzImage` + ext2
 *   ramdisk are booted directly with `console=ttyS0`, so kernel output and the
 *   shell share one serial stream.
 *
 * Targets (CI-enforced elsewhere): total download <= 10MB, cold boot to
 * first HTTP 200 <= 5s (excluding network transfer time).
 *
 * The v86 **UMD build** is loaded at runtime via a `<script>` tag instead of
 * being bundled: the ESM build contains Node-only `require("fs")` /
 * `require("perf_hooks")` calls that bundlers statically resolve and fail on.
 */
import type { V86 as V86Instance, V86Options } from "v86";

export const DEFAULT_ASSET_BASE_URL = "/sim";

type V86Constructor = new (options: V86Options) => V86Instance;

declare global {
  interface Window {
    V86?: V86Constructor;
  }
}

/** How the guest is booted. */
export type SimBootConfig =
  | {
      /** Boot a bootable ISO via the emulated BIOS (placeholder path). */
      mode: "cdrom";
      iso: string;
    }
  | {
      /** BIOS-less direct Linux kernel boot (final path). */
      mode: "bzimage";
      bzImage: string;
      initrd?: string;
      cmdline?: string;
    };

export interface SimAssets {
  /** Base URL where the v86 runtime, BIOS and boot images are served. */
  assetBaseUrl: string;
  /** v86 UMD script (`libv86.js`). */
  script: string;
  /** v86 wasm module (the `-fallback.wasm` sibling is derived automatically). */
  wasm: string;
  bios: string;
  vgaBios: string;
}

export interface SimMount {
  /** VGA screen container (see module docs for the required child structure). */
  screen?: HTMLElement | null;
  /** Element that receives serial output / sends serial input. */
  serial?: HTMLTextAreaElement | null;
}

export interface SimOptions {
  assets?: Partial<SimAssets>;
  boot?: SimBootConfig;
  /** Guest RAM in bytes. */
  memorySize?: number;
  /** VGA memory in bytes. */
  vgaMemorySize?: number;
  /** Start emulation immediately after construction. Defaults to `true`. */
  autostart?: boolean;
}

export interface SimVm {
  emulator: V86Instance;
  destroy(): Promise<void>;
}

/**
 * Default kernel command line.
 *
 * `console=ttyS0` sends the kernel boot log to the serial port as well, so a
 * single terminal shows the whole session (boot + shell). The guest's root
 * filesystem is an ext2 ramdisk, hence `load_ramdisk=1` / `root=/dev/ram0`.
 */
export const DEFAULT_CMDLINE =
  "root=/dev/ram0 rw load_ramdisk=1 prompt_ramdisk=0 ramdisk_size=8192 console=ttyS0,115200 console=tty0 loglevel=7";

/** Boot a kernel image directly (no BIOS, no CD). */
export function defaultBootConfig(base: string = DEFAULT_ASSET_BASE_URL): SimBootConfig {
  return {
    mode: "bzimage",
    bzImage: `${base}/bzImage`,
    initrd: `${base}/root.bin`,
    cmdline: DEFAULT_CMDLINE,
  };
}

function resolveAssets(options: SimOptions): SimAssets {
  const base = (options.assets?.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL).replace(/\/$/, "");
  return {
    assetBaseUrl: base,
    script: options.assets?.script ?? `${base}/libv86.js`,
    wasm: options.assets?.wasm ?? `${base}/v86.wasm`,
    bios: options.assets?.bios ?? `${base}/seabios.bin`,
    vgaBios: options.assets?.vgaBios ?? `${base}/vgabios.bin`,
  };
}

let v86Loader: Promise<V86Constructor> | null = null;

/** Inject the v86 UMD script once and resolve its global constructor. */
function loadV86(url: string): Promise<V86Constructor> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("v86 can only be loaded in the browser"));
  }
  if (window.V86) return Promise.resolve(window.V86);
  if (v86Loader) return v86Loader;

  v86Loader = new Promise<V86Constructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.lamV86 = "1";
    script.addEventListener("load", () => {
      if (window.V86) resolve(window.V86);
      else reject(new Error("v86 script loaded but window.V86 is undefined"));
    });
    script.addEventListener("error", () => {
      v86Loader = null;
      reject(new Error(`failed to load ${url}`));
    });
    document.head.appendChild(script);
  });

  return v86Loader;
}

/**
 * Create and (by default) start a v86 instance.
 *
 * Async because the v86 UMD script is fetched on first use; the `v86` ESM
 * build is deliberately not bundled (see module docs).
 */
export async function createSimVm(mount: SimMount = {}, options: SimOptions = {}): Promise<SimVm> {
  const assets = resolveAssets(options);
  const boot = options.boot ?? defaultBootConfig(assets.assetBaseUrl);

  const V86Ctor = await loadV86(assets.script);

  const v86Options: V86Options = {
    wasm_path: assets.wasm,
    memory_size: options.memorySize ?? 128 * 1024 * 1024,
    vga_memory_size: options.vgaMemorySize ?? 8 * 1024 * 1024,
    // The public v86 class delegates to an internal instance that only exists
    // after the wasm has loaded asynchronously. Calling `run()` right after
    // construction throws; let v86 start itself once ready (as the official
    // examples do) instead of driving `run()` ourselves.
    autostart: options.autostart !== false,
    bios: { url: assets.bios },
    vga_bios: { url: assets.vgaBios },
  };

  if (mount.screen) v86Options.screen = { container: mount.screen };
  if (mount.serial) v86Options.serial_console = { type: "textarea", container: mount.serial };

  if (boot.mode === "cdrom") {
    // Load synchronously (full download) so static hosts without HTTP Range
    // support still work.
    v86Options.cdrom = { url: boot.iso, async: false };
  } else {
    v86Options.bzimage = { url: boot.bzImage, async: false };
    if (boot.initrd) v86Options.initrd = { url: boot.initrd, async: false };
    if (boot.cmdline) v86Options.cmdline = boot.cmdline;
  }

  const emulator = new V86Ctor(v86Options);

  return {
    emulator,
    async destroy() {
      try {
        await emulator.destroy();
      } catch {
        // destroy() is best-effort; a failed teardown must not break unmount.
      }
    },
  };
}
