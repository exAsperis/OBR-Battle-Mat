/** All metadata keys and Owlbear registrations must derive from this ID. */
export const EXTENSION_ID = "com.ex-asperis.obr-battle-mat";

export const EXTENSION_NAME = "OBR Battle Mat";

export const SCENE_CONFIG_KEY = `${EXTENSION_ID}/config`;
export const LOCAL_TILE_KEY = `${EXTENSION_ID}/local-tile`;
export const RENDER_DISTANCE_KEY = `${EXTENSION_ID}/render-distance`;
export const RENDER_DISTANCE_EVENT = `${EXTENSION_ID}/render-distance-change`;

// Normal map items use large timestamp-based z-indices. Zero keeps the battle
// mat beneath them without placing it below Owlbear's rendered scene surface.
export const BACKGROUND_Z_INDEX = 0;
export const VIEWPORT_POLL_INTERVAL_MS = 125;
export const DEFAULT_RENDER_DISTANCE = "medium";
