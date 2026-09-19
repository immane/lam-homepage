"use client";

import { useEffect, useRef, useState } from "react";
import { createSimVm, type SimVm } from "@lam/sim-vm";

type Status = "booting" | "ready" | "running" | "error";

export default function SimPage() {
  const screenRef = useRef<HTMLDivElement>(null);
  const serialRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<Status>("booting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vm: SimVm | null = null;
    let cancelled = false;

    (async () => {
      try {
        const instance = await createSimVm(
          { screen: screenRef.current, serial: serialRef.current },
          { autostart: true }
        );
        if (cancelled) {
          await instance.destroy();
          return;
        }
        vm = instance;
        instance.emulator.add_listener("emulator-ready", () => setStatus("ready"));
        instance.emulator.add_listener("emulator-started", () => setStatus("running"));
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      void vm?.destroy();
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050805",
        color: "#7dffa0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: 16,
      }}
    >
      <h1 style={{ fontSize: 13, letterSpacing: "0.14em", color: "#39d353" }}>
        v86 · LINUX GUEST
      </h1>
      <p style={{ fontSize: 11, color: "#4e9c63", margin: "4px 0 12px" }}>
        status: {status}
        {error ? ` — ${error}` : ""}
      </p>

      {/* v86 ScreenAdapter requires: container.firstChild = text div, plus a canvas. */}
      <div
        ref={screenRef}
        style={{
          background: "#000",
          border: "1px solid #1c3a25",
          borderRadius: 6,
          padding: 8,
          overflow: "auto",
        }}
      >
        <div style={{ whiteSpace: "pre", font: "14px monospace", lineHeight: "14px" }} />
        <canvas style={{ display: "none" }} />
      </div>

      <textarea
        ref={serialRef}
        readOnly
        rows={12}
        aria-label="Serial console"
        style={{
          width: "100%",
          marginTop: 12,
          background: "#000",
          color: "#7dffa0",
          border: "1px solid #1c3a25",
          borderRadius: 6,
          padding: 8,
          fontFamily: "inherit",
          fontSize: 12,
        }}
      />
    </main>
  );
}
