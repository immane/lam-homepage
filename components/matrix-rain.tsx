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
    const createSeededRandom = (seed: number) => () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };

    let columns: number;
    let drops: number[];
    let initialDrops: number[];
    let fadeCounters: number[]; // Track how long each column has been visible
    let seeds: number[];
    let randoms: Array<() => number>;

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      initialDrops = [];
      fadeCounters = [];
      seeds = [];
      randoms = [];
      for (let i = 0; i < columns; i++) {
        seeds[i] = i + 1;
        randoms[i] = createSeededRandom(seeds[i]);
        initialDrops[i] = randoms[i]() * -50;
        drops[i] = initialDrops[i];
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
        const random = randoms[i];
        const char = charArray[Math.floor(random() * charArray.length)];
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
        if (y > canvas.height && random() > 0.975) {
          // Restart this stream from its exact initial seed and position.
          randoms[i] = createSeededRandom(seeds[i]);
          drops[i] = initialDrops[i];
          fadeCounters[i] = 0;
          continue;
        }

        // Advance one full glyph height so consecutive characters do not overlap.
        drops[i] += 1;
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
