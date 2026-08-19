"use client";

import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("markup", markup);
SyntaxHighlighter.registerLanguage("php", php);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("yaml", yaml);

const languageAliases: Record<string, string> = {
  cjs: "javascript",
  cmd: "bash",
  console: "bash",
  dockerfile: "bash",
  htm: "markup",
  html: "markup",
  js: "javascript",
  jsonc: "json",
  jsx: "jsx",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  svg: "markup",
  toml: "yaml",
  ts: "typescript",
  tsx: "tsx",
  vue: "markup",
  xml: "markup",
  yml: "yaml",
};

const matrixTheme = {
  "code[class*='language-']": {
    color: "#d6ffe1",
    background: "transparent",
    textShadow: "0 0 8px rgba(0, 255, 65, 0.16)",
  },
  "comment": { color: "#5b9e6d" },
  "keyword": { color: "#78f4a1" },
  "string": { color: "#d6ff8d" },
  "function": { color: "#66d9ef" },
  "number": { color: "#ffbe76" },
  "boolean": { color: "#ff9ff3" },
  "operator": { color: "#a8f5c0" },
  "punctuation": { color: "#9db9a6" },
  "class-name": { color: "#f7dc6f" },
  "property": { color: "#80f5a5" },
};

function getLanguage(fileName?: string, language?: string) {
  const identifier = language || fileName?.split(".").pop() || "";
  return languageAliases[identifier.toLowerCase()] || identifier.toLowerCase() || "text";
}

interface CodePreviewProps {
  code: string;
  fileName?: string;
  language?: string;
}

export function CodePreview({ code, fileName, language }: CodePreviewProps) {
  return (
    <SyntaxHighlighter
      codeTagProps={{ className: "code-preview-content" }}
      customStyle={{ margin: 0, padding: "18px", background: "transparent", fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "1.65" }}
      language={getLanguage(fileName, language)}
      lineNumberStyle={{ color: "#397449", minWidth: "2.75em", paddingRight: "1em", textAlign: "right" }}
      showLineNumbers
      style={matrixTheme}
      wrapLongLines
    >
      {code}
    </SyntaxHighlighter>
  );
}
