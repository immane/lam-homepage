"use client";

import { useEffect, useId, useRef, useState, memo, useMemo } from "react";
import { CodePreview } from "@/components/code-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    const githubPath = githubRepositoryPath(url, owner, repository);
    if (isExternalUrl(url) && !githubPath) return url;
    const assetPath = githubPath || resolveRepositoryPath(url, path);
    return `/api/github/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents?${new URLSearchParams({ path: assetPath, raw: "1" })}`;
  };

  const remarkPlugins = useMemo(() => [remarkGfm], []);
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
          img({ src, alt, ...props }) {
            return <img {...props} alt={alt || ""} src={typeof src === "string" ? resolveAssetUrl(src) : undefined} />;
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
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
