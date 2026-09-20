/**
 * Language → colour for the Finder sidebar tags and file rows.
 *
 * Known languages use their GitHub Linguist colour; anything else gets a
 * deterministic colour from a small palette so the dot is stable across
 * renders and reloads without a network lookup.
 */

const LANGUAGE_COLORS: Record<string, string> = {
  "Objective-C": "#438eff",
  "Objective-C++": "#6866fb",
  Assembly: "#6E4C13",
  Astro: "#ff5a03",
  C: "#555555",
  "C#": "#178600",
  "C++": "#f34b7d",
  Clojure: "#db5855",
  CoffeeScript: "#244776",
  CSS: "#563d7c",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Erlang: "#B83998",
  Go: "#00ADD8",
  Groovy: "#4298b8",
  Haskell: "#5e5086",
  HTML: "#e34c26",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  Julia: "#a270ba",
  Kotlin: "#A97BFF",
  Lua: "#000080",
  Makefile: "#427819",
  MDX: "#fcb32c",
  Nim: "#ffc200",
  Nix: "#7e7eff",
  OCaml: "#ef7a08",
  Perl: "#0298c3",
  PHP: "#4F5D95",
  PowerShell: "#012456",
  Python: "#3572A5",
  R: "#198CE7",
  Ruby: "#701516",
  Rust: "#dea584",
  Scala: "#c22d40",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Svelte: "#ff3e00",
  Swift: "#F05138",
  TypeScript: "#3178c6",
  Verilog: "#b2b7f8",
  VimScript: "#199f4b",
  Vue: "#41b883",
  Zig: "#ec915c",
};

const FALLBACK_COLORS = [
  "#6e7681",
  "#8b949e",
  "#a270ba",
  "#4f8cc9",
  "#c0616b",
  "#57a877",
  "#b58a4c",
  "#7d7fd4",
];

export const UNKNOWN_LANGUAGE_COLOR = "#6e7681";

export function languageColor(language?: string | null): string {
  if (!language) return UNKNOWN_LANGUAGE_COLOR;
  const known = LANGUAGE_COLORS[language];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < language.length; i += 1) {
    hash = (hash * 31 + language.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
