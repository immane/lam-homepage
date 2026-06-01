"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingTextProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  showCursor?: boolean;
}

export function TypingText({
  text,
  className,
  speed = 50,
  delay = 0,
  showCursor = true,
}: TypingTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsTyping(true);
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return (
    <span className={cn("font-mono", className)}>
      {displayText}
      {showCursor && (
        <span
          className={cn(
            "inline-block w-[2px] h-[1em] bg-primary ml-1 align-middle",
            isTyping ? "animate-pulse" : "animate-[blink_1s_infinite]"
          )}
          style={{
            animation: isTyping ? "none" : "blink 1s step-end infinite",
          }}
        />
      )}
    </span>
  );
}
