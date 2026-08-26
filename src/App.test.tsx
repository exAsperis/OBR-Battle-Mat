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

  it("opens the built-in gallery and returns to both source buttons", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Built-in backgrounds" }));
    expect(screen.getByText("Built-in gallery")).toBeTruthy();
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
    expect(screen.queryByRole("button", { name: "Built-in backgrounds" })).toBeNull();
    expect(screen.queryByRole("button", { name: "My OBR maps" })).toBeNull();
  });
});
