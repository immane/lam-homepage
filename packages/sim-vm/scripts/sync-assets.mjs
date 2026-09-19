#!/usr/bin/env node
/**
 * Sync the runtime assets v86 needs into a static-served directory.
 *
 * - Copies `v86.wasm` / `v86-fallback.wasm` from the installed v86 package
 *   (exact version match with the JS library matters).
 * - Downloads SeaBIOS/VGA BIOS and a bootable Linux image if missing.
 *
 * Usage: node scripts/sync-assets.mjs [targetDir]
 * Default target: <repo>/apps/web/public/sim
 */
import { createRequire } from "node:module";
import { mkdir, copyFile, access, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  // Placeholder bootable Linux; Phase 2 swaps this for our own bzImage+initramfs.
  "linux.iso": "https://copy.sh/v86/images/linux.iso",
};

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

async function main() {
  await mkdir(targetDir, { recursive: true });
  console.log(`sync-assets -> ${targetDir}`);

  for (const name of LOCAL_FILES) {
    const src = path.join(v86Build, name);
    const dest = path.join(targetDir, name);
    await copyFile(src, dest);
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

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
