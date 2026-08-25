import type { TileAssignment } from "../types";

export interface TileCoordinate { tileX: number; tileY: number }

export const coordinateKey = (tileX: number, tileY: number) => `${tileX},${tileY}`;

export function desiredCoordinates(centerX: number, centerY: number, radius: number): TileCoordinate[] {
  const coordinates: TileCoordinate[] = [];
  for (let tileY = centerY - radius; tileY <= centerY + radius; tileY += 1) {
    for (let tileX = centerX - radius; tileX <= centerX + radius; tileX += 1) {
      coordinates.push({ tileX, tileY });
    }
  }
  return coordinates;
}

export function recycleAssignments(
  assignments: Map<string, TileAssignment>,
  itemIds: string[],
  centerX: number,
  centerY: number,
  radius: number,
): { next: Map<string, TileAssignment>; moved: TileAssignment[] } {
  const desired = desiredCoordinates(centerX, centerY, radius);
  const desiredKeys = new Set(desired.map(({ tileX, tileY }) => coordinateKey(tileX, tileY)));
  const next = new Map<string, TileAssignment>();
  const usedIds = new Set<string>();

  for (const [key, assignment] of assignments) {
    if (desiredKeys.has(key) && itemIds.includes(assignment.itemId)) {
      next.set(key, assignment);
      usedIds.add(assignment.itemId);
    }
  }

  const freeIds = itemIds.filter((id) => !usedIds.has(id));
  const moved: TileAssignment[] = [];
  for (const coordinate of desired) {
    const key = coordinateKey(coordinate.tileX, coordinate.tileY);
    if (next.has(key)) continue;
    const itemId = freeIds.shift();
    if (!itemId) break;
    const assignment = { itemId, ...coordinate };
    next.set(key, assignment);
    moved.push(assignment);
  }
  return { next, moved };
}
