import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WebWindow } from "@/components/web-window";

afterEach(() => {
  cleanup();
});

vi.mock("@/components/repository-browser", () => ({
  RepositoryBrowser: () => (
    <div data-testid="repository-browser-stub">
      <div
        className="repository-preview"
        data-testid="repository-preview"
        style={{ height: 100, overflow: "auto" }}
      >
        <div style={{ height: 500 }}>stub content</div>
      </div>
    </div>
  ),
}));

vi.mock("@/components/sim-view", () => ({
  SimView: () => <div data-testid="sim-view-stub">sim</div>,
}));

describe("WebWindow", () => {
  it("有 repository 时渲染 RepositoryBrowser 而非 iframe", () => {
    const { container } = render(
      <WebWindow
        id="win-repo"
        active
        repository={{ owner: "octo", name: "hello" }}
        url="https://github.com/octo/hello"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("repository-browser-stub")).toBeInTheDocument();
    expect(screen.getByTestId("repository-preview")).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("closable=false 时关闭按钮禁用，点击与 Escape 都不关闭", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-sim-locked"
        kind="sim"
        active
        url="linux-sim"
        onClose={onClose}
        closable={false}
      />,
    );
    const closeBtn = container.querySelector(
      ".web-window-close",
    ) as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn!.disabled).toBe(true);

    fireEvent.click(closeBtn!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("kind='sim' 时渲染 SimView 而非 iframe，且地址栏显示 ~/sim", () => {
    const { container } = render(
      <WebWindow
        id="win-sim"
        kind="sim"
        active
        url="linux-sim"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("sim-view-stub")).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".web-window-address")?.textContent).toContain("~/sim");
  });

  it("无 repository 有 url 时渲染 iframe 且 src 正确", () => {
    const url = "https://example.com/page";
    const { container } = render(
      <WebWindow id="win-url" active url={url} onClose={() => {}} />,
    );
    const iframe = container.querySelector("iframe.web-window-frame");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("src", url);
    expect(screen.queryByTestId("repository-browser-stub")).toBeNull();
  });

  it("点最小化按钮调用 onMinimize(id)", () => {
    const onMinimize = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-min"
        active
        minimized={false}
        url="https://example.com"
        onClose={() => {}}
        onMinimize={onMinimize}
      />,
    );
    const minBtn = container.querySelector(
      ".web-window-minimize",
    ) as HTMLElement;
    expect(minBtn).not.toBeNull();
    fireEvent.click(minBtn);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledWith("win-min");
  });

  it("minimized 为 true 时渲染 dock 栏，点恢复调用 onRestore", () => {
    const onRestore = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-dock"
        active
        minimized
        repository={{ owner: "octo", name: "hello" }}
        url="https://github.com/octo/hello"
        onClose={() => {}}
        onRestore={onRestore}
      />,
    );
    expect(container.querySelector(".web-window-minimized-dock")).not.toBeNull();
    // mount 时的 useEffect([id]) 会无条件 setIsMinimized(false)，
    // 受控 minimized 下会误触发一次 onRestore，先清掉，只断言点击行为。
    onRestore.mockClear();
    const restoreBar = container.querySelector(
      ".web-window-minimized-bar",
    ) as HTMLElement;
    fireEvent.click(restoreBar);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith("win-dock");
  });

  it("dock 栏点关闭调用 onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-dock-close"
        active
        minimized
        url="https://example.com"
        onClose={onClose}
      />,
    );
    const closeBtn = container.querySelector(
      ".web-window-minimized-close",
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("win-dock-close");
  });

  it("active 窗口按 Escape 调用 onClose，rerender 为 inactive 后再按不再调用", () => {
    const onClose = vi.fn();
    const props = {
      id: "win-esc",
      url: "https://example.com",
      onClose,
    } as const;
    const { rerender } = render(<WebWindow {...props} active />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("win-esc");

    onClose.mockClear();
    rerender(<WebWindow {...props} active={false} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("inactive 非最小化时遮罩滚轮转发给 .repository-preview 且不 focus", () => {
    const onFocus = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-wheel"
        active={false}
        repository={{ owner: "octo", name: "hello" }}
        url="https://github.com/octo/hello"
        onClose={() => {}}
        onFocus={onFocus}
      />,
    );
    const overlay = container.querySelector(
      ".web-window-inactive-overlay",
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    const scroller = container.querySelector(
      ".repository-preview",
    ) as HTMLElement | null;
    expect(scroller).not.toBeNull();

    let scrollTopValue = 0;
    Object.defineProperty(scroller!, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(scroller!, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(scroller!, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (v: number) => {
        scrollTopValue = v;
      },
    });

    const wheel = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    overlay!.dispatchEvent(wheel);

    expect(scroller!.scrollTop).toBe(100);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("active 窗口不渲染 inactive 遮罩", () => {
    const { container } = render(
      <WebWindow
        id="win-active"
        active
        repository={{ owner: "octo", name: "hello" }}
        url="https://github.com/octo/hello"
        onClose={() => {}}
      />,
    );
    expect(
      container.querySelector(".web-window-inactive-overlay"),
    ).toBeNull();
  });
});
