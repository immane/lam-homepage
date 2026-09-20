/**
 * @lam/finder — a standalone, dependency-free Finder app.
 *
 * Renders the portfolio's GitHub projects as Finder "files": a sidebar with a
 * Projects section and a Tags section (languages, each with a coloured dot)
 * and a main grid of files. The project list is loaded dynamically at runtime
 * (`source`, default `/api/github`), so the same app can be mounted in the
 * host today and — pointed at the sim bridge — moved into the guest Linux
 * later.
 *
 * Styling lives in `@lam/finder/styles.css`; it reads the host theme custom
 * properties (with fallbacks) so it is portable.
 */
export { Finder, default } from "./finder";
export type { FinderProps, FinderProject } from "./finder";
export { languageColor, UNKNOWN_LANGUAGE_COLOR } from "./languages";
