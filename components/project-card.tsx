"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  name: string;
  description: string;
  language: string;
  stars: number;
  url: string;
  isPinned?: boolean;
  onOpenPreview?: (url: string) => void;
}

const languageColors: Record<string, string> = {
  PHP: "#4F5D95",
  Verilog: "#b2b7f8",
  Rust: "#dea584",
  Python: "#3572A5",
  Vue: "#41b883",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
};

export function ProjectCard({
  name,
  description,
  language,
  stars,
  url,
  isPinned = false,
  onOpenPreview,
}: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "group relative block w-full p-6 rounded-lg border border-border text-left",
        "bg-card/50 backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        "hover:border-primary hover:shadow-[0_0_30px_rgba(0,255,65,0.3)]",
        "hover:bg-card/80"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpenPreview?.(url)}
    >
      {/* Scan line effect on hover */}
      {isHovered && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <div
            className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{
              animation: "scanline 1s linear infinite",
            }}
          />
        </div>
      )}

      {/* Terminal header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-2 flex-1 truncate">
          ~/projects/{name}
        </span>
        {/* Pinned indicator */}
        {isPinned && (
          <div className="flex items-center gap-1 text-primary" title="Pinned repository">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826L4.456.734Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Project name with glitch on hover */}
      <h3
        className={cn(
          "text-lg font-mono font-bold text-primary mb-2",
          "transition-all duration-200",
          isHovered && "text-shadow-glow"
        )}
        style={{
          textShadow: isHovered
            ? "0 0 10px var(--primary), 0 0 20px var(--primary)"
            : "none",
        }}
      >
        <span className="text-muted-foreground">$</span> {name}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
        {description || "// No description provided"}
      </p>

      {/* Footer with language and stars */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: languageColors[language] || "#00ff41" }}
          />
          <span className="text-muted-foreground">{language}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>{stars}</span>
        </div>
      </div>

      {/* Arrow indicator */}
      <div
        className={cn(
          "absolute top-6 right-6 text-primary opacity-0 transition-all duration-300",
          "group-hover:opacity-100 group-hover:translate-x-1 cursor-pointer"
        )}
        onClick={(event) => {
          event.stopPropagation();
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        role="link"
        tabIndex={0}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </button>
  );
}
