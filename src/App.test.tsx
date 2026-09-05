import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useOwlbear } from "./hooks/useOwlbear";

const sdk = vi.hoisted(() => ({
  downloadImages: vi.fn(),
  getRole: vi.fn(),
  isReady: vi.fn(),
  setMetadata: vi.fn(),
  getDpi: vi.fn(),
}));

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    assets: { downloadImages: sdk.downloadImages },
    player: { getRole: sdk.getRole },
    scene: {
      isReady: sdk.isReady,
      setMetadata: sdk.setMetadata,
      grid: { getDpi: sdk.getDpi },
    },
  },
}));
vi.mock("./hooks/useOwlbear", () => ({ useOwlbear: vi.fn() }));
vi.mock("./hooks/useActionHeight", () => ({ useActionHeight: vi.fn() }));
vi.mock("./components/BuiltInGallery", () => ({
  BuiltInGallery: ({ onBack }: { onBack: () => void }) => <div><span>Built-in gallery</span><button onClick={onBack}>Back</button></div>,
}));

function state(role: "GM" | "PLAYER") {
  return { status: "ready" as const, role, sceneReady: true, config: null, error: null, refresh: vi.fn() };
}

describe("background source controls", () => {
  beforeEach(() => {
    vi.mocked(useOwlbear).mockReturnValue(state("GM"));
    sdk.downloadImages.mockReset().mockResolvedValue([]);
    sdk.getRole.mockReset().mockResolvedValue("GM");
    sdk.isReady.mockReset().mockResolvedValue(true);
    sdk.setMetadata.mockReset().mockResolvedValue(undefined);
  });

  it("shows the source heading and opens the built-in gallery", () => {
    render(<App />);
    expect(screen.getByText("New image from:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Built in" }));
    expect(screen.getByText("Built-in gallery")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "My OBR images" })).toBeTruthy();
  });

  it("continues to open the OBR map picker", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "My OBR images" }));
    await waitFor(() => expect(sdk.downloadImages).toHaveBeenCalledWith(false, undefined, "MAP"));
  });

  it("does not expose background selection controls to players", () => {
    vi.mocked(useOwlbear).mockReturnValue(state("PLAYER"));
    render(<App />);
    expect(screen.queryByRole("button", { name: "Built in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "My OBR images" })).toBeNull();
    expect(screen.queryByRole("button", { name: "URL" })).toBeNull();
    expect(screen.queryByText("New image from:")).toBeNull();
  });

  it("shows the URL form and licensing notice, then cancels without updating metadata", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "URL" }));
    expect(screen.getByText(/properly licensed for your intended use/i)).toBeTruthy();
    expect(screen.getByLabelText("Image URL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "URL" })).toBeTruthy();
    expect(sdk.setMetadata).not.toHaveBeenCalled();
  });

  it("rejects invalid URL form values without updating metadata", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "URL" }));
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.com/image.gif" } });
    expect((await screen.findByRole("alert")).textContent).toContain("PNG, JPEG, or WebP");
    expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
    expect(sdk.setMetadata).not.toHaveBeenCalled();
  });

  it("explains when a previewable image is not CORS-compatible with Owlbear", async () => {
    const OriginalImage = globalThis.Image;
    class CorsBlockedImage {
      naturalWidth = 0;
      naturalHeight = 0;
      crossOrigin: string | null = null;
      src = "";
      decode = vi.fn().mockRejectedValue(new Error("Network error"));
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: CorsBlockedImage });
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "URL" }));
      fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.com/blocked.png" } });
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("does not allow Owlbear-compatible cross-origin image loading");
      expect(alert.textContent).toContain("My OBR images");
      expect(screen.getByRole("button", { name: "Apply" }).hasAttribute("disabled")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "Image", { configurable: true, value: OriginalImage });
    }
  });

  it("loads a valid URL image and saves its grid footprint", async () => {
    const OriginalImage = globalThis.Image;
    class LoadedImage {
      naturalWidth = 2000;
      naturalHeight = 1000;
      src = "";
      decode = vi.fn().mockResolvedValue(undefined);
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: LoadedImage });
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "URL" }));
      fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://cdn.example.com/Stone%20Floor.webp" } });
      fireEvent.change(screen.getByLabelText("Columns"), { target: { value: "10" } });
      fireEvent.change(screen.getByLabelText("Rows"), { target: { value: "5" } });
      const apply = screen.getByRole("button", { name: "Apply" });
      await waitFor(() => expect(apply.hasAttribute("disabled")).toBe(false));
      expect(screen.getByText("Compatible image · 2000 × 1000px")).toBeTruthy();
      fireEvent.click(apply);
      await waitFor(() => expect(sdk.setMetadata).toHaveBeenCalledTimes(1));
      const metadata = sdk.setMetadata.mock.calls[0][0];
      const saved = Object.values(metadata)[0] as Record<string, unknown>;
      expect(saved).toMatchObject({
        enabled: true,
        image: { name: "Stone Floor", url: "https://cdn.example.com/Stone%20Floor.webp", width: 2000, height: 1000, columns: 10, rows: 5 },
        grid: { dpi: 200 },
      });
    } finally {
      Object.defineProperty(globalThis, "Image", { configurable: true, value: OriginalImage });
    }
  });

  it("shows public image rights with complete tooltips", () => {
    vi.mocked(useOwlbear).mockReturnValue({
      ...state("GM"),
      config: {
        version: 1,
        enabled: true,
        image: {
          name: "Stone",
          url: "https://example.com/stone.webp",
          mime: "image/webp",
          width: 1600,
          height: 1200,
          columns: 8,
          rows: 6,
          ai: false,
          rights: { creator: "Artist", license: "CC BY 4.0", sourceUrl: "https://example.com/source" },
        },
        grid: { dpi: 200, offset: { x: 0, y: 0 } },
        scale: { x: 1, y: 1 },
        origin: { x: 0, y: 0 },
      },
    });
    render(<App />);
    const creator = screen.getByText("Artist");
    const license = screen.getByText("CC BY 4.0");
    expect(creator.getAttribute("title")).toContain("Creator: Artist");
    expect(creator.getAttribute("title")).toContain("Source Url: https://example.com/source");
    expect(license.getAttribute("title")).toBe(creator.getAttribute("title"));
  });
});
