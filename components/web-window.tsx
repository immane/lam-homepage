"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RepositoryBrowser } from "@/components/repository-browser";

interface WebWindowProps {
  url: string | null;
  repository?: { owner: string; name: string } | null;
  onClose: () => void;
}

export function WebWindow({ url, repository, onClose }: WebWindowProps) {
  const windowRef = useRef<HTMLElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // drag state: start pointer, origin pos, window size
  const dragState = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    w: 0,
    h: 0,
  });

  // Reset position/min/max when a new preview opens
  useEffect(() => {
    if (url || repository) {
      setIsMinimized(false);
      setIsMaximized(false);
      setPos({ x: 0, y: 0 });
    }
  }, [url, repository]);

  useEffect(() => {
    const hasWindow = Boolean(url || repository);
    if (!hasWindow) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    if (!isMinimized) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [url, repository, onClose, isMinimized]);

  // Pointer move/up while dragging
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - dragState.current.startX;
      const dy = event.clientY - dragState.current.startY;
      let nextX = dragState.current.originX + dx;
      let nextY = dragState.current.originY + dy;

      // clamp so at least ~80px remains visible horizontally and header stays on screen vertically
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = dragState.current.w || 800;
      const h = dragState.current.h || 600;
      const centerLeft = (vw - w) / 2;
      const centerTop = (vh - h) / 2;
      const minLeft = -w + 80;
      const maxLeft = vw - 80;
      const minTop = 0;
      const maxTop = vh - 48;

      const absLeft = centerLeft + nextX;
      const absTop = centerTop + nextY;
      const clampedLeft = Math.min(Math.max(absLeft, minLeft), maxLeft);
      const clampedTop = Math.min(Math.max(absTop, minTop), maxTop);
      nextX = clampedLeft - centerLeft;
      nextY = clampedTop - centerTop;

      setPos({ x: nextX, y: nextY });
    };

    const onPointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging]);

  const onToolbarPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (isMaximized) return;
      // Don't start drag when clicking controls/links
      const target = event.target as HTMLElement;
      if (target.closest("button, a")) return;
      // Only primary pointer
      if (event.button !== 0) return;

      const rect = windowRef.current?.getBoundingClientRect();
      dragState.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: pos.x,
        originY: pos.y,
        w: rect?.width ?? 0,
        h: rect?.height ?? 0,
      };
      setIsDragging(true);
      // Capture to ensure move events even if leaving toolbar
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [isMaximized, pos.x, pos.y]
  );

  if (!url && !repository) return null;

  const hostname = repository
    ? `${repository.owner}/${repository.name}`
    : new URL(url!).hostname.replace(/^www\./, "");

  if (isMinimized) {
    return (
      <div className="web-window-minimized-dock" role="presentation">
        <button
          className="web-window-minimized-bar"
          onClick={() => setIsMinimized(false)}
          type="button"
          aria-label={`Restore ${hostname}`}
          title="Restore"
        >
          <span className="web-window-minimized-dot" aria-hidden />
          <span className="web-window-minimized-title">~/projects/{hostname}</span>
          <span className="web-window-minimized-hint">↗ Restore</span>
        </button>
        <button
          className="web-window-minimized-close"
          onClick={onClose}
          type="button"
          aria-label="Close preview"
          title="Close"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      className={isMaximized ? "web-window-backdrop web-window-backdrop-maximized" : "web-window-backdrop"}
      onClick={onClose}
      role="presentation"
    >
      <section
        ref={windowRef}
        aria-label={`Previewing ${hostname}`}
        aria-modal="true"
        className={
          isMaximized
            ? "web-window web-window-maximized"
            : isDragging
              ? "web-window web-window-dragging"
              : "web-window"
        }
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        style={
          isMaximized
            ? undefined
            : pos.x !== 0 || pos.y !== 0
              ? { transform: `translate(${pos.x}px, ${pos.y}px)` }
              : undefined
        }
      >
        <header
          className="web-window-toolbar web-window-toolbar-draggable"
          onPointerDown={onToolbarPointerDown}
          onDoubleClick={() => setIsMaximized((v) => !v)}
          title={isDragging ? "Dragging" : "Drag to move · Double-click to maximize"}
        >
          <div className="web-window-controls">
            <button
              aria-label="Close preview"
              className="web-window-control web-window-close"
              onClick={onClose}
              type="button"
            />
            <button
              aria-label="Minimize preview"
              className="web-window-control web-window-minimize"
              onClick={() => setIsMinimized(true)}
              type="button"
              title="Minimize"
            />
            <button
              aria-label={isMaximized ? "Restore preview" : "Maximize preview"}
              className="web-window-control web-window-maximize"
              onClick={() => {
                if (isMaximized) {
                  setIsMaximized(false);
                } else {
                  setPos({ x: 0, y: 0 });
                  setIsMaximized(true);
                }
              }}
              type="button"
              title={isMaximized ? "Restore" : "Maximize"}
            />
          </div>
          <div className="web-window-address">
            <span className="web-window-prompt">$</span>
            <span>~/projects/{hostname}</span>
          </div>
          <a
            aria-label={`Open ${hostname} on GitHub`}
            className="web-window-external-link"
            href={url!}
            rel="noreferrer"
            target="_blank"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 00-2-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </a>
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
