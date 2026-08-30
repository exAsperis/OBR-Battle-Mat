import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBuiltInManifest, type BuiltInBackground } from "../config/builtInBackgrounds";
import { BuiltInGallery } from "./BuiltInGallery";

vi.mock("../config/builtInBackgrounds", async (importOriginal) => ({
  ...await importOriginal<typeof import("../config/builtInBackgrounds")>(),
  fetchBuiltInManifest: vi.fn(),
}));

const background: BuiltInBackground = {
  name: "Stone Floor",
  file: "stone.webp",
  columns: 8,
  rows: 6,
  rights: { creator: "ex Asperis", license: "CC0" },
  ai: true,
  collection: ["Interior", "Fantasy"],
  url: "https://example.com/backgrounds/stone.webp",
  mime: "image/webp",
};

describe("BuiltInGallery", () => {
  beforeEach(() => vi.mocked(fetchBuiltInManifest).mockReset());

  it("loads the gallery and selects a background", async () => {
    const onSelect = vi.fn();
    vi.mocked(fetchBuiltInManifest).mockResolvedValue({ version: 1, images: [background] });
    const { container } = render(<BuiltInGallery busy={false} onBack={vi.fn()} onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole("button", { name: /Stone Floor/ }));
    expect(screen.getByText("8 × 6 cells")).toBeTruthy();
    expect(screen.getByText("ex Asperis")).toBeTruthy();
    expect(screen.getByText("CC0")).toBeTruthy();
    expect(screen.getByText("ex Asperis").getAttribute("title")).toBeNull();
    expect(screen.getByLabelText("Made with generative AI")).toBeTruthy();
    expect(container.querySelector(".background-preview img")?.getAttribute("loading")).toBe("lazy");
    expect(onSelect).toHaveBeenCalledWith(background);
  });

  it("shows the empty state", async () => {
    vi.mocked(fetchBuiltInManifest).mockResolvedValue({ version: 1, images: [] });
    render(<BuiltInGallery busy={false} onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(await screen.findByText("No public backgrounds are available yet.")).toBeTruthy();
  });

  it("filters by collection and can hide AI images", async () => {
    const natural = { ...background, name: "Meadow", url: "https://example.com/backgrounds/meadow.webp", collection: ["Natural"], ai: false };
    vi.mocked(fetchBuiltInManifest).mockResolvedValue({ version: 1, images: [background, natural] });
    render(<BuiltInGallery busy={false} onBack={vi.fn()} onSelect={vi.fn()} />);
    await screen.findByRole("button", { name: /Stone Floor/ });

    fireEvent.change(screen.getByLabelText("Collection"), { target: { value: "Natural" } });
    expect(screen.queryByRole("button", { name: /Stone Floor/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Meadow/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Collection"), { target: { value: "Fantasy" } });
    expect(screen.getByRole("button", { name: /Stone Floor/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Collection"), { target: { value: "all" } });
    fireEvent.click(screen.getByLabelText("Hide AI"));
    expect(screen.queryByRole("button", { name: /Stone Floor/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Meadow/ })).toBeTruthy();
  });

  it("shows an error and retries", async () => {
    vi.mocked(fetchBuiltInManifest)
      .mockRejectedValueOnce(new Error("The catalog is malformed."))
      .mockResolvedValueOnce({ version: 1, images: [background] });
    render(<BuiltInGallery busy={false} onBack={vi.fn()} onSelect={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Stone Floor/ })).toBeTruthy();
    expect(fetchBuiltInManifest).toHaveBeenCalledTimes(2);
  });

  it("refreshes an already loaded catalog", async () => {
    vi.mocked(fetchBuiltInManifest).mockResolvedValue({ version: 1, images: [background] });
    render(<BuiltInGallery busy={false} onBack={vi.fn()} onSelect={vi.fn()} />);
    await screen.findByRole("button", { name: /Stone Floor/ });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchBuiltInManifest).toHaveBeenCalledTimes(2));
  });
});
