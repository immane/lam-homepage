/**
 * @lam/sim-vm — v86 integration layer.
 *
 * Responsibility (not implemented yet):
 * - Boot a BIOS-less i686 bzImage + initramfs.xz inside v86 (same instance
 *   shared by the screen window and the serial shell window).
 * - Bridge `serial0` <-> xterm.js (raw termios, resize -> `stty rows/cols`).
 * - Expose VGA (screen0) to the sim window.
 * - Load artifact manifest (kernel / initramfs / wasm) with size + boot budgets.
 *
 * Target budgets: total download <= 10MB, cold boot to HTTP 200 <= 5s
 * (excluding network transfer time).
 */
export {};
