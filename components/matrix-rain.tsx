"use client";

import { useEffect, useRef } from "react";

interface Drop {
  y: number;
  speed: number;
  chars: string[];
  length: number;
}

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Matrix characters
    const chars =
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    const charArray = chars.split("");

    const fontSize = 14;
    const columnSpacing = 32;

    let columns: number;
    let drops: Drop[];

    const randomChar = () => charArray[Math.floor(Math.random() * charArray.length)];

    const createDrop = (startY: number): Drop => {
      const length = Math.floor(Math.random() * 15) + 5; // 5-20 chars
      const dropChars: string[] = [];
      for (let i = 0; i < length; i++) {
        dropChars.push(randomChar());
      }
      return {
        y: startY,
        speed: Math.random() * 0.3 + 0.2, // 0.2-0.5
        chars: dropChars,
        length,
      };
    };

    const initializeDrops = () => {
      columns = Math.floor(canvas.width / columnSpacing);
      drops = [];
      for (let i = 0; i < columns; i++) {
        // Stagger initial positions
        drops.push(createDrop(Math.random() * -canvas.height / fontSize));
      }
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeDrops();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Semi-transparent overlay for trail effect (classic Matrix look)
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        const x = i * columnSpacing + columnSpacing / 2;

        // Only draw the head character each frame (trail comes from fade effect)
        const headY = drop.y * fontSize;

        if (headY > 0 && headY < canvas.height + fontSize) {
          // Bright head character
          ctx.fillStyle = "rgba(180, 255, 180, 0.95)";
          ctx.fillText(drop.chars[0], x, headY);

          // Draw a few trailing chars with decreasing brightness
          for (let j = 1; j < Math.min(4, drop.length); j++) {
            const trailY = (drop.y - j) * fontSize;
            if (trailY > 0) {
              const opacity = 0.6 - j * 0.15;
              ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
              
              // Occasionally change characters for flicker effect
              if (Math.random() > 0.95) {
                drop.chars[j] = randomChar();
              }
              ctx.fillText(drop.chars[j], x, trailY);
            }
          }
        }

        // Move drop down
        drop.y += drop.speed;

        // Reset when off screen
        if (drop.y * fontSize > canvas.height + fontSize * 5) {
          drops[i] = createDrop(-Math.random() * 10);
        }
      }
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
      className="fixed inset-0 pointer-events-none opacity-80"
      style={{ zIndex: 0 }}
    />
  );
}
