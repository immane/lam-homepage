# lam-homepage · Matrix GitHub Showcase

> 沉浸式 Matrix 风格的 GitHub 个人主页 — 实时拉取 GitHub 数据、多窗口沉浸式仓库预览、可拖拽/缩放/最小化的 Hacker Terminal 体验。

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TS" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Matrix-%2300ff41-001a0d" alt="Matrix" />
</p>

<p align="center">
  <a href="https://github.com/immane/lam-homepage">GitHub</a> · <a href="#-live-preview">Live Preview</a> · <a href="#-features">Features</a> · <a href="#-quick-start">Quick Start</a>
</p>

---

## ✨ Live Preview

> `app/page.tsx` 是单页沉浸式主页：Matrix 雨 + 扫描线 + 故障文字 + 打字机 + 作品卡片 + 仓库预览窗口。

- 本地：`http://localhost:3000`
- 线上：部署到 Vercel 后自动发布（`main` 分支）

> **Tip** 点击任意 `ProjectCard` 会以多窗口形式打开仓库预览；窗口可拖拽、缩放、最小化、失活，再次点击同 URL 会聚焦已打开的窗口而非 дублировать.

---

## 🎯 Features

| 域 | 亮点 |
|---|---|
| **Hero / 视觉** | `MatrixRain`（WebGL 优先，Canvas 回退）、`GlitchText`、`TypingText`、扫描线、光标脉冲、毛玻璃卡片 |
| **GitHub 数据** | `/api/github` 聚合 `users/immane`、仓库列表、Pinned（GraphQL → HTML 爬取回退）、语言数/总 Star/建号年份，SWR 60s 缓存 + `stale-while-revalidate` |
| **作品展示** | Pinned 置顶 + All Projects 按 Star/更新排序、`ProjectCard` 终端头部（单红点）、悬停扫描线、语言色点 |
| **TechStack** | `TechStack` 网格展示常用栈 |
| **窗口系统** | `WebWindow` 多实例、**可拖拽**（表头抓取、视口内 clamp、rAF 直写 `transform`）、**可缩放**（8 向手柄、边缘固定补偿、最小 360×280）、**可最大化**（双击表头）、**可最小化** 至底部 Dock（`z230` 堆叠）、**失活态**（`inactive` 0.78 透明、点击空白失活、点击窗口聚焦置顶 `z` 递增）、**不重置居中**、首窗入场 `perspective` 居中修正、级联偏移 `32×28` |
| **仓库浏览器** | `RepositoryBrowser`：`react-resizable-panels` 左右分栏、`contents` API 列表、面包屑、`README` 优先、`mermaid` 暗色主题渲染、`CodePreview`（PrismLight + 行号 + Matrix 主题）、图片直链 `?raw=1` |
| **体验细节** | 主滚动条常驻 `scrollbar-gutter: stable` 防跳动、移动端窗口实色无毛玻璃防朦胧、标题/路径栏 `z-index` 置顶覆盖、窗口 `contain: layout paint` + `will-change` 性能优化、拖拽时 `backdrop-filter:none` |

---

## 🧱 Tech Stack

- **Framework** Next.js 16 (App Router + Turbopack) · React 19 · TypeScript 5
- **Styling** Tailwind CSS 4 + `tw-animate-css` + 自定义 `oklch` Matrix 主题
- **Data** `swr` + GitHub REST / GraphQL + HTML 回退
- **UI** Radix UI、`lucide-react`、`sonner`、`vaul`、`embla-carousel` 等
- **Code/Markdown** `react-markdown` + `remark-gfm` + `react-syntax-highlighter` (PrismLight) + `mermaid` 11
- **Layout** `react-resizable-panels`、`next-themes`、`@vercel/analytics`

---

## 📂 Project Structure

```
app/
  page.tsx                # 单页主页 + 多窗口管理器（windows/activeId/nextZ）
  globals.css             # Matrix 主题、窗口/停靠/缩放/移动端样式
  layout.tsx
  api/
    github/route.ts       # 聚合用户/仓库/Pinned/统计，60s 缓存
    github/[owner]/[repo]/contents/route.ts # 目录/文件预览，1MB 限制，raw 跳转
components/
  web-window.tsx          # 多窗口：拖拽(rAF直写)、缩放、最大/最小化、失活、级联初位
  repository-browser.tsx  # 仓库文件树 + 预览（memo + useCallback）
  code-preview.tsx        # Prism 代码高亮（memo）
  markdown-preview.tsx    # Markdown + Mermaid（memo）
  matrix-rain.tsx         # WebGL 粒子雨（移动端节流、hidden 暂停）
  glitch-text.tsx / typing-text.tsx / project-card.tsx / tech-stack.tsx
```

---

## 🚀 Quick Start

```bash
# 1. 安装
npm install
# or pnpm install / yarn

# 2. 配置（可选，提升 GitHub 速率）
echo "GITHUB_TOKEN=ghp_xxx" > .env.local
# 不填则走公开 API + HTML 爬取，速率较低

# 3. 本地开发
npm run dev
# http://localhost:3000

# 4. 构建
npm run build && npm run start
```

> **GitHub Token** 仅需 `public_repo` 读取权限，用于 GraphQL Pinned 与提高 REST 限额。未配置时 `fetchPinnedReposFromHTML` 会回退。

---

## 🔌 API

| Route | 方法 | 说明 |
|-------|------|------|
| `GET /api/github` | `GET` | 返回 `{user, repos[], stats}`，`repos` 已按 Pinned 优先 + Star/更新排序，`Cache-Control: private, max-age=60, stale-while-revalidate=300` |
| `GET /api/github/[owner]/[repo]/contents?path=&raw=1` | `GET` | 目录 `{kind:"directory", entries[]}` 或文件 `{kind:"file", content, canPreview}`；`size>1MB` 或二进制 `canPreview=false`；`raw=1` 302 跳 `download_url`；`Cache 900s` |

---

## 🎨 Window System Contract

- **多开** `openPreview(url)` 查重：同 `url` 已开则聚焦置顶，不重复创建。
- **层级** 每个窗口独立 `z`，`focus` 时 `z = nextZ++`，`activeId` 决定 `web-window-active / inactive`。
- **拖拽** 表头 `pointerdown`（按钮/链接除外）→ `setPointerCapture` → `rAF` 直写 `transform: translate(calc(-50%+x), calc(-50%+y))`，`pointerup` 再同步 React `pos`，首帧后 `web-window-moved` 禁用入场动画。
- **缩放** 8 向手柄，`w/n` 保持对边不动（`newLeft = startLeft + dx` 等补偿），尺寸 clamp `MIN 360×280` ~ `vw-32`，仅更新 `size/pos`，不重置居中。
- **最小化** 受控 `minimized`，`Dock` 以 `bottom:16+idx*56` 垂直堆叠，`z230` 置顶；点击空白层 `deactivateAll` 仅失活不关闭。
- **移动端** 窗口 `background: var(--card); backdrop-filter:none; animation:none` 保证清晰，标题/路径栏实色无模糊。

---

## 📱 Responsive & Perf

- `html/body { scrollbar-gutter: stable; overflow-y: scroll }` 常驻滚动条，弹窗不再引起布局跳动。
- `contain: layout paint; will-change: transform` + 拖拽时 `backdrop-filter:none`。
- `MatrixRain` 列宽 `22px`、`hidden` 暂停、移动端隔帧绘制。
- `RepositoryBrowser`/`CodePreview`/`MarkdownPreview` 均 `memo` + `useCallback/useMemo`，图片 `loading=lazy`，`content-visibility:auto`。

---

## 🛠️ Customization

- **用户** 修改 `app/api/github/route.ts:177` 的 `username = "immane"`。
- **主题** 在 `app/globals.css:7` 调整 `oklch` 变量（`--primary`/`--matrix-green` 等）。
- **窗口默认尺寸** `components/web-window.tsx:22` 的 `MIN_W/MIN_H` 与 `app/globals.css:222` 的 `min(80vw,1440px)`。
- **级联偏移** `app/page.tsx:184` 的 `stagger*32/28`。

---

## 📦 Deployment

- Vercel 一键导入，`main` 分支自动部署；或 `npm run build` 产物部署至任意 Node 18+ 环境。
- 环境变量 `GITHUB_TOKEN` 在 Vercel Dashboard 配置。

---

## 📄 License

MIT — 可自由用于个人主页/作品集，保留 Matrix 风格与窗口交互请注明来源。

<p align="center">Built with lots of coffee ☕ · Matrix forever</p>
