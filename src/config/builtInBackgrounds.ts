import type { BackgroundConfigV1, ImageRights } from "../types";

export const BUILT_IN_MANIFEST_PATH = "/backgrounds/manifest.json";

export interface BuiltInBackground {
  name: string;
  file: string;
  columns: number;
  rows: number;
  rights: ImageRights;
  ai: boolean;
  collection: string[];
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
  throw new Error("Public backgrounds must be PNG, JPEG, or WebP images.");
}

export function parseBuiltInManifest(value: unknown, manifestUrl: string): BuiltInManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.images)) {
    throw new Error("The public background manifest is not valid version 1 data.");
  }

  const manifestBase = new URL("./", manifestUrl);
  const images = value.images.map((entry, index): BuiltInBackground => {
    if (!isRecord(entry)) throw new Error(`Public background ${index + 1} must be an object.`);
    const { name, file, columns, rows, rights, ai, collection } = entry;
    if (typeof name !== "string" || !name.trim()) throw new Error(`Public background ${index + 1} needs a name.`);
    if (typeof file !== "string" || !file.trim()) throw new Error(`Public background ${index + 1} needs a file.`);
    if (!Number.isInteger(columns) || Number(columns) <= 0) throw new Error(`${name} needs a positive whole-number column count.`);
    if (!Number.isInteger(rows) || Number(rows) <= 0) throw new Error(`${name} needs a positive whole-number row count.`);
    if (!isRecord(rights) || typeof rights.creator !== "string" || !rights.creator.trim()) throw new Error(`${name} needs a rights object with a creator.`);
    if (Object.values(rights).some((value) => typeof value !== "string" || !value.trim())) throw new Error(`${name} has an invalid rights field.`);
    if (typeof ai !== "boolean") throw new Error(`${name} needs an AI disclosure value.`);
    if (!Array.isArray(collection) || collection.length === 0 || collection.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`${name} needs at least one valid collection.`);
    }
    const normalizedCollections = collection.map((value) => value.trim());
    if (new Set(normalizedCollections).size !== normalizedCollections.length) throw new Error(`${name} cannot repeat a collection.`);

    const url = new URL(file, manifestBase);
    if (url.origin !== manifestBase.origin || !url.pathname.startsWith(manifestBase.pathname)) {
      throw new Error(`${name} must use an image inside the public backgrounds folder.`);
    }

    return {
      name: name.trim(),
      file,
      columns: Number(columns),
      rows: Number(rows),
      rights: Object.fromEntries(Object.entries(rights).map(([field, value]) => [field, String(value).trim()])) as ImageRights,
      ai,
      collection: normalizedCollections,
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
  if (!response.ok) throw new Error(`Unable to load public backgrounds (${response.status}).`);
  return parseBuiltInManifest(await response.json(), manifestUrl);
}

export async function loadImageDimensions(url: string): Promise<ImageDimensions> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error("The selected public background image could not be loaded.");
  }
  if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) {
    throw new Error("The selected public background has invalid dimensions.");
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function configFromBuiltIn(
  background: BuiltInBackground,
  dimensions: ImageDimensions,
): BackgroundConfigV1 {
  const { width, height } = dimensions;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("The public background cannot be sized with the current image dimensions.");
  }
  const imageDpi = width / background.columns;
  return {
    version: 1,
    enabled: true,
    image: {
      name: background.name,
      url: background.url,
      mime: background.mime,
      width,
      height,
      rights: background.rights,
      ai: background.ai,
      columns: background.columns,
      rows: background.rows,
    },
    grid: { dpi: imageDpi, offset: { x: 0, y: 0 } },
    scale: {
      x: 1,
      y: background.rows * imageDpi / height,
    },
    origin: { x: 0, y: 0 },
  };
}
