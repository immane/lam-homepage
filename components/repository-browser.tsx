"use client";

import { useEffect, useState } from "react";

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
  content: string | null;
  canPreview: boolean;
}

type ContentResponse = DirectoryResponse | FileResponse;

export function RepositoryBrowser({ owner, repository }: RepositoryBrowserProps) {
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [file, setFile] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPath = async (path: string): Promise<ContentResponse | null> => {
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
  };

  const loadDirectory = async (path: string) => {
    const content = await loadPath(path);
    if (content?.kind !== "directory") return;

    const defaultFile = content.entries.find(
      (entry) => entry.name.toLowerCase() === "readme.md"
    ) || content.entries.find((entry) => entry.type === "file");

    if (defaultFile) await loadPath(defaultFile.path);
  };

  useEffect(() => {
    void loadDirectory("");
  }, [owner, repository]);

  const currentPath = directory?.path || "";
  const parentPath = currentPath.split("/").slice(0, -1).join("/");

  return (
    <div className="repository-browser">
      <div className="repository-browser-heading">
        <span className="repository-browser-owner">{owner}</span>
        <span className="repository-browser-slash">/</span>
        <strong>{repository}</strong>
      </div>

      <div className="repository-browser-body">
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

        <article className="repository-preview">
          {file ? (
            <>
              <header>{file.entry.path}</header>
              {file.canPreview ? (
                <pre>{file.content}</pre>
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
      </div>
    </div>
  );
}
