"use client";

import { SimView } from "@/components/sim-view";

export default function SimPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex h-screen max-w-5xl flex-col p-4">
        <h1 className="mb-3 font-mono text-sm tracking-widest text-primary">
          v86 · LINUX GUEST
        </h1>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          <SimView />
        </div>
      </div>
    </main>
  );
}
