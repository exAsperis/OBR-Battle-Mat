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
});
