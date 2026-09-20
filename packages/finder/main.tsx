import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { requestFromHost, requestHostOpen } from "@lam/sim-bridge";
import { Finder, type FinderProject } from "./src/finder";
import "./src/styles.css";

/**
 * Opening a project must behave like the host's own project cards — a preview
 * window, not a jump to github.com. The guest cannot do that itself, so hand
 * the intent to the host; if it never installed the bridge, fall back to
 * `Finder`'s default (open the repository).
 */
window.__lamOpenProject = (project) => {
  if (window.self === window.top) return; // standalone: no host to ask
  requestHostOpen({ action: "project", url: project.url, homepage: project.homepage });
};

/**
 * Standalone entry for the static guest build.
 *
 * Served over plain HTTP by the emulated Linux, this bundle cannot reach the
 * host's API routes on its own. When it is embedded in a host page it asks
 * that page through the sim bridge; when opened directly (during development)
 * it falls back to the host's own `/api/github`, which works because the
 * build is also served from the host origin.
 *
 * `source=""` disables the Finder's built-in fetching: the loader here owns
 * data acquisition either way.
 */
async function loadProjects(): Promise<FinderProject[]> {
  let payload: unknown;
  try {
    payload = await requestFromHost("github");
  } catch {
    const response = await fetch("/api/github");
    if (!response.ok) throw new Error(`request failed (${response.status})`);
    payload = await response.json();
  }
  const repos = (payload as { repos?: FinderProject[] } | null)?.repos;
  return Array.isArray(repos) ? repos : [];
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Finder source="" loader={loadProjects} />
    </StrictMode>,
  );
}
