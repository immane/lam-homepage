# @lam/linux — guest Linux for the in-browser simulator

Minimal i686 Linux that boots inside [v86](https://github.com/copy/v86) and
serves the static build of `apps/web` from inside the guest.

## Hard budgets (CI-enforced)

| Artifact | Budget | Notes |
|---|---|---|
| `libv86.js` | 0.34 MB | measured; ~0.1 MB brotli |
| `v86.wasm` | 2.0 MB | measured; fixed cost, trimmable devices later |
| `bzImage` (i686, ne2k, serial, no modules, XZ) | ≤ 3.0 MB | aggressive minimal config |
| `initramfs.xz` (busybox+vi, tcc, src, init) | ≤ 1.8 MB | already compressed |
| guest static site (served via relay, br) | ≤ 2.0 MB | second-stage load |
| **total download** | **≤ 10 MB** | raw |
| **cold boot → first `HTTP 200`** | **≤ 5 s** | excluding network transfer time |

## Boot-time levers (every item buys seconds)

1. BIOS-less boot — v86 loads `bzimage` + `initrd` directly (saves ~1 s).
2. Static IP on ne2k — **no DHCP** (avoids the timeout that blows the budget).
3. Kernel `quiet`, no modules, no udev, no fsck.
4. `initramfs` uses XZ; `www/` is **not** baked in (served via relay).
5. `/init` does only: mount proc/sys → configure net → spawn shell on
   `ttyS0` → build `server.c` → start server → print `httpd started`.

## Layout

```
linux/
├── kernel/     # minimal i686 config fragment + Docker-based build
├── rootfs/     # busybox config (shell + vi), /init, www/ (injected at build)
├── tools/      # tcc (i386) + src/server.c + build-server.sh
├── net/        # ne2k static-IP setup and relay wiring notes
└── images/     # build outputs (gitignored) + size/boot assertions
```

## Server role

`tools/src/server.c` is compiled **at runtime** by `tcc -static` and is the
primary static file server for `/www`. `busybox httpd` is the automatic
fallback if the build fails.

Shell workflow inside the guest:

```sh
vi server.c && build-server.sh && restart-server
```
