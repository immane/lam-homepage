"use client";

import { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { CodePreview } from "@/components/code-preview";
import { MarkdownPreview } from "@/components/markdown-preview";

interface RepositoryBrowserProps {
  owner: string;
  repository: string;
}

interface Entry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
}

interface DirectoryResponse {
  kind: "directory";
  path: string;
  entries: Entry[];
}

interface FileResponse {
  kind: "file";
  entry: Entry;
  downloadUrl: string | null;
  content: string | null;
  canPreview: boolean;
}

type ContentResponse = DirectoryResponse | FileResponse;

const imageFile = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

export const RepositoryBrowser = memo(function RepositoryBrowser({ owner, repository }: RepositoryBrowserProps) {
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [file, setFile] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<ImperativePanelHandle>(null);

  const loadPath = useCallback(async (path: string): Promise<ContentResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams(path ? { path } : undefined);
      const response = await fetch(
        `/api/github/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents?${query}`
      );
      const data: ContentResponse | { error: string } = await response.json();
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Unable to load repository content");
      }
      if (data.kind === "directory") {
        setDirectory(data);
        setFile(null);
      } else {
        setFile(data);
      }
      return data;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load repository content");
      return null;
    } finally {
      setLoading(false);
    }
  }, [owner, repository]);

  const loadDirectory = useCallback(async (path: string) => {
    const content = await loadPath(path);
    if (content?.kind !== "directory") return;
    const defaultFile = content.entries.find((entry) => entry.name.toLowerCase() === "readme.md") || content.entries.find((entry) => entry.type === "file");
    if (defaultFile) await loadPath(defaultFile.path);
  }, [loadPath]);

  useEffect(() => {
    void loadDirectory("");
  }, [loadDirectory]);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 640px)");
    if (mobileViewport.matches) {
      sidebarRef.current?.collapse();
      setSidebarOpen(false);
    }
  }, []);

  const currentPath = directory?.path || "";
  const parentPath = useMemo(() => currentPath.split("/").slice(0, -1).join("/"), [currentPath]);
  const previewImageUrl = useMemo(() => file && imageFile.test(file.entry.name)
    ? `/api/github/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents?${new URLSearchParams({ path: file.entry.path, raw: "1" })}`
    : null, [file, owner, repository]);

  const toggleSidebar = () => {
    if (sidebarOpen) {
      sidebarRef.current?.collapse();
    } else {
      sidebarRef.current?.expand();
    }
  };

  return (
    <div className="repository-browser" style={{ contentVisibility: "auto" } as React.CSSProperties}>
      <div className="repository-browser-heading">
        <div>
          <span className="repository-browser-owner">{owner}</span>
          <span className="repository-browser-slash">/</span>
          <strong>{repository}</strong>
        </div>
        <button
          aria-expanded={sidebarOpen}
          className="repository-sidebar-toggle"
          onClick={toggleSidebar}
          type="button"
        >
          {sidebarOpen ? "Hide files" : "Show files"}
        </button>
      </div>

      <div className="repository-browser-body">
        <PanelGroup autoSaveId={`repository-files-${owner}-${repository}`} className="repository-panel-group" direction="horizontal">
          <Panel
            collapsedSize={0}
            collapsible
            defaultSize={28}
            maxSize={45}
            minSize={18}
            onCollapse={() => setSidebarOpen(false)}
            onExpand={() => setSidebarOpen(true)}
            ref={sidebarRef}
          >
            <aside className="repository-files" aria-label="Repository files">
              <div className="repository-path">
                <button disabled={!currentPath} onClick={() => void loadDirectory(parentPath)} type="button">
                  ..
                </button>
                <span>{currentPath || "root"}</span>
              </div>
              {loading && <p className="repository-status">Loading files...</p>}
              {error && <p className="repository-status repository-error">{error}</p>}
              {directory?.entries.map((entry) => (
                <button
                  className="repository-entry"
                  key={entry.path}
                  onClick={() => void (entry.type === "dir" ? loadDirectory(entry.path) : loadPath(entry.path))}
                  type="button"
                >
                  <span className={entry.type === "dir" ? "repository-folder-icon" : "repository-file-icon"}>
                    {entry.type === "dir" ? "#" : "-"}
                  </span>
                  <span>{entry.name}</span>
                </button>
              ))}
            </aside>
          </Panel>
          <PanelResizeHandle className="repository-resize-handle" />
          <Panel minSize={55}>
            <article className="repository-preview">
              {file ? (
                <>
                  <header>{file.entry.path}</header>
                  {previewImageUrl ? (
                    <div className="repository-image-preview">
                      <img alt={file.entry.name} src={previewImageUrl} loading="lazy" decoding="async" />
                    </div>
                  ) : file.canPreview ? (
                    /\.mdx?$/i.test(file.entry.name) ? (
                      <MarkdownPreview
                        content={file.content || ""}
                        onNavigate={(path) => void loadDirectory(path)}
                        owner={owner}
                        path={file.entry.path}
                        repository={repository}
                      />
                    ) : (
                      <CodePreview code={file.content || ""} fileName={file.entry.name} />
                    )
                  ) : (
                    <p className="repository-status">This file is binary or exceeds the 1 MB preview limit.</p>
                  )}
                </>
              ) : (
                <div className="repository-empty">
                  <span>SELECT A FILE</span>
                  <p>README and text-based source files can be viewed here.</p>
                </div>
              )}
            </article>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
});
