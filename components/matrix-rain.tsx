"use client";

import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Matrix characters (mix of katakana, numbers, and symbols)
    const chars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    const charArray = chars.split("");

    const fontSize = 16;
    const columnSpacing = 24; // Wider spacing between columns

    let columns: number;
    let drops: number[];

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -50;
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Clear canvas on resize
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      initializeDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Strong fade effect to prevent character buildup
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "Courier New", monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = charArray[Math.floor(Math.random() * charArray.length)];

        // Calculate position with proper spacing
        const x = i * columnSpacing + columnSpacing / 2;
        const y = drops[i] * fontSize;

        // Only draw if on screen
        if (y > 0 && y < canvas.height + fontSize) {
          // Bright head character
          if (Math.random() > 0.96) {
            ctx.fillStyle = "rgba(200, 255, 200, 0.9)";
          } else {
            // Dim trailing characters
            ctx.fillStyle = `rgba(0, 255, 65, ${0.15 + Math.random() * 0.15})`;
          }
          ctx.fillText(char, x, y);
        }

        // Reset when reaching bottom or randomly
        if (y > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }

        drops[i] += 0.6; // Slower fall speed
      }
    };

    const interval = setInterval(draw, 50); // Slower frame rate

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-60"
      style={{ zIndex: 0 }}
    />
  );
}
