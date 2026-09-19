/**
 * Global body scroll lock with reference-counted holders.
 *
 * Why not simple save/restore pairing? Pairing breaks when effect cleanups
 * are skipped or run out of order (observed in production: closing a window
 * while the markdown lightbox was involved left `overflow: hidden` stuck).
 * Instead every sync point first sheds its own hold and then (re-)acquires
 * if needed, so state always converges to the truth — missed cleanups and
 * stale captured values are impossible by construction.
 *
 * Hiding the scrollbar widens the viewport by the scrollbar width; measure
 * the actual difference and compensate with padding-right so content does
 * not shift. On overlay scrollbars (or where `scrollbar-gutter` applies)
 * the delta is 0 and this is a no-op.
 */

const holders = new Set<string>();

function applyLockedStyles() {
  const before = document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  // Reading clientWidth forces layout, so `delta` is measured post-lock.
  const delta = document.documentElement.clientWidth - before;
  if (delta > 0) {
    document.body.style.paddingRight = `${delta}px`;
  }
}

function clearLockedStyles() {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
}

export function acquireBodyLock(key: string) {
  holders.add(key);
  applyLockedStyles();
}

export function releaseBodyLock(key: string) {
  holders.delete(key);
  if (holders.size === 0) {
    clearLockedStyles();
  }
}
