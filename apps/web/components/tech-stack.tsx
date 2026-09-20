"use client";

import { cn } from "@/lib/utils";

const technologies = [
  { name: "PHP", icon: "🐘" },
  { name: "Vue", icon: "💚" },
  { name: "Python", icon: "🐍" },
  { name: "Rust", icon: "🦀" },
  { name: "Verilog", icon: "⚡" },
  { name: "FPGA", icon: "🔌" },
];

export function TechStack() {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {technologies.map((tech, index) => (
        <div
          key={tech.name}
          className={cn(
            "group relative px-4 py-2 rounded border border-border",
            "bg-card/30 backdrop-blur-sm",
            "hover:border-primary hover:bg-card/60",
            "transition-all duration-300 cursor-default",
            "hover:shadow-[0_0_20px_rgba(0,255,65,0.2)]"
          )}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        >
          <div className="flex items-center gap-2 font-mono text-sm">
            <span className="text-lg">{tech.icon}</span>
            <span className="text-foreground group-hover:text-primary transition-colors">
              {tech.name}
            </span>
          </div>
          
          {/* Hover glow effect */}
          <div
            className={cn(
              "absolute inset-0 rounded opacity-0 group-hover:opacity-100",
              "transition-opacity duration-300 pointer-events-none"
            )}
            style={{
              background: "radial-gradient(circle at center, rgba(0,255,65,0.1) 0%, transparent 70%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
