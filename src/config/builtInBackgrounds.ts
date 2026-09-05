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

export interface UrlBackgroundInput {
  url: string;
  columns: number;
  rows: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function mimeFromImageUrl(url: string): BuiltInBackground["mime"] {
  const extension = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  throw new Error("Images must be PNG, JPEG, or WebP files.");
}

export function parseAbsoluteImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid absolute image URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Image URLs must use HTTP or HTTPS.");
  }
  mimeFromImageUrl(url.href);
  return url;
}

export function parseBuiltInManifest(value: unknown, manifestUrl: string): BuiltInManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.images)) {
    throw new Error("The built-in image manifest is not valid version 1 data.");
  }

  const manifestBase = new URL("./", manifestUrl);
  const images = value.images.map((entry, index): BuiltInBackground => {
    if (!isRecord(entry)) throw new Error(`Built-in image ${index + 1} must be an object.`);
    const { name, file, columns, rows, rights, ai, collection } = entry;
    if (typeof name !== "string" || !name.trim()) throw new Error(`Built-in image ${index + 1} needs a name.`);
    if (typeof file !== "string" || !file.trim()) throw new Error(`Built-in image ${index + 1} needs a file.`);
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

    let url: URL;
    try {
      url = parseAbsoluteImageUrl(file);
    } catch (cause) {
      if (/^[a-z][a-z\d+.-]*:/i.test(file)) throw cause;
      url = new URL(file, manifestBase);
      if (url.origin !== manifestBase.origin || !url.pathname.startsWith(manifestBase.pathname)) {
        throw new Error(`${name} must use a relative image inside the built-in folder or an absolute HTTP(S) URL.`);
      }
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
  if (!response.ok) throw new Error(`Unable to load built-in images (${response.status}).`);
  return parseBuiltInManifest(await response.json(), manifestUrl);
}

export async function loadImageDimensions(url: string, requireCors = false): Promise<ImageDimensions> {
  const image = new Image();
  if (requireCors) image.crossOrigin = "anonymous";
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error(requireCors
      ? "This host does not allow Owlbear-compatible cross-origin image loading, or the image is unavailable. Download and add it through My OBR images, or use a host that enables CORS."
      : "The selected image could not be loaded.");
  }
  if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) {
    throw new Error("The selected image has invalid dimensions.");
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function configFromUrl(input: UrlBackgroundInput, dimensions: ImageDimensions): BackgroundConfigV1 {
  const url = parseAbsoluteImageUrl(input.url);
  if (!Number.isInteger(input.columns) || input.columns <= 0 || !Number.isInteger(input.rows) || input.rows <= 0) {
    throw new Error("Columns and rows must be positive whole numbers.");
  }
  const encodedFilename = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let filename = encodedFilename;
  try { filename = decodeURIComponent(encodedFilename); } catch { /* Keep the encoded URL segment as a safe display name. */ }
  const name = filename.replace(/\.(png|jpe?g|webp)$/i, "") || url.hostname;
  return configFromGridImage({
    name,
    url: url.href,
    mime: mimeFromImageUrl(url.href),
    columns: input.columns,
    rows: input.rows,
  }, dimensions);
}

function configFromGridImage(
  background: Pick<BuiltInBackground, "name" | "url" | "mime" | "columns" | "rows"> & Partial<Pick<BuiltInBackground, "rights" | "ai">>,
  dimensions: ImageDimensions,
): BackgroundConfigV1 {
  const { width, height } = dimensions;
  if (!(width > 0) || !(height > 0)) throw new Error("The image cannot be sized with its current dimensions.");
  const imageDpi = width / background.columns;
  return {
    version: 1,
    enabled: true,
    image: {
      name: background.name, url: background.url, mime: background.mime, width, height,
      ...(background.rights ? { rights: background.rights } : {}),
      ...(background.ai !== undefined ? { ai: background.ai } : {}),
      columns: background.columns, rows: background.rows,
    },
    grid: { dpi: imageDpi, offset: { x: 0, y: 0 } },
    scale: { x: 1, y: background.rows * imageDpi / height },
    origin: { x: 0, y: 0 },
  };
}

export function configFromBuiltIn(
  background: BuiltInBackground,
  dimensions: ImageDimensions,
): BackgroundConfigV1 {
  return configFromGridImage(background, dimensions);
}
