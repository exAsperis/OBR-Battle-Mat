import type { ImageContent, ImageGrid, Vector2 } from "@owlbear-rodeo/sdk";

export interface ImageRights {
  creator: string;
  license?: string;
  [field: string]: string | undefined;
}

export type BackgroundImage = ImageContent & {
  name?: string;
  rights?: ImageRights;
  ai?: boolean;
  columns?: number;
  rows?: number;
};

export interface BackgroundConfigV1 {
  version: 1;
  enabled: boolean;
  image: BackgroundImage | null;
  grid: ImageGrid | null;
  scale: Vector2;
  origin: Vector2;
}

export type RenderDistance = "off" | "low" | "medium" | "high" | "extreme";

export interface TileAssignment {
  itemId: string;
  tileX: number;
  tileY: number;
}

export interface RendererDebugState {
  enabled: boolean;
  radius: number;
  poolSize: number;
  centerTileX: number | null;
  centerTileY: number | null;
  lastMoves: number;
  lastUpdateMs: number;
}
