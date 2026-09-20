import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Finder, type FinderProject } from "./finder";
import { languageColor } from "./languages";

const PROJECTS: FinderProject[] = [
  {
    name: "tetris-silicon",
    description: "A Rust terminal Tetris",
    language: "Rust",
    stars: 1,
    url: "https://github.com/octo/tetris-silicon",
    topics: ["game"],
    isPinned: true,
  },
  {
    name: "crud-platform",
    description: "Symfony microservices",
    language: "PHP",
    stars: 2,
    url: "https://github.com/octo/crud-platform",
    topics: ["backend"],
    isPinned: false,
  },
  {
    name: "nexus-chat",
    description: "Slack-like IM",
    language: "TypeScript",
    stars: 0,
    url: "https://github.com/octo/nexus-chat",
    topics: ["im"],
    isPinned: false,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ repos: PROJECTS }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderFinder(props: Parameters<typeof Finder>[0] = {}) {
  return render(<Finder {...props} />);
}

describe("Finder", () => {
  it("loads projects dynamically and renders each as a file", async () => {
    renderFinder();
    expect(screen.getByText("Loading projects…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("tetris-silicon")).toBeInTheDocument());
    expect(screen.getByText("crud-platform")).toBeInTheDocument();
    expect(screen.getByText("nexus-chat")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("lists languages under the Tags section with a coloured dot", async () => {
    const { container } = renderFinder();
    await waitFor(() => expect(screen.getByText("tetris-silicon")).toBeInTheDocument());

    const tagsHeading = screen.getByText("Tags");
    expect(tagsHeading).toBeInTheDocument();

    // Rust / PHP / TypeScript tag entries each carry a dot with their colour.
    for (const language of ["Rust", "PHP", "TypeScript"]) {
      expect(screen.getAllByText(language).length).toBeGreaterThan(0);
    }
    const dots = container.querySelectorAll(".finder-sidebar-item .finder-tag-dot");
    const colors = [...dots].map((dot) => (dot as HTMLElement).style.background);
    expect(colors).toContain("rgb(222, 165, 132)"); // Rust #dea584
    expect(colors).toContain("rgb(79, 93, 149)"); // PHP #4F5D95
  });

  it("filters by clicking a language tag", async () => {
    renderFinder();
    await waitFor(() => expect(screen.getByText("crud-platform")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Rust/ }));
    expect(screen.getByText("tetris-silicon")).toBeInTheDocument();
    expect(screen.queryByText("crud-platform")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("filters by the Pinned collection", async () => {
    renderFinder();
    await waitFor(() => expect(screen.getByText("tetris-silicon")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Pinned/ }));
    expect(screen.getByText("tetris-silicon")).toBeInTheDocument();
    expect(screen.queryByText("nexus-chat")).toBeNull();
  });

  it("filters by the search box (name, description, topics)", async () => {
    renderFinder();
    await waitFor(() => expect(screen.getByText("nexus-chat")).toBeInTheDocument());

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "symfony" } });
    expect(screen.getByText("crud-platform")).toBeInTheDocument();
    expect(screen.queryByText("nexus-chat")).toBeNull();
  });

  it("opens a project on double-click via onOpenProject", async () => {
    const onOpenProject = vi.fn();
    renderFinder({ onOpenProject });
    await waitFor(() => expect(screen.getByText("crud-platform")).toBeInTheDocument());

    fireEvent.doubleClick(screen.getByText("crud-platform"));
    expect(onOpenProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "crud-platform" }),
    );
  });

  it("on coarse pointers a second tap opens the project", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(pointer: coarse)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      })),
    );
    const onOpenProject = vi.fn();
    renderFinder({ onOpenProject });
    await waitFor(() => expect(screen.getByText("crud-platform")).toBeInTheDocument());

    const file = screen.getByText("crud-platform").closest("button") as HTMLButtonElement;
    fireEvent.click(file);
    expect(onOpenProject).not.toHaveBeenCalled();
    fireEvent.click(file);
    expect(onOpenProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "crud-platform" }),
    );
  });

  it("surfaces a load error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })),
    );
    renderFinder();
    await waitFor(() =>
      expect(screen.getByText(/request failed \(502\)/)).toBeInTheDocument(),
    );
  });

  it("falls back to a stable colour for unknown languages", () => {
    expect(languageColor("Rust")).toBe("#dea584");
    expect(languageColor("Brainfuck")).toBe(languageColor("Brainfuck"));
    expect(languageColor(null)).toBe("#6e7681");
  });
});
