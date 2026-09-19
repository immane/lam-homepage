import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MarkdownPreview } from "@/components/markdown-preview";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function setup(content: string, path = "README.md") {
  const onNavigate = vi.fn();
  const result = render(
    <MarkdownPreview content={content} owner="o" repository="r" path={path} onNavigate={onNavigate} />,
  );
  return { ...result, onNavigate };
}

describe("MarkdownPreview", () => {
  it("GFM 基础渲染：标题/列表/表格/任务列表能渲染", () => {
    const { container } = setup(
      `# Title\n\n- item1\n- item2\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n`,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("item1")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("tbody")).not.toBeNull();
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });

  it("标题 anchor：## Hello World 渲染出 id=user-content-hello-world 的 h2", () => {
    const { container } = setup("## Hello World\n");
    const h2 = container.querySelector("h2#user-content-hello-world");
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toContain("Hello World");
  });

  it("同文件 TOC 链接点击不跳页且目标标题 scrollIntoView 被调用", () => {
    const original = HTMLElement.prototype.scrollIntoView;
    const hadNative = typeof original === "function";
    const mock = vi.fn();
    HTMLElement.prototype.scrollIntoView = mock as unknown as typeof HTMLElement.prototype.scrollIntoView;
    try {
      const hashBefore = window.location.hash;
      setup("## Hello World\n\n[x](#hello-world)\n");
      const link = screen.getByText("x");
      fireEvent.click(link);
      expect(window.location.hash).toBe(hashBefore);
      expect(mock).toHaveBeenCalled();
    } finally {
      if (hadNative) {
        HTMLElement.prototype.scrollIntoView = original;
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)["scrollIntoView"];
      }
    }
  });

  it("图片：md 图片 src 解析为 /api/github/o/r/contents 且 path=docs/a.png、raw=1", () => {
    const { container } = setup("![](docs/a.png)\n");
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    const src = img!.getAttribute("src") ?? "";
    expect(src).toContain("/api/github/o/r/contents");
    expect(src).toContain("raw=1");
    const url = new URL(src, "http://localhost");
    expect(url.searchParams.get("path")).toBe("docs/a.png");
    expect(url.searchParams.get("raw")).toBe("1");
  });

  it("图片：HTML <img src='./b.png'> 同样被解析", () => {
    const { container } = setup('<img src="./b.png" alt="b">\n');
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    const src = img!.getAttribute("src") ?? "";
    expect(src).toContain("/api/github/o/r/contents");
    const url = new URL(src, "http://localhost");
    expect(url.searchParams.get("path")).toBe("b.png");
    expect(url.searchParams.get("raw")).toBe("1");
  });

  it("图片：点击弹出 lightbox，点遮罩后消失", () => {
    const { container } = setup("![](docs/a.png)\n");
    const img = container.querySelector("img") as HTMLElement;
    fireEvent.click(img);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("图片：点击弹出 lightbox，点右上关闭按钮后消失", () => {
    const { container } = setup("![](docs/a.png)\n");
    const img = container.querySelector("img") as HTMLElement;
    fireEvent.click(img);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close image preview"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("图片：a > img（链接图片）点击不弹 lightbox", () => {
    const { container } = setup("[![alt](docs/a.png)](docs/b.md)\n");
    const img = container.querySelector("a img") as HTMLElement;
    expect(img).not.toBeNull();
    fireEvent.click(img);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("代码块：无语言围栏块保留换行（pre > code 且文本含 \\n）", () => {
    const { container } = setup("```\nline1\nline2\n```\n");
    const code = container.querySelector("pre > code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("line1");
    expect(code!.textContent).toContain("line2");
    expect(code!.textContent).toContain("\n");
  });

  it("代码块：有语言块走高亮（代码文本存在且不在裸 pre > code 里）", async () => {
    const { container } = setup("```js\nconst a = 1;\n```\n");
    await waitFor(() => {
      expect(container.textContent).toContain("const");
    });
    const highlighted = container.querySelector(".code-preview-content");
    expect(highlighted).not.toBeNull();
    expect(highlighted!.textContent).toContain("const a = 1;");
    expect(container.querySelector("pre > code:not(.code-preview-content)")).toBeNull();
  });

  it("代码块：行内 code 行内渲染", () => {
    const { container } = setup("Use `hi` here\n");
    const code = container.querySelector("p > code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("hi");
    expect(code!.closest("pre")).toBeNull();
  });

  it("安全：markdown 中的 script 不执行不渲染", () => {
    const { container } = setup("hello\n\n<script>alert(1)</script>\n");
    expect(container.querySelector("script")).toBeNull();
  });

  it("安全：style 块被剥离", () => {
    const { container } = setup("<style>body{color:red}</style>\n\nhello\n");
    expect(container.querySelector("style")).toBeNull();
  });

  it("安全：javascript: 链接被中和", () => {
    setup("[x](javascript:alert(1))\n");
    const link = screen.getByText("x").closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("链接：相对路径点击调用 onNavigate 且参数为 docs/b.md", () => {
    const { onNavigate } = setup("[x](docs/b.md)\n");
    fireEvent.click(screen.getByText("x"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("docs/b.md");
  });

  it("链接：站外链接带 target=_blank", () => {
    setup("[x](https://example.com)\n");
    const link = screen.getByText("x").closest("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("target", "_blank");
  });
});
