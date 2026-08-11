"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { MatrixRain } from "@/components/matrix-rain";
import { GlitchText } from "@/components/glitch-text";
import { TypingText } from "@/components/typing-text";
import { ProjectCard } from "@/components/project-card";
import { TechStack } from "@/components/tech-stack";
import { cn } from "@/lib/utils";

interface GitHubData {
  user: {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    company: string | null;
    blog: string | null;
    location: string | null;
    public_repos: number;
    followers: number;
    following: number;
  };
  repos: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    url: string;
    topics: string[];
    isPinned: boolean;
  }>;
  stats: {
    totalRepos: number;
    totalStars: number;
    languages: number;
    createdYear: number;
    followers: number;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
    url: "http://lam.wiki",
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

function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-primary/30 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-primary rounded-full animate-spin" />
      </div>
      <div className="font-mono text-primary text-sm">
        <span className="animate-pulse">{">"} Loading GitHub data...</span>
      </div>
      <div className="font-mono text-muted-foreground text-xs">
        Establishing connection to the Matrix...
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm animate-pulse">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <div className="w-3 h-3 rounded-full bg-muted" />
          <div className="w-3 h-3 rounded-full bg-muted" />
        </div>
      </div>
      <div className="h-6 bg-muted rounded w-2/3 mb-3" />
      <div className="h-4 bg-muted rounded w-full mb-2" />
      <div className="h-4 bg-muted rounded w-4/5 mb-4" />
      <div className="flex justify-between">
        <div className="h-4 bg-muted rounded w-16" />
        <div className="h-4 bg-muted rounded w-10" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const { data, error, isLoading } = useSWR<GitHubData>(
    "/api/github",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  );

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <LoadingState />;
  }

  const user = data?.user;
  const repos = data?.repos || [];
  const stats = data?.stats;

  // Separate pinned and non-pinned repos
  const pinnedRepos = repos.filter((repo) => repo.isPinned);
  const otherRepos = repos.filter((repo) => !repo.isPinned);

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
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || user.login}
                  className="w-full h-full rounded-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-card animate-pulse" />
              )}
              {/* Online indicator */}
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded-full border-2 border-background animate-pulse" />
            </div>

            {/* Name with glitch effect */}
            <h1 className="text-4xl md:text-6xl font-bold font-mono mb-4">
              <GlitchText
                text={user?.name || user?.login || "Loading..."}
                className="text-primary"
              />
            </h1>

            {/* Typing effect tagline */}
            <div className="h-8 mb-6">
              <TypingText
                text={`$ echo '${user?.company || "Full-Stack Developer"}'`}
                className="text-lg md:text-xl text-muted-foreground"
                speed={40}
                delay={800}
              />
            </div>

            {/* Bio */}
            <p className="max-w-2xl mx-auto text-muted-foreground leading-relaxed mb-8 px-4">
              {user?.bio || (
                <>
                  Building elegant solutions across the stack. From{" "}
                  <span className="text-primary">enterprise admin panels</span>{" "}
                  to <span className="text-primary">AI-powered RAG systems</span>
                  , <span className="text-primary">FPGA hardware</span> to{" "}
                  <span className="text-primary">quantitative trading</span>.
                </>
              )}
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

        {/* Pinned Repositories Section */}
        {(isLoading || pinnedRepos.length > 0) && (
          <section className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-mono font-bold text-center mb-2">
                <span className="text-muted-foreground">{"["}</span>
                <svg
                  className="inline-block w-5 h-5 text-primary mx-2 -mt-1"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826L4.456.734Z" />
                </svg>
                <span className="text-primary">Pinned</span>
                <span className="text-muted-foreground">{"]"}</span>
              </h2>
              <p className="text-center text-muted-foreground mb-12 font-mono text-sm">
                {"// Featured repositories"}
                {isLoading && (
                  <span className="ml-2 text-primary animate-pulse">
                    fetching...
                  </span>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <SkeletonCard key={index} />
                    ))
                  : pinnedRepos.map((project, index) => (
                      <div
                        key={project.name}
                        className="animate-in fade-in slide-in-from-bottom-4"
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <ProjectCard
                          name={project.name}
                          description={project.description || ""}
                          language={project.language || "Unknown"}
                          stars={project.stars}
                          url={project.url}
                          isPinned={project.isPinned}
                        />
                      </div>
                    ))}
              </div>
            </div>
          </section>
        )}

        {/* All Projects Section */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-mono font-bold text-center mb-2">
              <span className="text-muted-foreground">{"{"}</span>
              <span className="text-primary"> Projects </span>
              <span className="text-muted-foreground">{"}"}</span>
            </h2>
            <p className="text-center text-muted-foreground mb-12 font-mono text-sm">
              {"// All repositories"}
              {isLoading && (
                <span className="ml-2 text-primary animate-pulse">
                  fetching...
                </span>
              )}
              {error && (
                <span className="ml-2 text-red-400">
                  (using cached data)
                </span>
              )}
              {!isLoading && otherRepos.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({otherRepos.length} repos)
                </span>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                : otherRepos.map((project, index) => (
                    <div
                      key={project.name}
                      className="animate-in fade-in slide-in-from-bottom-4"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationFillMode: "both",
                      }}
                    >
                      <ProjectCard
                        name={project.name}
                        description={project.description || ""}
                        language={project.language || "Unknown"}
                        stars={project.stars}
                        url={project.url}
                      />
                    </div>
                  ))}
            </div>

            {/* GitHub profile link */}
            <div className="text-center mt-12">
              <a
                href="https://github.com/immane"
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
                <span>View GitHub Profile</span>
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
                {
                  label: "Public Repos",
                  value: stats?.totalRepos ?? "--",
                },
                {
                  label: "Total Stars",
                  value: stats?.totalStars ?? "--",
                },
                {
                  label: "Since",
                  value: stats?.createdYear ?? "--",
                },
                {
                  label: "Languages",
                  value: stats?.languages ? `${stats.languages}+` : "--",
                },
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
                  <div
                    className={cn(
                      "text-3xl font-mono font-bold text-primary mb-2",
                      isLoading && "animate-pulse"
                    )}
                  >
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
              Built with Next.js, Tailwind CSS, and lots of coffee
            </p>
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-primary">&gt;</span> &copy; {new Date().getFullYear()}{" "}
              {user?.name || user?.login || "Lam K"}, All rights reserved.
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
