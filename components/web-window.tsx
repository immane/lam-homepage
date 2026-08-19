"use client";

import { useEffect } from "react";
import { RepositoryBrowser } from "@/components/repository-browser";

interface WebWindowProps {
  url: string | null;
  repository?: { owner: string; name: string } | null;
  onClose: () => void;
}

export function WebWindow({ url, repository, onClose }: WebWindowProps) {
  useEffect(() => {
    if (!url) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [url, onClose]);

  if (!url && !repository) return null;

  const hostname = repository
    ? `${repository.owner}/${repository.name}`
    : new URL(url!).hostname.replace(/^www\./, "");

  return (
    <div className="web-window-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label={`Previewing ${hostname}`}
        aria-modal="true"
        className="web-window"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="web-window-toolbar">
          <div className="web-window-controls">
            <button
              aria-label="Close preview"
              className="web-window-control web-window-close"
              onClick={onClose}
              type="button"
            />
            <span className="web-window-control web-window-minimize" />
            <span className="web-window-control web-window-maximize" />
          </div>
          <div className="web-window-address">
            <span className="web-window-prompt">$</span>
            <span>~/projects/{hostname}</span>
          </div>
          <span aria-hidden="true" className="web-window-toolbar-spacer" />
        </header>
        <div className="web-window-content">
          {repository ? (
            <RepositoryBrowser owner={repository.owner} repository={repository.name} />
          ) : (
            <iframe className="web-window-frame" src={url!} title={hostname} />
          )}
        </div>
      </section>
    </div>
  );
}
