#!/usr/bin/env node
/**
 * Sync the runtime assets v86 needs into a static-served directory.
 *
 * - Copies `libv86.js` (UMD) and the wasm modules from the installed v86
 *   package (exact version match with the library matters).
 * - Downloads SeaBIOS/VGA BIOS if missing.
 * - Derives `bzImage` + `root.bin` (the ext2 root ramdisk) from the upstream
 *   Linux ISO, which is downloaded, unpacked and then removed.
 *
 * Usage: node scripts/sync-assets.mjs [targetDir]
 * Default target: <repo>/apps/web/public/sim
 */
import { createRequire } from "node:module";
import { mkdir, copyFile, access, stat, rm, readdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const targetDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "apps", "web", "public", "sim");

const require = createRequire(import.meta.url);
const v86Dir = path.dirname(require.resolve("v86/package.json"));
const v86Build = path.join(v86Dir, "build");

/** Files copied verbatim from the v86 package. */
const LOCAL_FILES = ["libv86.js", "v86.wasm", "v86-fallback.wasm"];

/** Files fetched from the upstream v86 demo host (same origin there; we self-host). */
const REMOTE_FILES = {
  "seabios.bin": "https://copy.sh/v86/bios/seabios.bin",
  "vgabios.bin": "https://copy.sh/v86/bios/vgabios.bin",
};

/** Linux image: the kernel and root ramdisk are extracted from this ISO. */
const LINUX_ISO_URL = "https://copy.sh/v86/images/linux.iso";
const DERIVED_FILES = {
  bzImage: "BZIMAGE",
  "root.bin": "ROOT.BIN",
};

/**
 * The stock image has no httpd, so the guest is handed a static i686 busybox.
 * Debian's `busybox-static` is a full multi-call binary (httpd included) and
 * statically linked, which is what a bare Buildroot rootfs needs.
 */
const BUSYBOX_DEB_URL =
  "https://deb.debian.org/debian/pool/main/b/busybox/busybox-static_1.38.0-3+b1_i386.deb";
const BUSYBOX_MEMBER = "usr/bin/busybox";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  process.stdout.write(`  download ${url}\n`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const { size } = await stat(dest);
  if (size < 1024) throw new Error(`suspiciously small download: ${dest} (${size} bytes)`);
}

/** Extract specific members from an archive (ISO, .deb, tar) with bsdtar or 7z. */
async function extractFromIso(isoPath, members, outDir) {
  const attempts = [
    { bin: "bsdtar", args: ["-xf", isoPath, "-C", outDir, ...members] },
    { bin: "7z", args: ["x", "-y", `-o${outDir}`, isoPath, ...members] },
  ];
  for (const attempt of attempts) {
    try {
      await execFileAsync(attempt.bin, attempt.args);
      return;
    } catch (error) {
      if (error && error.code === "ENOENT") continue; // tool not installed
      throw error;
    }
  }
  throw new Error(
    "need `bsdtar` (libarchive) or `7z` to unpack downloaded images; install one and re-run",
  );
}

/** Unpack a nested archive (e.g. data.tar.xz inside a .deb). */
async function extractTree(archivePath, outDir, member) {
  const attempts = [
    { bin: "bsdtar", args: ["-xf", archivePath, "-C", outDir, ...(member ? [member] : [])] },
    { bin: "7z", args: ["x", "-y", `-o${outDir}`, archivePath, ...(member ? [member] : [])] },
  ];
  for (const attempt of attempts) {
    try {
      await execFileAsync(attempt.bin, attempt.args);
      return;
    } catch (error) {
      if (error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  throw new Error("need `bsdtar` or `7z` to unpack the busybox package");
}

/** Download Debian's static i386 busybox (the guest's httpd). */
async function ensureBusybox() {
  const dest = path.join(targetDir, "busybox-i686");
  if (await exists(dest)) {
    console.log("  exists   busybox-i686");
    return;
  }

  const work = path.join(os.tmpdir(), `lam-busybox-${Date.now()}`);
  await mkdir(work, { recursive: true });
  try {
    const deb = path.join(work, "busybox.deb");
    await download(BUSYBOX_DEB_URL, deb);
    await extractTree(deb, work, "data.tar.xz");
    await extractTree(path.join(work, "data.tar.xz"), work, `./${BUSYBOX_MEMBER}`);
    await copyFile(path.join(work, BUSYBOX_MEMBER), dest);
    console.log(`  extract  ${BUSYBOX_MEMBER} -> busybox-i686`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Locate an extracted member regardless of the tool's directory layout. */
async function findMember(dir, name) {
  const wanted = name.toUpperCase();
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toUpperCase() === wanted) {
      return path.join(entry.parentPath ?? entry.path, entry.name);
    }
  }
  return null;
}

async function main() {
  await mkdir(targetDir, { recursive: true });
  console.log(`sync-assets -> ${targetDir}`);

  for (const name of LOCAL_FILES) {
    await copyFile(path.join(v86Build, name), path.join(targetDir, name));
    console.log(`  copy     ${name}`);
  }

  for (const [name, url] of Object.entries(REMOTE_FILES)) {
    const dest = path.join(targetDir, name);
    if (await exists(dest)) {
      console.log(`  exists   ${name}`);
      continue;
    }
    await download(url, dest);
  }

  const stillMissing = [];
  for (const name of Object.keys(DERIVED_FILES)) {
    if (!(await exists(path.join(targetDir, name)))) stillMissing.push(name);
  }

  if (stillMissing.length > 0) {
    const work = path.join(os.tmpdir(), `lam-sim-iso-${Date.now()}`);
    await mkdir(work, { recursive: true });
    const isoPath = path.join(work, "linux.iso");
    try {
      await download(LINUX_ISO_URL, isoPath);
      await extractFromIso(isoPath, Object.values(DERIVED_FILES), work);
      for (const [dest, member] of Object.entries(DERIVED_FILES)) {
        const found = await findMember(work, member);
        if (!found) throw new Error(`member ${member} not found in ISO`);
        await copyFile(found, path.join(targetDir, dest));
        console.log(`  extract  ${member} -> ${dest}`);
      }
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  } else {
    console.log("  exists   bzImage, root.bin");
  }

  await ensureBusybox();

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
