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
      // Clear entire canvas with solid black each frame
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        const x = i * columnSpacing + columnSpacing / 2;

        // Draw each character in the drop with fading opacity
        for (let j = 0; j < drop.length; j++) {
          const charY = (drop.y - j) * fontSize;

          // Skip if off screen
          if (charY < -fontSize || charY > canvas.height + fontSize) continue;

          // Calculate opacity: head is brightest, tail fades out
          const fadeRatio = j / drop.length;

          if (j === 0) {
            // Head character - bright white/green
            ctx.fillStyle = "rgba(200, 255, 200, 0.75)";
          } else if (j < 10) {
            // Near head - bright green
            ctx.fillStyle = `rgba(0, 255, 65, ${0.7 - fadeRatio * 0.3})`;
          } else {
            // Tail - fading green
            const opacity = Math.max(0.05, 0.4 * (1 - fadeRatio));
            ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
          }

          // Occasionally change a character
          if (Math.random() > 0.98) {
            drop.chars[j] = randomChar();
          }

          ctx.fillText(drop.chars[j], x, charY);
        }

        // Move drop down
        drop.y += drop.speed;

        // Reset when entire drop is off screen
        if ((drop.y - drop.length) * fontSize > canvas.height) {
          drops[i] = createDrop(-Math.random() * 20);
        }
      }
    };

    const interval = setInterval(draw, 45);

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
