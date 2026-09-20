/**
 * @lam/sim-relay — thin ws<->tcp proxy that exposes guest:80 as an
 * iframe-able URL (owns the `relay_url` consumed by @lam/sim-vm).
 *
 * Responsibility (not implemented yet):
 * - Accept the v86 ne2k WebSocket connection from the browser emulator.
 * - Bridge Ethernet frames to a TCP endpoint and publish the guest HTTP port
 *   as a rotatable, unguessable public path.
 * - Keep zero business logic (routing only) so it stays small and auditable.
 */
export {};
