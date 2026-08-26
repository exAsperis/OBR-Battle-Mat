import type { ImageDownload, Metadata } from "@owlbear-rodeo/sdk";
import { SCENE_CONFIG_KEY } from "../constants";
import type { BackgroundConfigV1 } from "../types";

export const EMPTY_BACKGROUND_CONFIG: BackgroundConfigV1 = {
  version: 1,
  enabled: false,
  image: null,
  grid: null,
  scale: { x: 1, y: 1 },
  origin: { x: 0, y: 0 },
};

export function configFromImage(download: ImageDownload): BackgroundConfigV1 {
  return {
    version: 1,
    enabled: true,
    image: { ...download.image, name: download.name },
    grid: download.grid,
    scale: download.scale ?? { x: 1, y: 1 },
    origin: { x: 0, y: 0 },
  };
}

export function readBackgroundConfig(metadata: Metadata): BackgroundConfigV1 | null {
  const value = metadata[SCENE_CONFIG_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as unknown as Partial<BackgroundConfigV1>;
  if (candidate.version !== 1 || typeof candidate.enabled !== "boolean") return null;
  if (!candidate.image || !candidate.grid) {
    return candidate.enabled ? null : { ...EMPTY_BACKGROUND_CONFIG };
  }
  const { image, grid, scale, origin } = candidate;
  if (
    typeof image.url !== "string" || typeof image.mime !== "string" ||
    !Number.isFinite(image.width) || !Number.isFinite(image.height) ||
    !Number.isFinite(grid.dpi) || !grid.offset ||
    !scale || !Number.isFinite(scale.x) || !Number.isFinite(scale.y) ||
    !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)
  ) return null;
  const rightsAreInvalid = image.rights !== undefined && (
    !image.rights || typeof image.rights !== "object" || Array.isArray(image.rights) ||
    typeof image.rights.creator !== "string" || !image.rights.creator.trim() ||
    Object.values(image.rights).some((value) => typeof value !== "string" || !value.trim())
  );
  if (
    rightsAreInvalid ||
    (image.ai !== undefined && typeof image.ai !== "boolean") ||
    (image.columns !== undefined && (!Number.isInteger(image.columns) || image.columns <= 0)) ||
    (image.rows !== undefined && (!Number.isInteger(image.rows) || image.rows <= 0))
  ) return null;
  return candidate as BackgroundConfigV1;
}

export function backgroundMetadata(config: BackgroundConfigV1): Metadata {
  return { [SCENE_CONFIG_KEY]: config } as Metadata;
}
