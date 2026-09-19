import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RepositoryBrowser } from "@/components/repository-browser";

// jsdom has no matchMedia: stub the shape used by the component
// (component only reads `.matches` once on mount).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// react-resizable-panels expects ResizeObserver in some environments.
if (typeof window.ResizeObserver === "undefined") {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: NoopResizeObserver,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type TestEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
};

function dirResponse(path: string, entries: TestEntry[]) {
  return { kind: "directory" as const, path, entries };
}

function fileResponse(
  entryPath: string,
  name: string,
  content: string | null,
  canPreview = true,
) {
  return {
    kind: "file" as const,
    entry: { name, path: entryPath, type: "file" as const, size: content?.length ?? 0 },
    downloadUrl: `https://example.com/${entryPath}`,
    content,
    canPreview,
  };
}

function stubFetch(routes: Record<string, unknown>) {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
    const url = new URL(raw, "http://localhost");
    const path = url.searchParams.get("path") ?? "";
    const data = routes[path];
    if (!data) {
      return { ok: false, json: async () => ({ error: `not found: ${path}` }) };
    }
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function sidebar() {
  return screen.getByLabelText("Repository files");
}

function pathNav() {
  return screen.getByLabelText("Repository path");
}

describe("RepositoryBrowser", () => {
  it("initially loads the root directory and auto-selects README.md (real MarkdownPreview)", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 20 },
        { name: "index.ts", path: "index.ts", type: "file", size: 10 },
        { name: "docs", path: "docs", type: "dir", size: 0 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Hello World\n\nintro"),
      "index.ts": fileResponse("index.ts", "index.ts", "const x = 1;\n", true),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);

    // Sidebar lists root entries.
    await within(sidebar()).findByText("README.md");
    expect(within(sidebar()).getByText("index.ts")).toBeInTheDocument();
    expect(within(sidebar()).getByText("docs")).toBeInTheDocument();

    // README is auto-selected and rendered through the real MarkdownPreview.
    await screen.findByRole("heading", { name: "Hello World" });
    await waitFor(() => {
      expect(document.querySelector(".repository-preview header")?.textContent).toBe("README.md");
    });

    // Root breadcrumb renders as current "root".
    expect(within(pathNav()).getByText("root")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("enters a directory on click", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "docs", path: "docs", type: "dir", size: 0 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root Readme\n"),
      docs: dirResponse("docs", [{ name: "guide.md", path: "docs/guide.md", type: "file", size: 8 }]),
      "docs/guide.md": fileResponse("docs/guide.md", "guide.md", "# Guide\n"),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await within(sidebar()).findByText("docs");

    fireEvent.click(within(sidebar()).getByRole("button", { name: /docs/ }));

    // Directory content loads and its default file is previewed.
    await within(sidebar()).findByText("guide.md");
    await waitFor(() => {
      expect(document.querySelector(".repository-preview header")?.textContent).toBe("docs/guide.md");
    });
    expect(within(pathNav()).getByText("docs")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("renders breadcrumb root / a / b and clicking a middle node goes back", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "a", path: "a", type: "dir", size: 0 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root\n"),
      a: dirResponse("a", [
        { name: "b", path: "a/b", type: "dir", size: 0 },
        { name: "note.txt", path: "a/note.txt", type: "file", size: 4 },
      ]),
      "a/note.txt": fileResponse("a/note.txt", "note.txt", "note body"),
      "a/b": dirResponse("a/b", [{ name: "deep.txt", path: "a/b/deep.txt", type: "file", size: 4 }]),
      "a/b/deep.txt": fileResponse("a/b/deep.txt", "deep.txt", "deep body"),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await within(sidebar()).findByText("a");

    fireEvent.click(within(sidebar()).getByRole("button", { name: "#a" }));
    await within(sidebar()).findByText("b");

    fireEvent.click(within(sidebar()).getByRole("button", { name: "#b" }));
    await within(sidebar()).findByText("deep.txt");

    // Breadcrumb: root button, "a" button, "b" current.
    const nav = pathNav();
    await waitFor(() => {
      expect(within(nav).getByRole("button", { name: "root" })).toBeInTheDocument();
    });
    expect(within(nav).getByRole("button", { name: "a" })).toBeInTheDocument();
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("b");

    // Clicking the middle node returns to that directory.
    fireEvent.click(within(nav).getByRole("button", { name: "a" }));
    await within(sidebar()).findByText("note.txt");
    await waitFor(() => {
      expect(document.querySelector(".repository-preview header")?.textContent).toBe("a/note.txt");
    });
    vi.unstubAllGlobals();
  });

  it("shows a code preview when clicking a text file", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "app.ts", path: "app.ts", type: "file", size: 40 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root\n"),
      "app.ts": fileResponse("app.ts", "app.ts", 'const greeting = "hello-code";\nconsole.log(greeting);\n'),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await within(sidebar()).findByText("app.ts");

    fireEvent.click(within(sidebar()).getByRole("button", { name: /app\.ts/ }));

    await waitFor(() => {
      expect(document.querySelector(".repository-preview header")?.textContent).toBe("app.ts");
    });
    // Syntax highlighting splits tokens across spans, so assert on full text.
    await waitFor(() => {
      expect(document.querySelector(".repository-preview")?.textContent).toContain("hello-code");
    });
    vi.unstubAllGlobals();
  });

  it("shows a markdown preview when clicking an md file", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "notes.md", path: "notes.md", type: "file", size: 20 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root Title\n"),
      "notes.md": fileResponse("notes.md", "notes.md", "## Notes Heading\n\nsome body\n"),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await screen.findByRole("heading", { name: "Root Title" });

    fireEvent.click(within(sidebar()).getByRole("button", { name: /notes\.md/ }));

    await screen.findByRole("heading", { name: "Notes Heading" });
    await waitFor(() => {
      expect(document.querySelector(".repository-preview header")?.textContent).toBe("notes.md");
    });
    vi.unstubAllGlobals();
  });

  it("renders an img with raw=1 src for .png files", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "logo.png", path: "logo.png", type: "file", size: 123 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root\n"),
      "logo.png": fileResponse("logo.png", "logo.png", null, true),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await within(sidebar()).findByText("logo.png");

    fireEvent.click(within(sidebar()).getByRole("button", { name: /logo\.png/ }));

    const img = (await screen.findByAltText("logo.png")) as HTMLImageElement;
    expect(img.tagName.toLowerCase()).toBe("img");
    expect(img.getAttribute("src")).toContain("raw=1");
    expect(img.getAttribute("src")).toContain("logo.png");
    expect(img.getAttribute("src")).toContain("/api/github/acme/demo/contents");
    vi.unstubAllGlobals();
  });

  it("shows the binary/preview-limit message for non-previewable files", async () => {
    stubFetch({
      "": dirResponse("", [
        { name: "README.md", path: "README.md", type: "file", size: 5 },
        { name: "bundle.zip", path: "bundle.zip", type: "file", size: 9999999 },
      ]),
      "README.md": fileResponse("README.md", "README.md", "# Root\n"),
      "bundle.zip": fileResponse("bundle.zip", "bundle.zip", null, false),
    });

    render(<RepositoryBrowser owner="acme" repository="demo" />);
    await within(sidebar()).findByText("bundle.zip");

    fireEvent.click(within(sidebar()).getByRole("button", { name: /bundle\.zip/ }));

    await screen.findByText("This file is binary or exceeds the 1 MB preview limit.");
    vi.unstubAllGlobals();
  });
});
