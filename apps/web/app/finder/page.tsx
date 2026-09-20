"use client";

import dynamic from "next/dynamic";
import "@lam/finder/styles.css";

/**
 * Standalone host for the Finder app. The component is code-split and only
 * fetched in the browser (`ssr: false`), and the project list itself is loaded
 * at runtime by the app — so this route is a thin, disposable shell that can
 * be dropped once the Finder is served from inside the guest.
 */
const Finder = dynamic(() => import("@lam/finder").then((mod) => mod.Finder), {
  ssr: false,
  loading: () => (
    <p style={{ padding: 24, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
      Loading Finder…
    </p>
  ),
});

export default function FinderPage() {
  return (
    <main className="finder-page">
      <Finder />
    </main>
  );
}
