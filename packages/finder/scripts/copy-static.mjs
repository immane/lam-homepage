#!/usr/bin/env node
/**
 * Copy the static Finder build into the host's public directory so the
 * provisioning step can push it into the guest (9p share -> /www).
 *
 * Usage: node scripts/copy-static.mjs [targetDir]
 * Default target: <repo>/apps/web/public/guest-app
 */
import { cp, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const repoRoot = path.resolve(pkgRoot, "..", "..");

const distDir = path.join(pkgRoot, "dist");
const targetDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "apps", "web", "public", "guest-app");

async function main() {
  // Fail loudly rather than shipping an empty directory.
  const entries = await readdir(distDir).catch(() => null);
  if (!entries || !entries.includes("index.html")) {
    throw new Error(`no static build at ${distDir}; run \`vite build\` first`);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(distDir, targetDir, { recursive: true });

  console.log(`copy-static ${distDir} -> ${targetDir}`);
  console.log(`  files: ${entries.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
