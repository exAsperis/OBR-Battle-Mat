import OBR, { buildImage, type Image, type Item, type Vector2 } from "@owlbear-rodeo/sdk";
import { BACKGROUND_Z_INDEX, LOCAL_TILE_KEY } from "../constants";
import { poolSizeForRadius } from "../config/localSettings";
import type { BackgroundConfigV1, RendererDebugState, TileAssignment } from "../types";
import { recycleAssignments } from "./pool";

const TILE_TAG = { version: 1 };
const ADD_BATCH_SIZE = 40;

function isOwnedTile(item: Item): boolean {
  const tag = item.metadata[LOCAL_TILE_KEY];
  return Boolean(tag && typeof tag === "object" && !Array.isArray(tag) && "version" in tag && tag.version === 1);
}

export class TiledBackgroundRenderer {
  private generation = 0;
  private config: BackgroundConfigV1 | null = null;
  private radius = 0;
  private itemIds: string[] = [];
  private assignments = new Map<string, TileAssignment>();
  private tileWidth = 0;
  private tileHeight = 0;
  private centerTileX: number | null = null;
  private centerTileY: number | null = null;
  private updateInProgress = false;
  private lastMoves = 0;
  private lastUpdateMs = 0;

  get active(): boolean {
    return Boolean(this.config?.enabled && this.config.image && this.radius > 0 && this.itemIds.length > 0);
  }

  get debugState(): RendererDebugState {
    return {
      enabled: this.active,
      radius: this.radius,
      poolSize: this.itemIds.length,
      centerTileX: this.centerTileX,
      centerTileY: this.centerTileY,
      lastMoves: this.lastMoves,
      lastUpdateMs: this.lastUpdateMs,
    };
  }

  async start(config: BackgroundConfigV1, radius: number): Promise<void> {
    await this.stop();
    if (!config.enabled || !config.image || !config.grid || radius <= 0) return;

    const generation = ++this.generation;
    this.config = config;
    this.radius = radius;
    await this.deleteOwnedTiles();
    if (generation !== this.generation) return;

    const probe = this.buildTile({ x: config.origin.x, y: config.origin.y });
    await OBR.scene.local.addItems([probe]);
    if (generation !== this.generation) {
      await OBR.scene.local.deleteItems([probe.id]);
      return;
    }

    const bounds = await OBR.scene.local.getItemBounds([probe.id]);
    if (generation !== this.generation) return;
    if (!(bounds.width > 0) || !(bounds.height > 0)) {
      await OBR.scene.local.deleteItems([probe.id]);
      throw new Error("The selected image has invalid rendered dimensions.");
    }
    this.tileWidth = bounds.width;
    this.tileHeight = bounds.height;
    this.itemIds = [probe.id];
    await this.resizePool(poolSizeForRadius(radius), generation);
  }

  async stop(): Promise<void> {
    this.generation += 1;
    this.config = null;
    this.radius = 0;
    this.assignments.clear();
    this.centerTileX = null;
    this.centerTileY = null;
    this.itemIds = [];
    await this.deleteOwnedTiles();
  }

  async setRenderRadius(radius: number): Promise<void> {
    if (!this.config || !this.config.enabled || !this.config.image || !this.config.grid) return;
    if (radius <= 0) {
      await this.stop();
      return;
    }
    this.radius = radius;
    const generation = this.generation;
    await this.resizePool(poolSizeForRadius(radius), generation);
    if (generation !== this.generation) return;
    const center = await this.getViewportCenter();
    this.centerTileX = null;
    this.centerTileY = null;
    await this.updateCamera(center);
  }

  async updateFromViewport(): Promise<void> {
    if (!this.active || this.updateInProgress) return;
    this.updateInProgress = true;
    try {
      await this.updateCamera(await this.getViewportCenter());
    } finally {
      this.updateInProgress = false;
    }
  }

  async validatePool(): Promise<void> {
    if (!this.config || this.radius <= 0 || this.updateInProgress) return;
    const owned = (await OBR.scene.local.getItems()).filter(isOwnedTile);
    const expected = poolSizeForRadius(this.radius);
    const currentIds = new Set(this.itemIds);
    const unexpected = owned.filter((item) => !currentIds.has(item.id)).map((item) => item.id);
    if (unexpected.length) await OBR.scene.local.deleteItems(unexpected);
    const ownedIds = new Set(owned.map((item) => item.id));
    this.itemIds = this.itemIds.filter((id) => ownedIds.has(id));
    if (this.itemIds.length !== expected) {
      const generation = this.generation;
      await this.resizePool(expected, generation);
      if (generation !== this.generation) return;
      this.centerTileX = null;
      this.centerTileY = null;
      await this.updateFromViewport();
    }
  }

  private buildTile(position: Vector2): Image {
    const config = this.config;
    if (!config?.image || !config.grid) throw new Error("Cannot build a tile without an image.");
    return buildImage(config.image, config.grid)
      .name(`Battle Mat · ${config.image.name ?? "Background"}`)
      .position(position)
      .scale(config.scale)
      .layer("MAP")
      .zIndex(BACKGROUND_Z_INDEX)
      .locked(true)
      .disableHit(true)
      .disableAutoZIndex(true)
      .metadata({ [LOCAL_TILE_KEY]: TILE_TAG })
      .build();
  }

  private async resizePool(target: number, generation: number): Promise<void> {
    if (!this.config || generation !== this.generation) return;
    if (this.itemIds.length < target) {
      const additions = Array.from({ length: target - this.itemIds.length }, () => this.buildTile(this.config!.origin));
      for (let index = 0; index < additions.length; index += ADD_BATCH_SIZE) {
        await OBR.scene.local.addItems(additions.slice(index, index + ADD_BATCH_SIZE));
      }
      if (generation !== this.generation) {
        await OBR.scene.local.deleteItems(additions.map((item) => item.id));
        return;
      }
      this.itemIds.push(...additions.map((item) => item.id));
    } else if (this.itemIds.length > target) {
      const removed = this.itemIds.splice(target);
      await OBR.scene.local.deleteItems(removed);
    }
    const activeIds = new Set(this.itemIds);
    this.assignments = new Map([...this.assignments].filter(([, assignment]) => activeIds.has(assignment.itemId)));
  }

  private async updateCamera(center: Vector2): Promise<void> {
    const config = this.config;
    if (!config || !this.tileWidth || !this.tileHeight || !this.itemIds.length) return;
    const tileX = Math.floor((center.x - config.origin.x) / this.tileWidth);
    const tileY = Math.floor((center.y - config.origin.y) / this.tileHeight);
    if (tileX === this.centerTileX && tileY === this.centerTileY && this.assignments.size === this.itemIds.length) return;

    const startedAt = performance.now();
    const { next, moved } = recycleAssignments(this.assignments, this.itemIds, tileX, tileY, this.radius);
    if (moved.length) {
      const positions = new Map(moved.map((assignment) => [assignment.itemId, {
        x: config.origin.x + assignment.tileX * this.tileWidth,
        y: config.origin.y + assignment.tileY * this.tileHeight,
      }]));
      const items = await OBR.scene.local.getItems<Image>([...positions.keys()]);
      await OBR.scene.local.updateItems(items, (drafts) => {
        for (const draft of drafts) {
          const position = positions.get(draft.id);
          if (position) draft.position = position;
        }
      });
    }
    this.assignments = next;
    this.centerTileX = tileX;
    this.centerTileY = tileY;
    this.lastMoves = moved.length;
    this.lastUpdateMs = performance.now() - startedAt;
  }

  private async getViewportCenter(): Promise<Vector2> {
    const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    return OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });
  }

  private async deleteOwnedTiles(): Promise<void> {
    if (!(await OBR.scene.isReady())) return;
    const ownedIds = (await OBR.scene.local.getItems()).filter(isOwnedTile).map((item) => item.id);
    if (ownedIds.length) await OBR.scene.local.deleteItems(ownedIds);
  }
}
