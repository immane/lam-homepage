import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WebWindow } from "./window";

afterEach(() => {
  cleanup();
});

describe("WebWindow", () => {
  it("renders the host content via renderContent", () => {
    render(
      <WebWindow
        id="win-1"
        label="octo/hello"
        active
        onClose={() => {}}
        renderContent={() => <div data-testid="body">body</div>}
      />,
    );
    expect(screen.getByTestId("body")).toBeInTheDocument();
    expect(screen.queryByRole("iframe")).toBeNull();
  });

  it("shows label/address and falls back to the address from label", () => {
    const { container } = render(
      <WebWindow
        id="win-addr"
        label="title"
        active
        onClose={() => {}}
        renderContent={() => <div />}
      />,
    );
    expect(container.querySelector(".web-window-address")?.textContent).toContain(
      "title",
    );
  });

  it("renders host-supplied actions", () => {
    render(
      <WebWindow
        id="win-actions"
        label="x"
        active
        onClose={() => {}}
        actions={<a href="https://example.com">link</a>}
        renderContent={() => <div />}
      />,
    );
    expect(screen.getByText("link")).toBeInTheDocument();
  });

  it("closable=false disables the close control; click and Escape do not close", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-locked"
        label="locked"
        active
        onClose={onClose}
        closable={false}
        renderContent={() => <div />}
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

  it("the minimize control calls onMinimize(id)", () => {
    const onMinimize = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-min"
        label="min"
        active
        minimized={false}
        onClose={() => {}}
        onMinimize={onMinimize}
        renderContent={() => <div />}
      />,
    );
    const minBtn = container.querySelector(".web-window-minimize") as HTMLElement;
    expect(minBtn).not.toBeNull();
    fireEvent.click(minBtn);
    expect(onMinimize).toHaveBeenCalledWith("win-min");
  });

  it("when minimized renders a dock entry; clicking it calls onRestore", () => {
    const onRestore = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-dock"
        label="octo/hello"
        active
        minimized
        onClose={() => {}}
        onRestore={onRestore}
        renderContent={() => <div data-testid="body" />}
      />,
    );
    expect(container.querySelector(".web-window-minimized-dock")).not.toBeNull();
    // The body is not mounted while minimized.
    expect(screen.queryByTestId("body")).toBeNull();
    // mount's useEffect([id]) may fire a spurious onRestore in controlled mode.
    onRestore.mockClear();
    const restoreBar = container.querySelector(
      ".web-window-minimized-bar",
    ) as HTMLElement;
    fireEvent.click(restoreBar);
    expect(onRestore).toHaveBeenCalledWith("win-dock");
  });

  it("renders the custom icon in the dock when provided", () => {
    const { container } = render(
      <WebWindow
        id="win-icon"
        label="Linux Shell"
        active
        minimized
        onClose={() => {}}
        icon={<svg data-testid="glyph" />}
        renderContent={() => <div />}
      />,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    expect(container.querySelector(".web-window-minimized-dot")).toBeNull();
  });

  it("the dock close button calls onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-dock-close"
        label="dock"
        active
        minimized
        onClose={onClose}
        renderContent={() => <div />}
      />,
    );
    const closeBtn = container.querySelector(
      ".web-window-minimized-close",
    ) as HTMLElement;
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith("win-dock-close");
  });

  it("Escape closes an active window, but not after it becomes inactive", () => {
    const onClose = vi.fn();
    const props = { id: "win-esc", label: "esc", onClose } as const;
    const { rerender } = render(<WebWindow {...props} active renderContent={() => <div />} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("win-esc");

    onClose.mockClear();
    rerender(<WebWindow {...props} active={false} renderContent={() => <div />} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("inactive window forwards wheel to [data-window-scroll] without focusing", () => {
    const onFocus = vi.fn();
    const { container } = render(
      <WebWindow
        id="win-wheel"
        label="wheel"
        active={false}
        onClose={() => {}}
        onFocus={onFocus}
        renderContent={() => (
          <div data-window-scroll style={{ overflow: "auto" }}>
            <div style={{ height: 500 }}>content</div>
          </div>
        )}
      />,
    );
    const overlay = container.querySelector(
      ".web-window-inactive-overlay",
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    const scroller = container.querySelector(
      "[data-window-scroll]",
    ) as HTMLElement | null;
    expect(scroller).not.toBeNull();

    let scrollTopValue = 0;
    Object.defineProperty(scroller!, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(scroller!, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(scroller!, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (v: number) => {
        scrollTopValue = v;
      },
    });

    overlay!.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
    );

    expect(scroller!.scrollTop).toBe(100);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("does not render the focus overlay while active", () => {
    const { container } = render(
      <WebWindow id="win-active" label="active" active onClose={() => {}} renderContent={() => <div />} />,
    );
    expect(container.querySelector(".web-window-inactive-overlay")).toBeNull();
  });

  it("returns null without renderContent", () => {
    const { container } = render(
      <WebWindow id="win-empty" label="empty" active onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
