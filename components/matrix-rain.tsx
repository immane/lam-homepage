"use client";

import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Matrix characters (mix of katakana, numbers, and symbols)
    const chars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&*(){}[]|;:<>?";
    const charArray = chars.split("");

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);

    // Array to track y position of each column
    const drops: number[] = [];
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    const draw = () => {
      // Darker background with stronger fade for clearer foreground
      ctx.fillStyle = "rgba(0, 2, 1, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#00ff41";
      ctx.font = `${fontSize}px monospace`;
      ctx.globalAlpha = 0.4; // Reduce overall opacity of matrix rain

      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = charArray[Math.floor(Math.random() * charArray.length)];

        // Draw the character
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Brighter character at the head of the stream
        if (Math.random() > 0.98) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        } else if (Math.random() > 0.9) {
          ctx.fillStyle = "rgba(125, 255, 125, 0.5)";
        } else {
          ctx.fillStyle = "rgba(0, 255, 65, 0.35)";
        }

        ctx.fillText(char, x, y);

        // Reset when reaching bottom or randomly
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }
      
      ctx.globalAlpha = 1; // Reset alpha
    };

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
      style={{ zIndex: 0 }}
    />
  );
}
