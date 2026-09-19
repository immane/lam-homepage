/**
 * Lock body scrolling without causing layout shift.
 *
 * Hiding the scrollbar widens the viewport by the scrollbar width, which
 * shifts page content. `scrollbar-gutter: stable` covers this in supporting
 * browsers, but not everywhere (e.g. older Safari), so measure the actual
 * difference after locking and compensate with padding-right. On overlay
 * scrollbars or with gutter support the delta is 0 and this is a no-op.
 *
 * Returns an unlock function that restores the previous inline values
 * (safe to nest: inner locks restore the outer lock state, not "").
 */
export function lockBodyScroll(): () => void {
  const body = document.body;
  const prevOverflow = body.style.overflow;
  const prevPaddingRight = body.style.paddingRight;
  const before = document.documentElement.clientWidth;
  body.style.overflow = "hidden";
  // Reading clientWidth forces layout, so `delta` is measured post-lock.
  const delta = document.documentElement.clientWidth - before;
  if (delta > 0) {
    body.style.paddingRight = `${delta}px`;
  }
  return () => {
    body.style.overflow = prevOverflow;
    body.style.paddingRight = prevPaddingRight;
  };
}
