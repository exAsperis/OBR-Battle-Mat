import { describe, expect, it, vi } from "vitest";
import {
  configFromBuiltIn,
  configFromUrl,
  fetchBuiltInManifest,
  loadImageDimensions,
  mimeFromImageUrl,
  parseBuiltInManifest,
} from "./builtInBackgrounds";
import { backgroundMetadata, readBackgroundConfig } from "./sceneConfig";

const manifestUrl = "https://obr-battle-mat.ex-asperis.com/backgrounds/manifest.json";

describe("built-in image manifest", () => {
  it("parses entries in catalog order and resolves relative image URLs", () => {
    const result = parseBuiltInManifest({
      version: 1,
      images: [
        { name: "Stone", file: "stone.webp", columns: 8, rows: 6, rights: { creator: "Maker", license: "CC0", source: "Archive" }, ai: false, collection: ["Interior", "Fantasy"] },
        { name: "Water", file: "textures/water.png", columns: 4, rows: 4, rights: { creator: "Maker" }, ai: true, collection: ["Natural"] },
      ],
    }, manifestUrl);
    expect(result.images.map((image) => image.name)).toEqual(["Stone", "Water"]);
    expect(result.images[1]).toMatchObject({
      url: "https://obr-battle-mat.ex-asperis.com/backgrounds/textures/water.png",
      mime: "image/png",
      rights: { creator: "Maker" },
      ai: true,
      collection: ["Natural"],
    });
  });

  it("accepts cross-origin absolute HTTP(S) image URLs", () => {
    const result = parseBuiltInManifest({
      version: 1,
      images: [{ name: "Remote", file: "https://cdn.example.com/maps/remote.webp?rev=2", columns: 8, rows: 6, rights: { creator: "Maker" }, ai: false, collection: ["Remote"] }],
    }, manifestUrl);
    expect(result.images[0]).toMatchObject({ url: "https://cdn.example.com/maps/remote.webp?rev=2", mime: "image/webp" });
  });

  it.each([
    [{ version: 2, images: [] }],
    [{ version: 1, images: [{ name: "Bad", file: "bad.gif", columns: 1, rows: 1, rights: { creator: "Maker" }, ai: false, collection: ["Test"] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "bad.png", columns: 0, rows: 1, rights: { creator: "Maker" }, ai: false, collection: ["Test"] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "../bad.png", columns: 1, rows: 1, rights: { creator: "Maker" }, ai: false, collection: ["Test"] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "ftp://example.com/bad.png", columns: 1, rows: 1, rights: { creator: "Maker" }, ai: false, collection: ["Test"] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "bad.png", columns: 1, rows: 1, rights: { creator: "" }, ai: false, collection: ["Test"] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "bad.png", columns: 1, rows: 1, rights: { creator: "Maker" }, ai: false, collection: [] }] }],
    [{ version: 1, images: [{ name: "Bad", file: "bad.png", columns: 1, rows: 1, rights: { creator: "Maker" }, ai: false, collection: ["Test", "Test"] }] }],
  ])("rejects invalid manifest data", (value) => {
    expect(() => parseBuiltInManifest(value, manifestUrl)).toThrow();
  });

  it("requests fresh manifest data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ version: 1, images: [] })));
    await fetchBuiltInManifest(manifestUrl);
    expect(fetchMock).toHaveBeenCalledWith(manifestUrl, { cache: "no-store", signal: undefined });
    fetchMock.mockRestore();
  });
});

describe("image configuration", () => {
  it.each([
    ["https://example.com/a.png", "image/png"],
    ["https://example.com/a.jpg", "image/jpeg"],
    ["https://example.com/a.JPEG", "image/jpeg"],
    ["https://example.com/a.webp?revision=2", "image/webp"],
  ])("infers the MIME type for %s", (url, mime) => {
    expect(mimeFromImageUrl(url)).toBe(mime);
  });

  it("creates an exact column and row footprint", () => {
    const background = parseBuiltInManifest({
      version: 1,
      images: [{ name: "Stone", file: "stone.webp", columns: 8, rows: 6, rights: { creator: "Maker" }, ai: false, collection: ["Interior"] }],
    }, manifestUrl).images[0];
    const config = configFromBuiltIn(background, { width: 2048, height: 1536 });
    expect(config).toMatchObject({
      image: {
        width: 2048,
        height: 1536,
        mime: "image/webp",
        rights: { creator: "Maker" },
        ai: false,
        columns: 8,
        rows: 6,
      },
      grid: { dpi: 256, offset: { x: 0, y: 0 } },
      scale: { x: 1, y: 1 },
    });
    expect(readBackgroundConfig(backgroundMetadata(config))).toEqual(config);
  });

  it("does not apply scene DPI a second time for a 12 by 12 image", () => {
    const background = parseBuiltInManifest({
      version: 1,
      images: [{ name: "Marble tiles", file: "marble.png", columns: 12, rows: 12, rights: { creator: "Maker" }, ai: false, collection: ["Interior"] }],
    }, manifestUrl).images[0];
    expect(configFromBuiltIn(background, { width: 1158, height: 1158 })).toMatchObject({
      grid: { dpi: 96.5 },
      scale: { x: 1, y: 1 },
    });
  });

  it("creates URL image configuration without unverified rights metadata", () => {
    const config = configFromUrl({ url: "https://cdn.example.com/maps/Stone%20Floor.png?rev=4", columns: 10, rows: 5 }, { width: 2000, height: 1000 });
    expect(config).toMatchObject({
      enabled: true,
      image: { name: "Stone Floor", url: "https://cdn.example.com/maps/Stone%20Floor.png?rev=4", mime: "image/png", width: 2000, height: 1000, columns: 10, rows: 5 },
      grid: { dpi: 200 },
      scale: { x: 1, y: 1 },
    });
    expect(config.image).not.toHaveProperty("rights");
    expect(config.image).not.toHaveProperty("ai");
  });

  it.each([
    [{ url: "not-a-url", columns: 1, rows: 1 }, "absolute image URL"],
    [{ url: "data:image/png;base64,abc", columns: 1, rows: 1 }, "HTTP or HTTPS"],
    [{ url: "https://example.com/image.gif", columns: 1, rows: 1 }, "PNG, JPEG, or WebP"],
    [{ url: "https://example.com/image.png", columns: 0, rows: 1 }, "positive whole numbers"],
    [{ url: "https://example.com/image.png", columns: 1, rows: 1.5 }, "positive whole numbers"],
  ])("rejects invalid URL image input", (input, message) => {
    expect(() => configFromUrl(input, { width: 100, height: 100 })).toThrow(message);
  });

  it("discovers intrinsic browser image dimensions", async () => {
    const OriginalImage = globalThis.Image;
    class LoadedImage {
      naturalWidth = 1600;
      naturalHeight = 1200;
      src = "";
      decode = vi.fn().mockResolvedValue(undefined);
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: LoadedImage });
    await expect(loadImageDimensions("https://example.com/loaded.webp")).resolves.toEqual({ width: 1600, height: 1200 });
    Object.defineProperty(globalThis, "Image", { configurable: true, value: OriginalImage });
  });

  it("reports an unavailable image", async () => {
    const OriginalImage = globalThis.Image;
    class BrokenImage {
      naturalWidth = 0;
      naturalHeight = 0;
      src = "";
      decode = vi.fn().mockRejectedValue(new Error("missing"));
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: BrokenImage });
    await expect(loadImageDimensions("https://example.com/missing.webp")).rejects.toThrow("could not be loaded");
    Object.defineProperty(globalThis, "Image", { configurable: true, value: OriginalImage });
  });

  it("requests an anonymous CORS image for Owlbear compatibility checks", async () => {
    const OriginalImage = globalThis.Image;
    let created: { crossOrigin: string | null } | undefined;
    class LoadedImage {
      naturalWidth = 512;
      naturalHeight = 256;
      crossOrigin: string | null = null;
      src = "";
      decode = vi.fn().mockResolvedValue(undefined);
      constructor() { created = this; }
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: LoadedImage });
    await expect(loadImageDimensions("https://example.com/cors.webp", true)).resolves.toEqual({ width: 512, height: 256 });
    expect(created?.crossOrigin).toBe("anonymous");
    Object.defineProperty(globalThis, "Image", { configurable: true, value: OriginalImage });
  });
});
