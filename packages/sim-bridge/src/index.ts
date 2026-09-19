/**
 * @lam/sim-bridge — postMessage data RPC between the host page and the
 * embedded (iframe) static build running inside the guest VM.
 *
 * Responsibility (not implemented yet):
 * - Protocol: `{ type: "lam:github", id, path }` ->
 *   `{ type: "lam:github:result", id, ok, status, body }`.
 * - Client: used by the static build when `window.self !== window.top`;
 *   falls back to anonymous direct fetch when standalone.
 * - Host: mounted on the dynamic site; validates `event.source` against the
 *   sim iframe it owns, then calls the same-origin `/api/github*` routes
 *   (token stays server-side) and replies.
 * - Timeout + pending-map cleanup; JSON only (binaries stay on public URLs).
 */
export {};
