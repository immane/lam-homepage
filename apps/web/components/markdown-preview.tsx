"use client";

import { useCallback, useEffect, useId, useRef, useState, memo, useMemo, Children, isValidElement } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CodePreview } from "@/components/code-preview";
import { acquireBodyLock, releaseBodyLock } from "@/lib/body-scroll-lock";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";

interface MarkdownPreviewProps {
  content: string;
  owner: string;
  repository: string;
  path: string;
  onNavigate: (path: string) => void;
}

export function isExternalUrl(url: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
}

export function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function resolveRepositoryPath(url: string, currentPath: string) {
  const pathname = url.split(/[?#]/)[0];
  const segments = pathname.startsWith("/")
    ? []
    : currentPath.split("/").slice(0, -1).filter(Boolean);

  for (const segment of pathname.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(decodeSegment(segment));
  }

  return segments.join("/");
}

export function githubRepositoryPath(url: string, owner: string, repository: string) {
  if (!isExternalUrl(url)) return null;

  try {
    const parsed = new URL(url, "https://github.com");
    if (parsed.hostname !== "github.com") return null;

    const [urlOwner, urlRepository, view, _ref, ...path] = parsed.pathname
      .split("/")
      .filter(Boolean);
    if (urlOwner !== owner || urlRepository !== repository || !["blob", "raw", "tree"].includes(view)) {
      return null;
    }

    return path.map(decodeSegment).join("/");
  } catch {
    return null;
  }
}

const MermaidDiagram = memo(function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
          themeVariables: {
            primaryColor: "#0b3d20",
            primaryTextColor: "#d6ffe1",
            primaryBorderColor: "#00ff41",
            lineColor: "#61d17d",
            secondaryColor: "#102b19",
            tertiaryColor: "#07120b",
          },
        });

        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setError("Unable to render this Mermaid diagram.");
      }
    };

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) return <p className="mermaid-error">{error}</p>;
  return <div className="mermaid-diagram" ref={containerRef}>Rendering diagram...</div>;
});

const ImageLightbox = memo(function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="markdown-lightbox" role="dialog" aria-modal="true" aria-label={alt || "Image preview"} onClick={onClose}>
      <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
      <button type="button" className="markdown-lightbox-close" onClick={onClose} aria-label="Close image preview">
        <X size={18} />
      </button>
    </div>,
    document.body
  );
});

export const MarkdownPreview = memo(function MarkdownPreview({ content, owner, repository, path, onNavigate }: MarkdownPreviewProps) {
  const resolveAssetUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
    const githubPath = githubRepositoryPath(trimmed, owner, repository);
    if (isExternalUrl(trimmed) && !githubPath) return trimmed;
    const assetPath = githubPath || resolveRepositoryPath(trimmed, path);
    return `/api/github/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents?${new URLSearchParams({ path: assetPath, raw: "1" })}`;
  };

  const resolveSrcSet = (srcSet: string) => {
    return srcSet
      .split(",")
      .map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) return null;
        const resolved = resolveAssetUrl(parts[0]);
        return [resolved, ...parts.slice(1)].join(" ");
      })
      .filter(Boolean)
      .join(", ");
  };

  const sanitizeSchema = useMemo(
    () => ({
      ...defaultSchema,
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "video",
        "audio",
        "figure",
        "figcaption",
        "mark",
        "abbr",
        "cite",
        "dfn",
        "ins",
        "u",
        "small",
      ],
      attributes: {
        ...defaultSchema.attributes,
        a: [
          ...((defaultSchema.attributes?.a as unknown[]) ?? []),
          ["target", "_blank", "_self"],
          "rel",
          "title",
          "className",
          "style",
        ],
        img: [
          ...((defaultSchema.attributes?.img as unknown[]) ?? []),
          "srcSet",
          "sizes",
          "width",
          "height",
          "title",
          "loading",
          "decoding",
          "referrerPolicy",
          "crossOrigin",
          "style",
          "className",
        ],
        source: [
          ...((defaultSchema.attributes?.source as unknown[]) ?? []),
          "src",
          "media",
          "type",
          "sizes",
          "width",
          "height",
          "style",
        ],
        video: [
          "src",
          "poster",
          "controls",
          "autoPlay",
          "loop",
          "muted",
          "playsInline",
          "preload",
          "width",
          "height",
          "style",
          "className",
          "crossOrigin",
        ],
        audio: ["src", "controls", "autoPlay", "loop", "muted", "preload", "style", "className"],
        div: [...((defaultSchema.attributes?.div as unknown[]) ?? []), "align", "style", "className"],
        p: ["align", "style", "className"],
        span: ["style", "className"],
        figure: ["align", "style", "className"],
        figcaption: ["align", "style", "className"],
        h1: ["align", "style", "className", "id"],
        h2: [...((defaultSchema.attributes?.h2 as unknown[]) ?? []), "align", "style", "id"],
        h3: ["align", "style", "className", "id"],
        h4: ["align", "style", "className", "id"],
        h5: ["align", "style", "className", "id"],
        h6: ["align", "style", "className", "id"],
        table: [...((defaultSchema.attributes?.table as unknown[]) ?? []), "align", "style", "className"],
        th: ["align", "valign", "style", "className", "width", "height"],
        td: ["align", "valign", "style", "className", "width", "height"],
        tr: ["align", "valign", "style", "className"],
        "*": [...((defaultSchema.attributes?.["*"] as unknown[]) ?? []), "style", "className", "id"],
      },
      strip: [...(defaultSchema.strip ?? []), "style"],
    }),
    []
  );

  const remarkPlugins = useMemo(() => [remarkGfm], []);
  // Order matters: raw HTML must be parsed first, slugs generated next so
  // that sanitize prefixes every id uniformly with `user-content-`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rehypePlugins = useMemo(() => [rehypeRaw, rehypeSlug, [rehypeSanitize, sanitizeSchema] as any], [sanitizeSchema]);

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Same-file `#anchor` links: smooth-scroll inside this preview instead of
  // a native hash jump (which would scroll the whole page to nowhere —
  // headings carry sanitized `user-content-` prefixed ids).
  const scrollToAnchor = useCallback((rawFragment: string) => {
    const root = containerRef.current;
    if (!root) return;
    const smoothTo = (el: Element) => {
      if (typeof (el as HTMLElement).scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    // querySelector needs escaped ids; fall back to manual comparison where
    // CSS.escape is unavailable (never throws, exact same matches).
    const findById = (id: string): Element | null => {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return root.querySelector(`#${CSS.escape(id)}`);
      }
      const all = root.querySelectorAll("[id]");
      for (const el of all) {
        if (el.id === id) return el;
      }
      return null;
    };
    const findByName = (name: string): Element | null => {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return root.querySelector(`a[name="${CSS.escape(name)}"]`);
      }
      const all = root.querySelectorAll("a[name]");
      for (const el of all) {
        if (el.getAttribute("name") === name) return el;
      }
      return null;
    };
    let fragment = rawFragment;
    try {
      fragment = decodeURIComponent(rawFragment);
    } catch {
      // keep raw fragment on malformed sequences
    }
    if (!fragment) {
      root.closest(".repository-preview")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const candidates = [`user-content-${fragment}`, fragment];
    for (const id of candidates) {
      const byId = findById(id);
      if (byId) {
        smoothTo(byId);
        return;
      }
      const byName = findByName(id);
      if (byName) {
        smoothTo(byName);
        return;
      }
    }
    // Tolerate case differences between TOC links and slugs.
    const lowered = fragment.toLowerCase();
    const fallback = [...root.querySelectorAll("[id]")].find(
      (el) => el.id.toLowerCase() === `user-content-${lowered}` || el.id.toLowerCase() === lowered
    );
    if (fallback) smoothTo(fallback);
  }, []);

  // Scroll lock lives on this persistent parent (not inside the lightbox) so
  // closing paths that skip the portal's unmount cleanup still converge:
  // every run sheds first, then re-acquires only while open.
  useEffect(() => {
    const key = "markdown-lightbox";
    releaseBodyLock(key);
    if (!lightbox) return;
    acquireBodyLock(key);
    return () => {
      releaseBodyLock(key);
    };
  }, [lightbox]);
  return (
    <div ref={containerRef} className="markdown-preview" style={{ contentVisibility: "auto", containIntrinsicSize: "600px 400px" } as React.CSSProperties}>
      <ReactMarkdown
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith("#")) {
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToAnchor(href.slice(1));
                  }}
                >
                  {children}
                </a>
              );
            }
            const githubPath = href ? githubRepositoryPath(href, owner, repository) : null;
            if (href && (!isExternalUrl(href) || githubPath)) {
              const targetPath = githubPath || resolveRepositoryPath(href, path);
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(targetPath);
                  }}
                >
                  {children}
                </a>
              );
            }
            return <a {...props} href={href} rel="noreferrer" target="_blank">{children}</a>;
          },
          img({ src, srcSet, ...props }) {
            const resolvedSrc = typeof src === "string" ? resolveAssetUrl(src) : undefined;
            const alt = typeof props.alt === "string" ? props.alt : "";
            return (
              <img
                {...props}
                alt={alt}
                src={resolvedSrc}
                srcSet={typeof srcSet === "string" ? resolveSrcSet(srcSet) : undefined}
                loading="lazy"
                decoding="async"
                onClick={(event) => {
                  // 链接中的图片保留跳转行为，不放大
                  if (event.currentTarget.closest("a")) return;
                  if (resolvedSrc) setLightbox({ src: resolvedSrc, alt });
                }}
              />
            );
          },
          source({ src, srcSet, ...props }) {
            return (
              <source
                {...props}
                src={typeof src === "string" ? resolveAssetUrl(src) : undefined}
                srcSet={typeof srcSet === "string" ? resolveSrcSet(srcSet) : undefined}
              />
            );
          },
          video({ src, poster, ...props }) {
            return (
              <video
                {...props}
                controls
                preload="metadata"
                src={typeof src === "string" ? resolveAssetUrl(src) : undefined}
                poster={typeof poster === "string" ? resolveAssetUrl(poster) : undefined}
              />
            );
          },
          audio({ src, ...props }) {
            return (
              <audio
                {...props}
                controls
                preload="metadata"
                src={typeof src === "string" ? resolveAssetUrl(src) : undefined}
              />
            );
          },
          pre({ children, ...props }) {
            // 内层 code（带语言）已渲染为块级组件（CodePreview/Mermaid）或自带 <pre> 时直接透出，避免嵌套 <pre>
            const array = Children.toArray(children);
            if (array.length === 1 && isValidElement(array[0])) {
              const type = (array[0] as { type?: unknown }).type;
              if (type === CodePreview || type === MermaidDiagram || type === "pre") {
                return <>{children}</>;
              }
            }
            return <pre {...props}>{children}</pre>;
          },
          code({ className, children, ...props }) {
            const language = /language-([\w+-]+)/.exec(className || "")?.[1];
            const code = String(children).replace(/\n$/, "");

            if (language === "mermaid") return <MermaidDiagram chart={code} />;
            if (language) return <CodePreview code={code} language={language} padding="10px 12px" wrapLongLines={false} />;

            // 无语言围栏代码块（如 ASCII 结构图）含换行时按块级渲染，用 <pre> 保留全部换行与空格
            if (String(children).includes("\n")) {
              return (
                <pre>
                  <code {...props} className={className}>
                    {children}
                  </code>
                </pre>
              );
            }

            return <code {...props} className={className}>{children}</code>;
          },
        }}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {content}
      </ReactMarkdown>
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
    </div>
  );
});
