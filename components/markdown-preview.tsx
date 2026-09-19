"use client";

import { useEffect, useId, useRef, useState, memo, useMemo } from "react";
import { CodePreview } from "@/components/code-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface MarkdownPreviewProps {
  content: string;
  owner: string;
  repository: string;
  path: string;
  onNavigate: (path: string) => void;
}

function isExternalUrl(url: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function resolveRepositoryPath(url: string, currentPath: string) {
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

function githubRepositoryPath(url: string, owner: string, repository: string) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rehypePlugins = useMemo(() => [rehypeRaw, [rehypeSanitize, sanitizeSchema] as any], [sanitizeSchema]);
  return (
    <div className="markdown-preview" style={{ contentVisibility: "auto", containIntrinsicSize: "600px 400px" } as React.CSSProperties}>
      <ReactMarkdown
        components={{
          a({ href, children, ...props }) {
            const githubPath = href ? githubRepositoryPath(href, owner, repository) : null;
            if (href && (!isExternalUrl(href) || githubPath) && !href.startsWith("#")) {
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
            if (href?.startsWith("#")) return <a {...props} href={href}>{children}</a>;
            return <a {...props} href={href} rel="noreferrer" target="_blank">{children}</a>;
          },
          img({ src, srcSet, ...props }) {
            return (
              <img
                {...props}
                alt={typeof props.alt === "string" ? props.alt : ""}
                src={typeof src === "string" ? resolveAssetUrl(src) : undefined}
                srcSet={typeof srcSet === "string" ? resolveSrcSet(srcSet) : undefined}
                loading="lazy"
                decoding="async"
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
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }) {
            const language = /language-(\w+)/.exec(className || "")?.[1];
            const code = String(children).replace(/\n$/, "");

            if (language === "mermaid") return <MermaidDiagram chart={code} />;
            if (language) return <CodePreview code={code} language={language} />;

            return <code {...props} className={className}>{children}</code>;
          },
        }}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
