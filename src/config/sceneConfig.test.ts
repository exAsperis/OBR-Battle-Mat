import { describe, expect, it } from "vitest";
import { SCENE_CONFIG_KEY } from "../constants";
import { EMPTY_BACKGROUND_CONFIG, readBackgroundConfig } from "./sceneConfig";

describe("scene background metadata", () => {
  it("accepts the disabled empty configuration", () => {
    expect(readBackgroundConfig({ [SCENE_CONFIG_KEY]: EMPTY_BACKGROUND_CONFIG })).toEqual(EMPTY_BACKGROUND_CONFIG);
  });
  it("rejects future schema versions safely", () => {
    expect(readBackgroundConfig({ [SCENE_CONFIG_KEY]: { ...EMPTY_BACKGROUND_CONFIG, version: 2 } })).toBeNull();
  });
  it("rejects enabled metadata without a reusable image", () => {
    expect(readBackgroundConfig({ [SCENE_CONFIG_KEY]: { ...EMPTY_BACKGROUND_CONFIG, enabled: true } })).toBeNull();
  });
  it("rejects malformed optional public-background metadata", () => {
    const config = {
      version: 1,
      enabled: true,
      image: { url: "https://example.com/a.png", mime: "image/png", width: 100, height: 100, ai: "yes" },
      grid: { dpi: 50, offset: { x: 0, y: 0 } },
      scale: { x: 1, y: 1 },
      origin: { x: 0, y: 0 },
    };
    expect(readBackgroundConfig({ [SCENE_CONFIG_KEY]: config })).toBeNull();
  });
});
