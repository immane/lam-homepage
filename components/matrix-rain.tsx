"use client";

import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Matrix characters (katakana + numbers)
    const chars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    const charArray = chars.split("");

    const fontSize = 16;
    const columnSpacing = 20;

    let columns: number;
    let drops: number[];

    const randomChar = () =>
      charArray[Math.floor(Math.random() * charArray.length)];

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      for (let i = 0; i < columns; i++) {
        // Random start positions, some negative for staggered entry
        drops[i] = Math.random() * -100;
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Fill with black on resize
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      initializeDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Key: use semi-transparent black overlay to create fade trail
      // Lower alpha = longer trails, higher alpha = shorter trails
      ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = randomChar();

        // Calculate x position (centered in column)
        const x = i * columnSpacing + columnSpacing / 2;
        const y = drops[i] * fontSize;

        // Only draw if visible
        if (y > 0) {
          // Randomly make some characters brighter (head of stream)
          if (Math.random() > 0.975) {
            // Bright white-green for head
            ctx.fillStyle = "#cfc";
          } else {
            // Normal matrix green
            ctx.fillStyle = "#0f0";
          }

          ctx.fillText(char, x, y);
        }

        // Move drop down
        drops[i]++;

        // Random reset to create varied stream lengths
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
    };

    // 30 FPS for smooth animation
    const interval = setInterval(draw, 33);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.7 }}
    />
  );
}
