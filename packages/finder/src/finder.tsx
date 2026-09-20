"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { languageColor, UNKNOWN_LANGUAGE_COLOR } from "./languages";

/** A GitHub project rendered as a Finder "file". */
export interface FinderProject {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  homepage?: string | null;
  topics?: string[];
  isPinned?: boolean;
}

export interface FinderProps {
  /**
   * Endpoint returning `{ repos: FinderProject[] }`. Defaults to the host's
   * `/api/github`. Kept as a prop so the app can be moved (e.g. into the guest
   * Linux) and pointed at the bridge without touching the component.
   */
  source?: string;
  /** Window/collection title shown in the toolbar. */
  title?: string;
  /** Called when a project is opened. Defaults to opening its URL in a tab. */
  onOpenProject?: (project: FinderProject) => void;
  className?: string;
}

type Selection = { kind: "all" } | { kind: "pinned" } | { kind: "tag"; tag: string };

interface FetchState {
  projects: FinderProject[];
  loading: boolean;
  error: string | null;
}

const DEFAULT_SOURCE = "/api/github";

/** Dependency-free dynamic loader: fetches the project list at runtime. */
function useProjects(source: string): FetchState {
  const [state, setState] = useState<FetchState>({
    projects: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    // No source configured (e.g. the standalone guest build before the sim
    // bridge is wired up): show the empty state instead of requesting the
    // document itself, which would come back as HTML.
    if (!source) {
      setState({ projects: [], loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ projects: [], loading: true, error: null });

    fetch(source, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        return res.json() as Promise<{ repos?: FinderProject[] }>;
      })
      .then((data) => {
        if (!active) return;
        setState({
          projects: Array.isArray(data?.repos) ? data.repos : [],
          loading: false,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          projects: [],
          loading: false,
          error: cause instanceof Error ? cause.message : "failed to load projects",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [source]);

  return state;
}

interface TagEntry {
  name: string;
  count: number;
  color: string;
}

function FileGlyph() {
  return (
    <svg className="finder-file-glyph" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"
      />
    </svg>
  );
}

export function Finder({
  source = DEFAULT_SOURCE,
  title = "Projects",
  onOpenProject,
  className,
}: FinderProps) {
  const { projects, loading, error } = useProjects(source);
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);

  // Touch devices have no hover/double-click: a second tap on the already
  // selected file opens it, so projects are reachable on mobile.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    setCoarsePointer(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setCoarsePointer(event.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const tags = useMemo<TagEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      if (!project.language) continue;
      counts.set(project.language, (counts.get(project.language) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, color: languageColor(name) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (selection.kind === "pinned" && !project.isPinned) return false;
      if (selection.kind === "tag" && project.language !== selection.tag) return false;
      if (!needle) return true;
      return (
        project.name.toLowerCase().includes(needle) ||
        (project.description ?? "").toLowerCase().includes(needle) ||
        (project.topics ?? []).some((topic) => topic.toLowerCase().includes(needle))
      );
    });
  }, [projects, selection, query]);

  const openProject = useCallback(
    (project: FinderProject) => {
      if (onOpenProject) {
        onOpenProject(project);
        return;
      }
      if (typeof window !== "undefined") window.open(project.url, "_blank", "noreferrer");
    },
    [onOpenProject],
  );

  const collectionLabel =
    selection.kind === "all"
      ? title
      : selection.kind === "pinned"
        ? "Pinned"
        : `#${selection.tag}`;

  return (
    <div className={className ? `finder ${className}` : "finder"}>
      <aside className="finder-sidebar" aria-label="Finder sources">
        <div className="finder-section">
          <h3 className="finder-section-title">Projects</h3>
          <button
            type="button"
            className="finder-sidebar-item"
            aria-pressed={selection.kind === "all"}
            onClick={() => setSelection({ kind: "all" })}
          >
            <span className="finder-sidebar-icon" aria-hidden>▦</span>
            <span className="finder-sidebar-label">{title}</span>
            <span className="finder-sidebar-count">{projects.length}</span>
          </button>
          <button
            type="button"
            className="finder-sidebar-item"
            aria-pressed={selection.kind === "pinned"}
            onClick={() => setSelection({ kind: "pinned" })}
          >
            <span className="finder-sidebar-icon" aria-hidden>★</span>
            <span className="finder-sidebar-label">Pinned</span>
            <span className="finder-sidebar-count">
              {projects.filter((project) => project.isPinned).length}
            </span>
          </button>
        </div>

        <div className="finder-section">
          <h3 className="finder-section-title">Tags</h3>
          {tags.length === 0 ? (
            <p className="finder-section-empty">No languages yet</p>
          ) : (
            tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                className="finder-sidebar-item"
                aria-pressed={selection.kind === "tag" && selection.tag === tag.name}
                onClick={() => setSelection({ kind: "tag", tag: tag.name })}
              >
                <span
                  className="finder-tag-dot"
                  style={{ background: tag.color }}
                  aria-hidden
                />
                <span className="finder-sidebar-label">{tag.name}</span>
                <span className="finder-sidebar-count">{tag.count}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="finder-main" aria-label={collectionLabel}>
        <header className="finder-toolbar">
          <div className="finder-breadcrumb">
            <span className="finder-breadcrumb-root" aria-hidden>~</span>
            <span className="finder-breadcrumb-sep" aria-hidden>/</span>
            <span className="finder-breadcrumb-current">{collectionLabel}</span>
          </div>
          <div className="finder-toolbar-controls">
            <input
              className="finder-search"
              type="search"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search projects"
            />
            <span className="finder-count">
              {loading ? "…" : `${filtered.length} items`}
            </span>
          </div>
        </header>

        <div className="finder-body">
          {loading ? (
            <p className="finder-status">Loading projects…</p>
          ) : error ? (
            <p className="finder-status finder-status-error">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="finder-status">
              {projects.length === 0
                ? "No projects in this source"
                : "No matching projects"}
            </p>
          ) : (
            <div className="finder-grid" role="listbox" aria-label={collectionLabel}>
              {filtered.map((project) => {
                const color = project.language
                  ? languageColor(project.language)
                  : UNKNOWN_LANGUAGE_COLOR;
                const isSelected = selectedId === project.name;
                return (
                  <button
                    key={project.name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="finder-file"
                    onClick={() => {
                      if (coarsePointer && selectedId === project.name) openProject(project);
                      else setSelectedId(project.name);
                    }}
                    onDoubleClick={() => openProject(project)}
                    title={project.description ?? project.name}
                  >
                    <FileGlyph />
                    <span className="finder-file-name">{project.name}</span>
                    <span className="finder-file-meta">
                      {project.language ? (
                        <span className="finder-file-lang">
                          <span
                            className="finder-tag-dot"
                            style={{ background: color }}
                            aria-hidden
                          />
                          {project.language}
                        </span>
                      ) : (
                        <span className="finder-file-lang finder-file-lang--unknown">
                          Unknown
                        </span>
                      )}
                      {project.stars > 0 && (
                        <span className="finder-file-stars">★ {project.stars}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Finder;
