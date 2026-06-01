"use client";

import { useState, useEffect } from "react";
import { MatrixRain } from "@/components/matrix-rain";
import { GlitchText } from "@/components/glitch-text";
import { TypingText } from "@/components/typing-text";
import { ProjectCard } from "@/components/project-card";
import { TechStack } from "@/components/tech-stack";
import { cn } from "@/lib/utils";

const projects = [
  {
    name: "crud-admin",
    description:
      "A config-driven admin panel framework powered by Vue 2, Element UI and EasyAdmin",
    language: "Vue",
    stars: 0,
    url: "https://github.com/immane/crud-admin",
  },
  {
    name: "compact-rag",
    description:
      "Enterprise-grade RAG system — lightweight, production-ready document retrieval and intelligent Q&A.",
    language: "Python",
    stars: 0,
    url: "https://github.com/immane/compact-rag",
  },
  {
    name: "tetris-silicon",
    description:
      "A Rust terminal Tetris implementation built with the Silicon-Based Software Architecture Paradigm",
    language: "Rust",
    stars: 1,
    url: "https://github.com/immane/tetris-silicon",
  },
  {
    name: "fpga-projects",
    description: "Research for Tang Nano 2K FPGA development board",
    language: "Verilog",
    stars: 1,
    url: "https://github.com/immane/fpga-projects",
  },
  {
    name: "crud-skeleton",
    description: "Minimal, pragmatic CRUD skeleton built on Symfony 8.1",
    language: "PHP",
    stars: 1,
    url: "https://github.com/immane/crud-skeleton",
  },
  {
    name: "quant-trade",
    description: "Quantitative trading research and experiments",
    language: "Python",
    stars: 0,
    url: "https://github.com/immane/quant-trade",
  },
];

const socialLinks = [
  {
    name: "GitHub",
    url: "https://github.com/immane",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    name: "Website",
    url: "http://rin.hk",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary font-mono animate-pulse">
          Initializing...
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Matrix Rain Background */}
      <MatrixRain />

      {/* Scanline Effect */}
      <div className="scanline" />

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div
            className={cn(
              "text-center transition-all duration-1000",
              showContent
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            )}
          >
            {/* Avatar */}
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div
                className="absolute inset-0 rounded-full border-2 border-primary"
                style={{
                  boxShadow:
                    "0 0 20px var(--primary), inset 0 0 20px rgba(0,255,65,0.1)",
                }}
              />
              <img
                src="https://avatars.githubusercontent.com/u/9325176?v=4"
                alt="Lam K."
                className="w-full h-full rounded-full object-cover"
                crossOrigin="anonymous"
              />
              {/* Online indicator */}
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded-full border-2 border-background animate-pulse" />
            </div>

            {/* Name with glitch effect */}
            <h1 className="text-4xl md:text-6xl font-bold font-mono mb-4">
              <GlitchText text="Lam K." className="text-primary" />
            </h1>

            {/* Typing effect tagline */}
            <div className="h-8 mb-6">
              <TypingText
                text="$ echo 'Full-Stack Developer @ RM Studio'"
                className="text-lg md:text-xl text-muted-foreground"
                speed={40}
                delay={800}
              />
            </div>

            {/* Bio */}
            <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed mb-8 px-4">
              Building elegant solutions across the stack. From{" "}
              <span className="text-primary">enterprise admin panels</span> to{" "}
              <span className="text-primary">AI-powered RAG systems</span>,{" "}
              <span className="text-primary">FPGA hardware</span> to{" "}
              <span className="text-primary">quantitative trading</span>.
            </p>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4 mb-12">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded border border-border",
                    "bg-card/50 backdrop-blur-sm text-foreground",
                    "hover:border-primary hover:text-primary hover:bg-card/80",
                    "transition-all duration-300",
                    "hover:shadow-[0_0_20px_rgba(0,255,65,0.2)]"
                  )}
                >
                  {link.icon}
                  <span className="font-mono text-sm">{link.name}</span>
                </a>
              ))}
            </div>

            {/* Scroll indicator */}
            <div className="animate-bounce">
              <svg
                className="w-6 h-6 text-primary mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-mono font-bold text-center mb-2">
              <span className="text-muted-foreground">&lt;</span>
              <span className="text-primary">TechStack</span>
              <span className="text-muted-foreground"> /&gt;</span>
            </h2>
            <p className="text-center text-muted-foreground mb-8 font-mono text-sm">
              {"// Technologies I work with"}
            </p>
            <TechStack />
          </div>
        </section>

        {/* Projects Section */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-mono font-bold text-center mb-2">
              <span className="text-muted-foreground">{"{"}</span>
              <span className="text-primary"> Projects </span>
              <span className="text-muted-foreground">{"}"}</span>
            </h2>
            <p className="text-center text-muted-foreground mb-12 font-mono text-sm">
              {"// Recent open source contributions"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <div
                  key={project.name}
                  className="animate-in fade-in slide-in-from-bottom-4"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <ProjectCard {...project} />
                </div>
              ))}
            </div>

            {/* View all link */}
            <div className="text-center mt-12">
              <a
                href="https://github.com/immane?tab=repositories"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded border border-primary",
                  "text-primary font-mono",
                  "hover:bg-primary hover:text-primary-foreground",
                  "transition-all duration-300",
                  "hover:shadow-[0_0_30px_rgba(0,255,65,0.4)]"
                )}
              >
                <span>View All Repositories</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Public Repos", value: "15+" },
                { label: "Commits (30d)", value: "74%" },
                { label: "Since", value: "2014" },
                { label: "Languages", value: "6+" },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  className={cn(
                    "text-center p-6 rounded border border-border",
                    "bg-card/30 backdrop-blur-sm",
                    "hover:border-primary transition-all duration-300"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-3xl font-mono font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-border">
          <div className="max-w-4xl mx-auto text-center">
            <div className="font-mono text-sm text-muted-foreground mb-4">
              <span className="text-primary">$</span> cat footer.txt
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Built with Next.js, Tailwind CSS, and lots of ☕
            </p>
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary">&gt;</span> © 2024 Lam K. All
              rights reserved.
            </div>
            <div className="mt-4 font-mono text-xs text-muted-foreground animate-pulse">
              <span className="text-primary">_</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
