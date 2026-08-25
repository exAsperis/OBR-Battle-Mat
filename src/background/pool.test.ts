import { describe, expect, it } from "vitest";
import { poolSizeForRadius } from "../config/localSettings";
import { coordinateKey, desiredCoordinates, recycleAssignments } from "./pool";

describe("bounded tile pool", () => {
  it.each([[0, 0], [2, 25], [4, 81], [6, 169], [8, 289]])("uses radius %i for exactly %i tiles", (radius, size) => {
    expect(poolSizeForRadius(radius)).toBe(size);
  });
  it("generates a square centered on the logical camera tile", () => {
    const coordinates = desiredCoordinates(12, -7, 2);
    expect(coordinates).toHaveLength(25);
    expect(coordinates[0]).toEqual({ tileX: 10, tileY: -9 });
    expect(coordinates.at(-1)).toEqual({ tileX: 14, tileY: -5 });
  });
  it("recycles one column after a one-tile horizontal pan", () => {
    const ids = Array.from({ length: 81 }, (_, index) => `tile-${index}`);
    const initial = recycleAssignments(new Map(), ids, 0, 0, 4).next;
    const shifted = recycleAssignments(initial, ids, 1, 0, 4);
    expect(shifted.next).toHaveLength(81);
    expect(shifted.moved).toHaveLength(9);
    expect(shifted.next.has(coordinateKey(-4, 0))).toBe(false);
    expect(shifted.next.has(coordinateKey(5, 0))).toBe(true);
  });
  it("never derives pool size from viewport or zoom", () => {
    const ids = Array.from({ length: 25 }, (_, index) => `tile-${index}`);
    const farAway = recycleAssignments(new Map(), ids, 900_000, -900_000, 2);
    expect(farAway.next).toHaveLength(25);
    expect(farAway.moved).toHaveLength(25);
  });
});
