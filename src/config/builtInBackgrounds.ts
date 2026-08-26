import type { BackgroundConfigV1 } from "../types";

export const BUILT_IN_MANIFEST_PATH = "/backgrounds/manifest.json";

export interface BuiltInBackground {
  name: string;
  file: string;
  columns: number;
  rows: number;
  url: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
}

export interface BuiltInManifest {
  version: 1;
  images: BuiltInBackground[];
}

export interface ImageDimensions {
  width: number;
  height: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function mimeFromImageUrl(url: string): BuiltInBackground["mime"] {
  const extension = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  throw new Error("Built-in backgrounds must be PNG, JPEG, or WebP images.");
}

export function parseBuiltInManifest(value: unknown, manifestUrl: string): BuiltInManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.images)) {
    throw new Error("The built-in background manifest is not valid version 1 data.");
  }

  const manifestBase = new URL("./", manifestUrl);
  const images = value.images.map((entry, index): BuiltInBackground => {
    if (!isRecord(entry)) throw new Error(`Built-in background ${index + 1} must be an object.`);
    const { name, file, columns, rows } = entry;
    if (typeof name !== "string" || !name.trim()) throw new Error(`Built-in background ${index + 1} needs a name.`);
    if (typeof file !== "string" || !file.trim()) throw new Error(`Built-in background ${index + 1} needs a file.`);
    if (!Number.isInteger(columns) || Number(columns) <= 0) throw new Error(`${name} needs a positive whole-number column count.`);
    if (!Number.isInteger(rows) || Number(rows) <= 0) throw new Error(`${name} needs a positive whole-number row count.`);

    const url = new URL(file, manifestBase);
    if (url.origin !== manifestBase.origin || !url.pathname.startsWith(manifestBase.pathname)) {
      throw new Error(`${name} must use an image inside the built-in backgrounds folder.`);
    }

    return {
      name: name.trim(),
      file,
      columns: Number(columns),
      rows: Number(rows),
      url: url.href,
      mime: mimeFromImageUrl(url.href),
    };
  });

  return { version: 1, images };
}

export async function fetchBuiltInManifest(
  manifestUrl = new URL(BUILT_IN_MANIFEST_PATH, window.location.origin).href,
  signal?: AbortSignal,
): Promise<BuiltInManifest> {
  const response = await fetch(manifestUrl, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Unable to load built-in backgrounds (${response.status}).`);
  return parseBuiltInManifest(await response.json(), manifestUrl);
}

export async function loadImageDimensions(url: string): Promise<ImageDimensions> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error("The selected built-in background image could not be loaded.");
  }
  if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) {
    throw new Error("The selected built-in background has invalid dimensions.");
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function configFromBuiltIn(
  background: BuiltInBackground,
  dimensions: ImageDimensions,
  sceneDpi: number,
): BackgroundConfigV1 {
  const { width, height } = dimensions;
  if (!(width > 0) || !(height > 0) || !(sceneDpi > 0)) {
    throw new Error("The built-in background cannot be sized with the current image and scene dimensions.");
  }
  return {
    version: 1,
    enabled: true,
    image: {
      name: background.name,
      url: background.url,
      mime: background.mime,
      width,
      height,
    },
    grid: { dpi: width / background.columns, offset: { x: 0, y: 0 } },
    scale: {
      x: background.columns * sceneDpi / width,
      y: background.rows * sceneDpi / height,
    },
    origin: { x: 0, y: 0 },
  };
}
