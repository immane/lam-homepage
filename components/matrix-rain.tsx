"use client";

import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simpler character set for cleaner look
    const chars = "01";
    const charArray = chars.split("");

    const fontSize = 14;
    const columnSpacing = 40; // Much wider spacing

    let columns: number;
    let drops: number[];

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Clear canvas completely
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      initializeDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Very strong fade for clean trails
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * columnSpacing + columnSpacing / 2;
        const y = drops[i] * fontSize;

        if (y > 0 && y < canvas.height + fontSize) {
          // Only bright head, very dim trail
          if (Math.random() > 0.97) {
            ctx.fillStyle = "rgba(0, 255, 65, 0.8)";
          } else {
            ctx.fillStyle = "rgba(0, 255, 65, 0.08)";
          }
          ctx.fillText(char, x, y);
        }

        if (y > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }

        drops[i] += 0.4; // Even slower
      }
    };

    const interval = setInterval(draw, 80); // Slower updates

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-40"
      style={{ zIndex: 0 }}
    />
  );
}
