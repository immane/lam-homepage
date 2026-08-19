"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CodePreview } from "@/components/code-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

function MermaidDiagram({ chart }: { chart: string }) {
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
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        components={{
          a({ href, children, ...props }) {
            return <a {...props} href={href} rel="noreferrer" target="_blank">{children}</a>;
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
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
