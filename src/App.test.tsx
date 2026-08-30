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
  BuiltInGallery: ({ onBack }: { onBack: () => void }) => <div><span>Public gallery</span><button onClick={onBack}>Back</button></div>,
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

  it("opens the public gallery and returns to both source buttons", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Public backgrounds" }));
    expect(screen.getByText("Public gallery")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "My OBR maps" })).toBeTruthy();
  });

  it("continues to open the OBR map picker", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "My OBR maps" }));
    await waitFor(() => expect(sdk.downloadImages).toHaveBeenCalledWith(false, undefined, "MAP"));
  });

  it("does not expose background selection controls to players", () => {
    vi.mocked(useOwlbear).mockReturnValue(state("PLAYER"));
    render(<App />);
    expect(screen.queryByRole("button", { name: "Public backgrounds" })).toBeNull();
    expect(screen.queryByRole("button", { name: "My OBR maps" })).toBeNull();
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
