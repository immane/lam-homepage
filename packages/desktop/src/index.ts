/**
 * @lam/desktop — content-agnostic window/desktop UI framework.
 *
 * Owns window chrome and behaviour (drag, resize, maximize, minimize, dock,
 * focus/z-order, Escape-to-close, body scroll lock). It knows nothing about
 * what a window contains: hosts supply the body via `renderContent`, chrome
 * labels via `label`/`address`/`icon`, and toolbar buttons via `actions`.
 *
 * Styling lives in `@lam/desktop/styles.css` and reads theme custom
 * properties (`--primary`, `--card`, `--border`, `--foreground`,
 * `--muted-foreground`, `--background`, `--font-mono`, `--radius-lg`) that the
 * host must provide.
 */
export { WebWindow } from "./window";
export type { WebWindowProps, WindowContentContext } from "./window";
export { useWindowManager } from "./window-manager";
export type {
  WindowDescriptor,
  OpenWindowInput,
  UseWindowManagerOptions,
} from "./window-manager";
export { acquireBodyLock, releaseBodyLock } from "./body-scroll-lock";
