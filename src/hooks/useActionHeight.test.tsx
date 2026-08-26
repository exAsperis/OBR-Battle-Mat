import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentHeight, MIN_ACTION_HEIGHT, useActionHeight } from "./useActionHeight";

const sdk = vi.hoisted(() => ({ onReady: vi.fn(), setHeight: vi.fn() }));
vi.mock("@owlbear-rodeo/sdk", () => ({
  default: { onReady: sdk.onReady, action: { setHeight: sdk.setHeight } },
}));

let resizeCallback: ResizeObserverCallback;
const disconnect = vi.fn();
class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
  observe = vi.fn();
  disconnect = disconnect;
}

describe("action popover height", () => {
  beforeEach(() => {
    sdk.onReady.mockReset().mockImplementation((callback: () => void) => callback());
    sdk.setHeight.mockReset().mockResolvedValue(undefined);
    disconnect.mockReset();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("applies a minimum without capping tall content", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ height: 90 } as DOMRect);
    expect(contentHeight(element)).toBe(MIN_ACTION_HEIGHT);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ height: 700 } as DOMRect);
    expect(contentHeight(element)).toBe(700);
  });

  it("resizes when the root content changes and cleans up", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 321.2 } as DOMRect);
    const { unmount } = renderHook(() => useActionHeight());
    await waitFor(() => expect(sdk.setHeight).toHaveBeenCalledWith(322));

    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 245 } as DOMRect);
    act(() => resizeCallback([], {} as ResizeObserver));
    await waitFor(() => expect(sdk.setHeight).toHaveBeenLastCalledWith(245));

    unmount();
    expect(disconnect).toHaveBeenCalled();
    root.remove();
  });
});
