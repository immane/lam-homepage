"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function GlitchText({
  text,
  className,
  as: Component = "span",
}: GlitchTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setIsGlitching(true);
        const glitchChars = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`アイウエオ";
        let glitched = "";
        for (let i = 0; i < text.length; i++) {
          if (Math.random() > 0.7) {
            glitched += glitchChars[Math.floor(Math.random() * glitchChars.length)];
          } else {
            glitched += text[i];
          }
        }
        setDisplayText(glitched);

        setTimeout(() => {
          setDisplayText(text);
          setIsGlitching(false);
        }, 100);
      }
    }, 200);

    return () => clearInterval(glitchInterval);
  }, [text]);

  return (
    <Component
      className={cn(
        "relative inline-block",
        isGlitching && "animate-pulse",
        className
      )}
      style={{
        textShadow: isGlitching
          ? "2px 0 #ff0000, -2px 0 #00ffff"
          : "0 0 10px var(--matrix-green), 0 0 20px var(--matrix-green)",
      }}
    >
      {displayText}
    </Component>
  );
}
