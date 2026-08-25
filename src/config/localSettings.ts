import {
  DEFAULT_RENDER_DISTANCE,
  RENDER_DISTANCE_EVENT,
  RENDER_DISTANCE_KEY,
} from "../constants";
import type { RenderDistance } from "../types";

export const RENDER_DISTANCE_OPTIONS: ReadonlyArray<{
  value: RenderDistance;
  label: string;
  radius: number;
}> = [
  { value: "off", label: "Off", radius: 0 },
  { value: "low", label: "Low", radius: 2 },
  { value: "medium", label: "Medium", radius: 4 },
  { value: "high", label: "High", radius: 6 },
  { value: "extreme", label: "Extreme", radius: 8 },
];

export function isRenderDistance(value: string | null): value is RenderDistance {
  return RENDER_DISTANCE_OPTIONS.some((option) => option.value === value);
}

export function getRenderDistance(): RenderDistance {
  try {
    const stored = localStorage.getItem(RENDER_DISTANCE_KEY);
    return isRenderDistance(stored) ? stored : DEFAULT_RENDER_DISTANCE;
  } catch {
    return DEFAULT_RENDER_DISTANCE;
  }
}

export function setRenderDistance(value: RenderDistance): void {
  localStorage.setItem(RENDER_DISTANCE_KEY, value);
  window.dispatchEvent(new CustomEvent(RENDER_DISTANCE_EVENT, { detail: value }));
}

export function radiusForRenderDistance(value: RenderDistance): number {
  return RENDER_DISTANCE_OPTIONS.find((option) => option.value === value)?.radius ?? 4;
}

export function poolSizeForRadius(radius: number): number {
  return radius <= 0 ? 0 : (radius * 2 + 1) ** 2;
}
