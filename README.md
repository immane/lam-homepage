# lam-homepage · Matrix GitHub Showcase

Immersive Matrix-themed GitHub portfolio — live GitHub data, multi-window repository preview, draggable / resizable / minimizable Hacker Terminal experience.

<p>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TS" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Matrix-%2300ff41-001a0d" alt="Matrix" />
</p>

<p>
  <a href="https://github.com/immane/lam-homepage">GitHub</a> · <a href="#live-preview">Live Preview</a> · <a href="#features">Features</a> · <a href="#quick-start">Quick Start</a>
</p>

---

## Live Preview

`app/page.tsx` is a single-page immersive home: Matrix rain + scanlines + glitch text + typing effect + project cards + repository preview windows.

- Local: `http://localhost:3000`
- Production: auto-deploy on merge to `main` via Vercel

Tip: Click any `ProjectCard` to open a repository preview in a multi-window layer. Windows are draggable, resizable, minimizable and support inactive state. Opening the same URL again focuses the existing window instead of duplicating it.

---

## Features

| Area | Highlights |
|---|---|
| Hero / Visual | `MatrixRain` (WebGL primary, Canvas fallback), `GlitchText`, `TypingText`, scanline, cursor pulse, frosted cards |
| GitHub Data | `/api/github` aggregates `users/immane`, repositories, Pinned (GraphQL with HTML scraping fallback), language count / total stars / account creation year, SWR 60s cache + `stale-while-revalidate` |
| Project Showcase | Pinned first + All Projects sorted by stars / updated time, `ProjectCard` terminal header with single red dot, hover scanline, language color dot |
| Tech Stack | `TechStack` grid for commonly used stack |
| Window System | `WebWindow` multi-instance, draggable (header grab, viewport clamp, rAF direct `transform`), resizable (8 handles, edge-compensated, min 360x280), maximizable (double-click header), minimizable to bottom Dock (stacked at `z230`), inactive state (`inactive` 0.78 opacity, click empty to deactivate, click window to focus and raise `z`), no re-center on resize, first-window `perspective` centering fix, cascade offset `32x28` |
| Repository Browser | `RepositoryBrowser`: `react-resizable-panels` split, `contents` API listing, breadcrumb, `README` priority, `mermaid` dark theme, `CodePreview` (PrismLight + line numbers + Matrix theme), image raw `?raw=1` |
| UX Details | Persistent scrollbar `scrollbar-gutter: stable` prevents layout shift, solid window on mobile to avoid haze, title/path bars `z-index` pinned above content, `contain: layout paint` + `will-change` perf, `backdrop-filter:none` while dragging |

---

## Tech Stack

- Framework: Next.js 16 (App Router + Turbopack), React 19, TypeScript 5
- Styling: Tailwind CSS 4 + `tw-animate-css` + custom `oklch` Matrix theme
- Data: `swr` + GitHub REST / GraphQL + HTML fallback
- UI: Radix UI, `lucide-react`, `sonner`, `vaul`, `embla-carousel`, etc.
- Code / Markdown: `react-markdown` + `remark-gfm` + `react-syntax-highlighter` (PrismLight) + `mermaid` 11
- Layout: `react-resizable-panels`, `next-themes`, `@vercel/analytics`

---

## Project Structure

```
app/
  page.tsx                # Single-page home + multi-window manager (windows/activeId/nextZ)
  globals.css             # Matrix theme, window/dock/resize/mobile styles
  layout.tsx
  api/
    github/route.ts       # Aggregates user/repos/pinned/stats, 60s cache
    github/[owner]/[repo]/contents/route.ts # Directory/file preview, 1MB limit, raw redirect
components/
  web-window.tsx          # Multi-window: drag (rAF), resize, maximize/minimize, inactive, cascade
  repository-browser.tsx  # File tree + preview (memo + useCallback)
  code-preview.tsx        # Prism highlight (memo)
  markdown-preview.tsx    # Markdown + Mermaid (memo)
  matrix-rain.tsx         # WebGL rain (throttled on mobile, paused when hidden)
  glitch-text.tsx / typing-text.tsx / project-card.tsx / tech-stack.tsx
```

---

## Quick Start

```bash
# 1. Install
npm install
# or pnpm install / yarn

# 2. Configure (optional, raises GitHub rate limit)
echo "GITHUB_TOKEN=ghp_xxx" > .env.local
# Without token, uses public API + HTML scraping with lower rate limit

# 3. Develop
npm run dev
# http://localhost:3000

# 4. Build
npm run build && npm run start
```

GitHub Token only needs `public_repo` read permission for GraphQL Pinned and higher REST limits. Without it, `fetchPinnedReposFromHTML` falls back to scraping.

---

## API

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/github` | GET | Returns `{user, repos[], stats}`, `repos` sorted pinned first + stars/updated, `Cache-Control: private, max-age=60, stale-while-revalidate=300` |
| `GET /api/github/[owner]/[repo]/contents?path=&raw=1` | GET | Directory `{kind:"directory", entries[]}` or file `{kind:"file", content, canPreview}`; `size>1MB` or binary gives `canPreview=false`; `raw=1` 302 redirects to `download_url`; Cache 900s |

---

## Window System Contract

- **Multi-open** `openPreview(url)` deduplicates: same `url` focuses existing window, no duplicate.
- **Stacking** Each window has independent `z`, `focus` sets `z = nextZ++`, `activeId` controls `web-window-active / inactive`.
- **Drag** Header `pointerdown` (excluding buttons/links) -> `setPointerCapture` -> rAF direct `transform: translate(calc(-50%+x), calc(-50%+y))`, `pointerup` syncs React `pos`, `web-window-moved` disables entrance animation.
- **Resize** 8 handles, `w/n` keep opposite edge (e.g. `newLeft = startLeft + dx`), size clamp `MIN 360x280` to `vw-32`, only `size/pos` updated, no re-center.
- **Minimize** Controlled `minimized`, Dock stacked at `bottom:16+idx*56`, `z230` on top; clicking empty layer `deactivateAll` only deactivates, does not close.
- **Mobile** Window `background: var(--card); backdrop-filter:none; animation:none` for crisp rendering, title/path bars solid.

---

## Responsive & Performance

- `html/body { scrollbar-gutter: stable; overflow-y: scroll }` keeps scrollbar visible, no layout shift on popup.
- `contain: layout paint; will-change: transform` + `backdrop-filter:none` while dragging/resizing.
- `MatrixRain` column width `22px`, paused when `document.hidden`, frame-skipped on mobile.
- `RepositoryBrowser` / `CodePreview` / `MarkdownPreview` are `memo` + `useCallback/useMemo`, images `loading=lazy`, `content-visibility:auto`.

---

## Customization

- **User** Change `username = "immane"` in `app/api/github/route.ts:177`.
- **Theme** Adjust `oklch` variables (`--primary`, `--matrix-green`, etc.) in `app/globals.css:7`.
- **Window defaults** `MIN_W/MIN_H` in `components/web-window.tsx:22` and `min(80vw,1440px)` in `app/globals.css:222`.
- **Cascade offset** `stagger*32/28` in `app/page.tsx:184`.

---

## Deployment

- Import to Vercel for auto-deploy on `main`, or deploy `npm run build` output to any Node 18+ environment.
- Set `GITHUB_TOKEN` in Vercel Dashboard environment variables.

---

## License

MIT — Free for personal portfolio use, please credit Matrix style and window interactions if reused.

Built with lots of coffee · Matrix forever
