"use client";

import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Original Matrix characters (katakana, numbers, symbols)
    const chars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    const charArray = chars.split("");

    const fontSize = 14;
    const columnSpacing = 28; // Balanced spacing

    let columns: number;
    let drops: number[];
    let fadeCounters: number[]; // Track how long each column has been visible

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      fadeCounters = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -50;
        fadeCounters[i] = 0;
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      initializeDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Clear with semi-transparent black for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * columnSpacing + columnSpacing / 2;
        const y = drops[i] * fontSize;

        if (y > 0 && y < canvas.height + fontSize) {
          fadeCounters[i]++;

          // Calculate opacity based on position in stream
          const streamLength = 15;
          const posInStream = fadeCounters[i] % streamLength;

          // Head of stream is bright, fades as it goes
          if (posInStream < 2) {
            ctx.fillStyle = "rgba(180, 255, 180, 0.9)"; // Bright head
          } else if (posInStream < 5) {
            ctx.fillStyle = "rgba(0, 255, 65, 0.5)"; // Medium
          } else {
            ctx.fillStyle = "rgba(0, 255, 65, 0.2)"; // Dim trail
          }

          ctx.fillText(char, x, y);
        }

        // Reset when reaching bottom
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
          fadeCounters[i] = 0;
        }

        drops[i] += 0.5;
      }
    };

    const interval = setInterval(draw, 50);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-70"
      style={{ zIndex: 0 }}
    />
  );
}
