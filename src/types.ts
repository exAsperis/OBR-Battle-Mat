import type { ImageContent, ImageGrid, Vector2 } from "@owlbear-rodeo/sdk";

export interface BackgroundConfigV1 {
  version: 1;
  enabled: boolean;
  image: ({ name?: string } & ImageContent) | null;
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
