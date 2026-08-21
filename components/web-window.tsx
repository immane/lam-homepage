"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { RepositoryBrowser } from "@/components/repository-browser";

interface WebWindowProps {
  id?: string;
  url: string | null;
  repository?: { owner: string; name: string } | null;
  onClose: (id?: string) => void;
  active?: boolean;
  zIndex?: number;
  onFocus?: (id: string) => void;
  dockIndex?: number;
  minimized?: boolean;
  onMinimize?: (id: string) => void;
  onRestore?: (id: string) => void;
  initialOffset?: { x: number; y: number };
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_W = 360;
const MIN_H = 280;

function WebWindowInner({
  id,
  url,
  repository,
  onClose,
  active = true,
  zIndex,
  onFocus,
  dockIndex,
  minimized,
  onMinimize,
  onRestore,
  initialOffset,
}: WebWindowProps) {
  const windowRef = useRef<HTMLElement>(null);
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized = minimized !== undefined ? minimized : internalMinimized;
  const setIsMinimized = (v: boolean) => {
    if (minimized !== undefined) {
      if (v) onMinimize?.(id!);
      else onRestore?.(id!);
    } else {
      setInternalMinimized(v);
    }
  };
  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  const [isDragging, setIsDragging] = useState(false);
  const [resizingDir, setResizingDir] = useState<ResizeDir | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const dragState = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    w: 0,
    h: 0,
  });

  const resizeState = useRef({
    dir: "se" as ResizeDir,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    startLeft: 0,
    startTop: 0,
    startPosX: 0,
    startPosY: 0,
  });

  useEffect(() => {
    setIsMinimized(false);
    setIsMaximized(false);
    const p = initialOffset ? { x: initialOffset.x, y: initialOffset.y } : { x: 0, y: 0 };
    setPos(p);
    posRef.current = p;
    setSize(null);
    sizeRef.current = null;
    // also reset DOM transform directly to avoid stale
    if (windowRef.current && !isMaximized) {
      const t = p.x !== 0 || p.y !== 0 ? `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))` : `translate(-50%, -50%)`;
      windowRef.current.style.transform = t;
      windowRef.current.style.width = "";
      windowRef.current.style.height = "";
    }
  }, [id, initialOffset]);

  useEffect(() => {
    const hasWindow = Boolean(url || repository);
    if (!hasWindow) return;
    if (isMinimized) {
      if (!id) document.body.style.overflow = "";
      return;
    }
    if (!active) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(id);
    };
    document.addEventListener("keydown", closeOnEscape);
    if (!id) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (!id) document.body.style.overflow = "";
    };
  }, [url, repository, onClose, isMinimized, active, id]);

  useEffect(() => {
    if (id) return;
    const hasWindow = Boolean(url || repository);
    if (hasWindow && !isMinimized) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [id, url, repository, isMinimized]);

  // Sync DOM transform/size when pos/size state changes (for non-drag updates like maximize)
  useEffect(() => {
    if (!windowRef.current || isMaximized || isDragging || resizingDir) return;
    const el = windowRef.current;
    const t = pos.x !== 0 || pos.y !== 0 ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` : `translate(-50%, -50%)`;
    el.style.transform = t;
    if (size) {
      el.style.width = `${size.w}px`;
      el.style.height = `${size.h}px`;
    } else {
      el.style.width = "";
      el.style.height = "";
    }
  }, [pos, size, isMaximized, isDragging, resizingDir]);

  useEffect(() => {
    if (!isDragging) return;
    const onPointerMove = (event: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = event.clientX - dragState.current.startX;
        const dy = event.clientY - dragState.current.startY;
        let nextX = dragState.current.originX + dx;
        let nextY = dragState.current.originY + dy;
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
        posRef.current = { x: nextX, y: nextY };
        if (windowRef.current) {
          windowRef.current.style.transform = `translate(calc(-50% + ${nextX}px), calc(-50% + ${nextY}px))`;
        }
      });
    };
    const onPointerUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPos(posRef.current);
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!resizingDir) return;
    const onPointerMove = (event: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = event.clientX - resizeState.current.startX;
        const dy = event.clientY - resizeState.current.startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dir = resizeState.current.dir;
        const startW = resizeState.current.startW;
        const startH = resizeState.current.startH;
        const startLeft = resizeState.current.startLeft;
        const startTop = resizeState.current.startTop;
        let newW = startW;
        let newH = startH;
        let newLeft = startLeft;
        let newTop = startTop;
        if (dir.includes("e")) newW = startW + dx;
        if (dir.includes("w")) {
          newW = startW - dx;
          newLeft = startLeft + dx;
        }
        if (dir.includes("s")) newH = startH + dy;
        if (dir.includes("n")) {
          newH = startH - dy;
          newTop = startTop + dy;
        }
        const maxW = vw - 32;
        const maxH = vh - 32;
        let clampedW = Math.min(Math.max(newW, MIN_W), maxW);
        let clampedH = Math.min(Math.max(newH, MIN_H), maxH);
        if (dir.includes("w") && clampedW !== newW) {
          newLeft = startLeft + (startW - clampedW);
        }
        if (dir.includes("n") && clampedH !== newH) {
          newTop = startTop + (startH - clampedH);
        }
        newW = clampedW;
        newH = clampedH;
        const newPosX = newLeft - (vw - newW) / 2;
        const newPosY = newTop - (vh - newH) / 2;
        posRef.current = { x: newPosX, y: newPosY };
        sizeRef.current = { w: newW, h: newH };
        if (windowRef.current) {
          windowRef.current.style.transform = `translate(calc(-50% + ${newPosX}px), calc(-50% + ${newPosY}px))`;
          windowRef.current.style.width = `${newW}px`;
          windowRef.current.style.height = `${newH}px`;
        }
      });
    };
    const onPointerUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPos(posRef.current);
      setSize(sizeRef.current);
      setResizingDir(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resizingDir]);

  const handleFocus = useCallback(() => {
    if (id && onFocus) onFocus(id);
  }, [id, onFocus]);

  const onToolbarPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (isMaximized || resizingDir) return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a")) return;
      if (event.button !== 0) return;
      handleFocus();
      const rect = windowRef.current?.getBoundingClientRect();
      dragState.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: posRef.current.x,
        originY: posRef.current.y,
        w: rect?.width ?? 0,
        h: rect?.height ?? 0,
      };
      setIsDragging(true);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [isMaximized, resizingDir, handleFocus]
  );

  const onResizePointerDown = useCallback(
    (dir: ResizeDir) => (event: React.PointerEvent) => {
      if (isMaximized) return;
      event.preventDefault();
      event.stopPropagation();
      handleFocus();
      const rect = windowRef.current?.getBoundingClientRect();
      if (!rect) return;
      resizeState.current = {
        dir,
        startX: event.clientX,
        startY: event.clientY,
        startW: rect.width,
        startH: rect.height,
        startLeft: rect.left,
        startTop: rect.top,
        startPosX: posRef.current.x,
        startPosY: posRef.current.y,
      };
      setResizingDir(dir);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    [isMaximized, handleFocus]
  );

  const handleClose = useCallback(() => onClose(id), [onClose, id]);

  if (!url && !repository) return null;

  const hostname = repository
    ? `${repository.owner}/${repository.name}`
    : new URL(url!).hostname.replace(/^www\./, "");

  if (isMinimized) {
    const dockStyle: React.CSSProperties | undefined =
      dockIndex !== undefined ? { bottom: 16 + dockIndex * 56 } : undefined;
    const combinedStyle: React.CSSProperties = { zIndex: 230, ...(dockStyle || {}) };
    return (
      <div className="web-window-minimized-dock" role="presentation" style={combinedStyle}>
        <button
          className="web-window-minimized-bar"
          onClick={() => {
            setIsMinimized(false);
            handleFocus();
          }}
          type="button"
          aria-label={`Restore ${hostname}`}
          title="Restore"
        >
          <span className="web-window-minimized-dot" aria-hidden />
          <span className="web-window-minimized-title">~/projects/{hostname}</span>
          <span className="web-window-minimized-hint">↗ Restore</span>
        </button>
        <button className="web-window-minimized-close" onClick={handleClose} type="button" aria-label="Close preview" title="Close">
          ×
        </button>
      </div>
    );
  }

  const isMoved = posRef.current.x !== 0 || posRef.current.y !== 0 || sizeRef.current !== null || pos.x !== 0 || pos.y !== 0 || size !== null;

  const transformValue =
    pos.x !== 0 || pos.y !== 0
      ? `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
      : `translate(-50%, -50%)`;

  const windowStyle: React.CSSProperties = isMaximized
    ? { zIndex }
    : {
        zIndex,
        transform: transformValue,
        ...(size ? { width: size.w, height: size.h } : {}),
      };

  const useBackdrop = !id;

  const windowContent = (
    <section
      ref={windowRef}
      aria-label={`Previewing ${hostname}`}
      aria-modal={active ? "true" : undefined}
      className={
        isMaximized
          ? "web-window web-window-maximized"
          : isDragging
            ? "web-window web-window-dragging"
            : resizingDir
              ? `web-window web-window-resizing web-window-resizing-${resizingDir}`
              : isMoved
                ? `web-window web-window-moved ${active ? "web-window-active" : "web-window-inactive"}`
                : `web-window ${active ? "web-window-active" : "web-window-inactive"}`
      }
      onClick={(event) => {
        event.stopPropagation();
        handleFocus();
      }}
      onPointerDown={handleFocus}
      role="dialog"
      style={windowStyle}
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
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            type="button"
          />
          <button
            aria-label="Minimize preview"
            className="web-window-control web-window-minimize"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            type="button"
            title="Minimize"
          />
          <button
            aria-label={isMaximized ? "Restore preview" : "Maximize preview"}
            className="web-window-control web-window-maximize"
            onClick={(e) => {
              e.stopPropagation();
              handleFocus();
              if (isMaximized) setIsMaximized(false);
              else {
                const p = { x: 0, y: 0 };
                setPos(p);
                posRef.current = p;
                if (windowRef.current) windowRef.current.style.transform = `translate(-50%, -50%)`;
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
            <path
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 00-2-2v-4M14 4h6m0 0v6m0-6L10 14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </a>
      </header>
      <div className="web-window-content">
        {!active && !isMinimized && (
          <button
            aria-label={`Focus ${hostname}`}
            className="web-window-inactive-overlay"
            onClick={(e) => {
              e.stopPropagation();
              handleFocus();
            }}
            type="button"
          />
        )}
        {repository ? (
          <RepositoryBrowser owner={repository.owner} repository={repository.name} />
        ) : (
          <iframe className="web-window-frame" src={url!} title={hostname} loading="lazy" />
        )}
      </div>
      {!isMaximized && (
        <>
          <span className="web-window-resize-handle web-window-resize-n" onPointerDown={onResizePointerDown("n")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-s" onPointerDown={onResizePointerDown("s")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-e" onPointerDown={onResizePointerDown("e")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-w" onPointerDown={onResizePointerDown("w")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-ne" onPointerDown={onResizePointerDown("ne")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-nw" onPointerDown={onResizePointerDown("nw")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-se" onPointerDown={onResizePointerDown("se")} aria-hidden />
          <span className="web-window-resize-handle web-window-resize-sw" onPointerDown={onResizePointerDown("sw")} aria-hidden />
        </>
      )}
    </section>
  );

  if (useBackdrop) {
    return (
      <div className={isMaximized ? "web-window-backdrop web-window-backdrop-maximized" : "web-window-backdrop"} onClick={handleClose} role="presentation">
        {windowContent}
      </div>
    );
  }

  return windowContent;
}

export const WebWindow = memo(WebWindowInner);
