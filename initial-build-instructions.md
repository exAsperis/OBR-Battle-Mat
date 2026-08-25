# Tiled Scene Background Extension

## Goal

Build an Owlbear Rodeo extension that allows the GM to assign **one image per scene as a repeating background texture**.

The selected image should appear to tile indefinitely beneath the scene. It must:

- Be visible to all connected clients.
- Be anchored to fixed world coordinates so the pattern does not slide when the camera moves.
- Render beneath maps, grid, props, characters, fog, and other normal scene content.
- Be completely unselectable and noninteractive.
- Not create synchronized scene items for every tile.
- Use only client-local OBR items for the rendered repetitions.
- Have a per-device "render distance" that places a hard upper bound on the number of local tile objects.
- Never increase the number of tiles simply because the user zooms out.

The design should favor simplicity and predictable performance over attempting to create a literally infinite set of tiles.

---

## Core Architecture

Separate the extension into two concepts:

1. **Shared scene configuration**
   - Stored in OBR scene metadata.
   - Controlled by the GM.
   - Contains the selected image and settings necessary to reproduce the background.
   - Synchronizes to every client.

2. **Local renderer**
   - Runs independently on every connected client.
   - Uses `OBR.scene.local` items only.
   - Maintains a fixed-size pool of local image items around that client's camera.
   - Uses a per-device render-distance setting stored locally.
   - Recycles existing items as the camera moves instead of continually creating and deleting them.

Do **not** use `OBR.scene.items` for the repeated tiles.

Do **not** access or attempt to modify Owlbear Rodeo's host DOM.

Do **not** pursue shader, Effect, or post-processing solutions for version 1.

---

# Important OBR APIs

Use the current installed `@owlbear-rodeo/sdk` and verify exact signatures against that version before implementation.

Expected relevant APIs include:

```ts
OBR.onReady(...)
OBR.scene.isReady()
OBR.scene.onReadyChange(...)
OBR.scene.getMetadata()
OBR.scene.setMetadata(...)
OBR.scene.onMetadataChange(...)

OBR.scene.local.addItems(...)
OBR.scene.local.updateItems(...)
OBR.scene.local.deleteItems(...)
OBR.scene.local.getItems(...)
OBR.scene.local.getItemBounds(...)

OBR.viewport.getPosition()
OBR.viewport.getScale()
OBR.viewport.getWidth()
OBR.viewport.getHeight()
OBR.viewport.inverseTransformPoint(...)

OBR.assets.downloadImages(...)

OBR.player.getRole()
```

`OBR.viewport` currently does not expose a viewport-position change event. The renderer therefore needs a lightweight polling loop.

---

# Extension Lifetime

The tile renderer must continue running when the action popover is closed.

Use an OBR **background page** via the extension manifest's `background_url`.

The background page is responsible for:

- Watching scene readiness.
- Watching scene metadata.
- Creating and destroying the local tile pool.
- Polling the local viewport.
- Recycling tiles as the camera moves.
- Responding to local render-distance changes.

The action popover is configuration UI only.

Do not tie rendering lifetime to whether the popover is open.

---

# Scene Metadata

Use a namespaced metadata key following OBR conventions.

Replace the placeholder namespace with the actual extension ID.

Example:

```ts
const METADATA_KEY = "com.example.tiled-background/config";
```

Suggested schema:

```ts
interface BackgroundConfigV1 {
  version: 1;
  enabled: boolean;

  image: {
    name?: string;
    url: string;
    mime: string;
    width: number;
    height: number;
  } | null;

  grid: {
    dpi: number;
    offset: {
      x: number;
      y: number;
    };
  } | null;

  scale: {
    x: number;
    y: number;
  };

  origin: {
    x: number;
    y: number;
  };
}
```

Use `{ x: 1, y: 1 }` as the initial scale unless the selected OBR asset has a default scale that should clearly be preserved.

Use `{ x: 0, y: 0 }` as the default world origin.

Do not store device performance settings in scene metadata.

---

# Image Selection

Only the GM may change the scene background.

Determine role with:

```ts
await OBR.player.getRole()
```

For image selection, use OBR's image picker, preferably something equivalent to:

```ts
const images = await OBR.assets.downloadImages(false, undefined, "MAP");
```

Use the returned `ImageDownload` data to populate the shared scene configuration.

The image URL, dimensions, MIME type, grid information, and any necessary default scaling must be sufficient for another client to recreate an equivalent local `IMAGE` item.

## Required Early Test

Before implementing the complete renderer, verify this:

1. GM selects an image using `OBR.assets.downloadImages`.
2. Store the returned image information in scene metadata.
3. Open the same room as a second player/client.
4. Have the player create a local image directly from the stored metadata.
5. Verify that the image URL loads successfully on the player's device.
6. Reload the player and verify that the stored URL remains usable.
7. Have a player join after the background has already been configured and verify that it still works.

If the image URL from `downloadImages` is not reusable by another client or is not sufficiently persistent, stop and investigate the correct OBR asset-sharing mechanism before building the full renderer.

Do not solve this by storing image bytes or base64 data in metadata.

---

# Local Tile Items

Every rendered repeat must be an `OBR.scene.local` image item.

Build tiles using `buildImage(...)`.

Each tile should have approximately these properties:

```ts
.locked(true)
.disableHit(true)
.disableAutoZIndex(true)
.layer("MAP")
.zIndex(VERY_LOW_Z_INDEX)
```

Also tag every tile in its metadata:

```ts
{
  "com.example.tiled-background/local-tile": {
    version: 1
  }
}
```

This tag is important because `OBR.scene.local` contains local items from multiple extensions.

Never delete or update local items merely because they are local.

Only modify items positively identified as belonging to this extension.

---

# Layer and Z-Order

The background must be beneath every normal map.

Use the `MAP` layer with an intentionally very low z-index and disable automatic z-index adjustment.

Test negative z-index values and choose a value that reliably sorts beneath normal map items.

For example:

```ts
const BACKGROUND_Z_INDEX = -1_000_000;
```

Do not assume this works without testing.

Acceptance requirement:

- Existing maps appear above the background.
- Newly created maps appear above the background.
- Grid appears above the background.
- Props, characters, attachments, drawings, fog, etc. appear normally.
- Background tiles can never be selected.

---

# Fixed World Alignment

The background pattern must be anchored to world space.

Do **not** simply center the tile grid on the camera.

Otherwise the texture will visibly shift whenever the pool is recentered.

Define a fixed background origin:

```ts
origin = { x: 0, y: 0 }
```

Each logical tile receives integer coordinates:

```text
(... -2,-2) (-1,-2) (0,-2) (1,-2) (2,-2) ...
(... -2,-1) (-1,-1) (0,-1) (1,-1) (2,-1) ...
(... -2, 0) (-1, 0) (0, 0) (1, 0) (2, 0) ...
```

The world position of each tile must be derived only from:

```text
origin
logical tile X/Y
rendered tile width/height
```

Conceptually:

```ts
worldX = origin.x + tileX * tileWidth;
worldY = origin.y + tileY * tileHeight;
```

The same logical tile coordinate must always resolve to the same world position on every client.

---

# Determining Actual Tile Dimensions

Do not make fragile assumptions about how asset DPI, image grid information, and OBR scaling combine.

Prefer to establish the actual rendered world dimensions empirically.

A robust approach is:

1. Build one temporary local tile at a known position.
2. Add it to `OBR.scene.local`.
3. Query its bounds with `OBR.scene.local.getItemBounds(...)`.
4. Calculate actual world width and height from those bounds.
5. Use those dimensions as the tile step.
6. Delete or reuse the temporary item as the first pool item.

This also gives us a direct test for whether adjacent copies meet exactly edge-to-edge.

If the SDK provides an unquestionably correct direct calculation from the image/grid data, that calculation may be used instead, but add a test comparing it to actual item bounds.

---

# Render Distance

Render distance is a **per-device performance setting**.

Store it in `localStorage`, namespaced to this extension.

Example:

```ts
const RENDER_DISTANCE_KEY =
  "com.example.tiled-background/render-distance";
```

Suggested presets:

| Setting | Radius | Pool size |
|---|---:|---:|
| Off | 0 | 0 |
| Low | 2 | 25 |
| Medium | 4 | 81 |
| High | 6 | 169 |
| Extreme | 8 | 289 |

For radius `r`:

```ts
poolSize = (2 * r + 1) ** 2;
```

Default to **Medium** unless testing suggests another default.

The setting belongs to the local device, not the player account or scene.

Two players in the same scene may therefore render different numbers of tiles.

That is intentional.

---

# Critical Performance Rule

**Zoom level must never determine tile count.**

This is central to the design.

If the player zooms way out, the renderer must not attempt to cover the entire visible viewport by generating more tiles.

The pool size remains exactly the number allowed by local render distance.

Therefore at extreme zoom levels the user may see the edge of the rendered background and blank OBR canvas beyond it.

That is acceptable behavior.

It is preferable to a runaway allocation of hundreds or thousands of local image objects.

---

# Tile Pool

Implement a persistent object pool.

For a Medium render distance:

```text
9 x 9 = 81 local image items
```

Create these items once.

Routine panning should not create or destroy tiles.

Instead, recycle tiles that have left one side of the render region by moving them to the newly required positions on the opposite side.

Maintain logical tile coordinates separately from item IDs.

Suggested data structure:

```ts
interface TileAssignment {
  itemId: string;
  tileX: number;
  tileY: number;
}

const assignments = new Map<string, TileAssignment>();
```

A coordinate key may be:

```ts
`${tileX},${tileY}`
```

---

# Determining the Desired Tile Region

Determine which logical tile contains the local camera center:

```ts
centerTileX = Math.floor(
  (cameraWorldX - origin.x) / tileWidth
);

centerTileY = Math.floor(
  (cameraWorldY - origin.y) / tileHeight
);
```

For render radius `r`, desired logical tile coordinates are:

```ts
x = centerTileX - r ... centerTileX + r
y = centerTileY - r ... centerTileY + r
```

Generate the set of desired coordinate keys.

Compare it with the currently assigned coordinates.

### Tiles that remain inside the region

Do nothing.

### Tiles leaving the region

Put their item IDs into a free pool.

### Newly required logical coordinates

Assign free item IDs to them and update those items' positions.

This means moving one tile horizontally should normally recycle only one column of items.

For a radius of 4:

```text
9 items move
72 items remain untouched
```

A large camera jump may cause the whole pool to be reassigned, which is fine.

Use a single batched `OBR.scene.local.updateItems(...)` call whenever practical.

For position-only updates, investigate the SDK's `fastUpdate` option. Use it if position updates are explicitly supported by the installed SDK version and testing confirms correct behavior.

---

# Viewport Tracking

The current OBR viewport API does not provide a position-change subscription.

Use a lightweight polling loop in the extension background page.

Suggested starting interval:

```ts
100-150 ms
```

Do not update tiles every poll.

Each poll should only determine whether the camera has crossed into a different logical tile.

Maintain:

```ts
lastCenterTileX
lastCenterTileY
```

If they have not changed:

```ts
return;
```

No local-item update should occur.

Therefore normal tiny viewport movements produce effectively no renderer work.

---

# Camera Position

Use the most reliable current SDK method for obtaining the local camera's world-space center.

Start by testing `OBR.viewport.getPosition()` and verify its exact semantics.

If necessary, calculate the center explicitly:

1. Get viewport width.
2. Get viewport height.
3. Find the center in screen coordinates.
4. Pass it through `OBR.viewport.inverseTransformPoint(...)`.

Conceptually:

```ts
const width = await OBR.viewport.getWidth();
const height = await OBR.viewport.getHeight();

const center = await OBR.viewport.inverseTransformPoint({
  x: width / 2,
  y: height / 2,
});
```

Do not assume camera-coordinate semantics without testing them in OBR.

---

# Polling Safety

The polling loop must not permit overlapping async executions.

Use a simple lock:

```ts
let pollInProgress = false;

async function pollViewport() {
  if (pollInProgress) return;

  pollInProgress = true;
  try {
    // Read viewport.
    // Determine current logical center tile.
    // Recycle tiles only if necessary.
  } finally {
    pollInProgress = false;
  }
}
```

Stop polling entirely when:

- No scene is ready.
- The scene has no enabled background.
- Local render distance is Off.

---

# Scene Lifecycle

Listen to scene readiness.

When a scene becomes ready:

1. Read scene background metadata.
2. Read the local render-distance setting.
3. If enabled and configured, initialize the renderer.
4. Begin viewport polling.

When the current scene closes or changes:

1. Stop polling.
2. Delete only this extension's local tile items.
3. Clear renderer state.
4. Wait for the next ready scene.

When scene metadata changes:

- If background is disabled, remove the tile pool.
- If background image changes, rebuild the pool with the new image.
- If scale changes, recalculate tile dimensions and rebuild/reposition.
- If origin changes, reposition the pool.
- Ignore unrelated scene metadata changes.

---

# Local Settings Changes

When render distance changes locally:

### Increasing render distance

Add only the additional local items required.

Example:

```text
Low:    25
Medium: 81
```

Add 56 items.

### Decreasing render distance

Delete surplus items owned by this extension.

Example:

```text
High:   169
Medium: 81
```

Delete 88 items.

Then assign the remaining pool to the desired logical region around the current camera.

### Off

Delete all background local items on that client and stop polling.

Do not modify shared scene metadata when a player changes their render distance.

---

# UI

Keep the UI deliberately small.

## GM View

Show two sections.

### Scene Background

Controls:

- Enabled toggle
- Current image preview/name
- Choose Image
- Replace Image
- Clear Background

Optional after the basic implementation is stable:

- Background scale
- Reset origin

Do not add unnecessary scene-management features.

### This Device

Render Distance:

- Off
- Low
- Medium
- High
- Extreme

Include a short note such as:

> Render distance only affects this device. Lower settings use fewer local image tiles.

## Player View

Players must not be allowed to edit the scene background.

Show:

- Current background status
- This Device render-distance setting

Do not merely hide GM controls cosmetically. Guard background-changing operations with a GM role check.

---

# Image Replacement

When the GM chooses a new image:

1. Update scene metadata.
2. Every client receives the metadata change.
3. Each client destroys or reconfigures its own local pool.
4. Each client renders the new texture at its own selected render distance.

There must be no synchronized tile creation.

---

# Clearing the Background

When the GM clears the background:

```ts
enabled = false
image = null
```

Every client must:

- Stop viewport polling.
- Delete all local tiles belonging to this extension.
- Retain its local render-distance preference for future scenes/backgrounds.

---

# Extension Isolation

Because `OBR.scene.local` is shared local-item infrastructure, be extremely conservative.

Never do this:

```ts
const items = await OBR.scene.local.getItems();
await OBR.scene.local.deleteItems(items.map(i => i.id));
```

That could destroy local items belonging to other extensions.

Instead identify this extension's items via its namespaced metadata tag.

Every cleanup path must affect only owned tiles.

---

# Scene Item Isolation

Verify that background tiles are never placed in `OBR.scene.items`.

Normal extensions calling:

```ts
OBR.scene.items.getItems()
```

should not see the background repetitions.

The tiled renderer must not inflate the synchronized scene object count.

---

# Seam Handling

Test adjacent tiles at multiple zoom levels.

Requirements:

- No deliberate gap between tile coordinates.
- No accumulating positional drift.
- Pattern alignment remains constant after long-distance panning.
- Returning to a previously visited location produces exactly the same tile alignment.

If Skia produces occasional hairline sampling seams between perfectly adjacent images, investigate a very small overlap or another renderer-safe adjustment.

Do not introduce overlap until an actual seam is observed because overlapping transparent or patterned textures may itself create artifacts.

---

# Error Handling

Handle at least:

- Image URL fails to load.
- Metadata is absent.
- Metadata is from an unknown future version.
- Image picker is cancelled.
- Scene changes while an async renderer operation is in progress.
- Local items disappear unexpectedly.
- Extension reloads while a scene is already open.
- Render distance changes during a pool update.

Prefer recovering by rebuilding this extension's local pool rather than leaving partially assigned tiles.

---

# Concurrency

Use a renderer generation/session token.

Example:

```ts
let rendererGeneration = 0;
```

Increment it whenever:

- Scene changes.
- Background changes.
- Renderer is stopped/restarted.

Async operations should capture the current generation and abort their result if that generation is no longer current.

This avoids a slow operation from the previous scene adding stale tiles after the user has switched scenes.

---

# Suggested Module Structure

Adapt this to the existing repository rather than rewriting the project's current architecture.

A reasonable separation would be:

```text
src/
  background/
    index.ts
    renderer.ts
    viewportWatcher.ts

  config/
    sceneConfig.ts
    localSettings.ts

  obr/
    imageFactory.ts
    localItems.ts

  ui/
    App.tsx
    SceneBackgroundSettings.tsx
    RenderDistanceSettings.tsx

  constants.ts
  types.ts
```

If the project already uses a different structure, follow the established style.

---

# Suggested Renderer Interface

Keep OBR-specific rendering logic behind a small interface.

For example:

```ts
class TiledBackgroundRenderer {
  start(config: BackgroundConfigV1, renderRadius: number): Promise<void>;

  stop(): Promise<void>;

  setRenderRadius(radius: number): Promise<void>;

  setConfig(config: BackgroundConfigV1): Promise<void>;

  updateCamera(worldCenter: Vector2): Promise<void>;
}
```

The renderer should own:

- Local item IDs.
- Tile dimensions.
- Logical coordinate assignments.
- Current center tile.
- Current render radius.
- Current configuration.

---

# Build Order

Implement in this order.

## Phase 1: Asset sharing spike

Prove that a GM-selected `ImageDownload` can be reconstructed as a local image on another connected client and after reload.

Do not proceed until this works reliably.

## Phase 2: One local tile

Render one selected image as:

- Local only
- MAP layer
- Very low z-index
- `disableHit`
- Locked

Verify it sits beneath ordinary maps.

## Phase 3: Static finite grid

Render a fixed 5x5 or 9x9 tile grid around world origin.

Verify:

- Seamless alignment
- No selection
- Correct z-order
- No synchronized scene items

## Phase 4: World-anchored pool

Implement logical tile coordinates and fixed world alignment.

Pan away and back.

Verify the pattern does not move.

## Phase 5: Recycling

Replace creation/deletion during panning with object recycling.

Verify object count remains constant while panning arbitrarily far.

## Phase 6: Viewport watcher

Add lightweight polling.

Only recycle when camera center enters a new logical tile.

Verify ordinary small pans generate no local-item updates.

## Phase 7: Render distance

Implement Off/Low/Medium/High/Extreme device-local settings.

Verify changing zoom does not alter pool size.

## Phase 8: Shared GM configuration

Implement scene metadata, image selection, enable/disable, replacement, and multi-client synchronization.

## Phase 9: Lifecycle hardening

Handle scene switches, reloads, late joiners, errors, and stale async operations.

## Phase 10: Performance testing

Stress-test High and Extreme render distances before deciding whether Extreme should ship enabled.

---

# Required Tests

## Object Count

At Medium render distance:

```text
Expected local background tiles: 81
```

Pan hundreds of tile widths in every direction.

Expected:

```text
81
```

Zoom extremely far out.

Expected:

```text
81
```

Zoom extremely far in.

Expected:

```text
81
```

Object count must not depend on zoom.

---

## Cross-Client Render Distance

GM:

```text
Extreme = 289
```

Player A:

```text
Medium = 81
```

Player B:

```text
Low = 25
```

All three clients must see the same world-aligned texture but maintain their own local object counts.

---

## Extreme Zoom-Out

At an unusually low zoom:

- The edge of the local rendered region may become visible.
- No additional tiles are created.
- No attempt is made to cover the entire viewport.
- No runaway allocation occurs.
- Panning still causes the bounded pool to follow the camera.

This is expected behavior, not a bug.

---

## Long-Distance Pan

Pan thousands of world units away and return to the starting location.

The same pattern coordinate must line up with the same scene coordinate as before.

There must be no cumulative drift.

---

## Scene Switch

Configure different backgrounds on Scene A and Scene B.

Switch repeatedly between them.

Verify:

- Correct image appears for each scene.
- Old local tiles are removed.
- No duplicate pools accumulate.
- Device render-distance preference remains unchanged.

---

## Late Join

Configure a background before another player enters the room.

When the player joins and the scene loads:

- Their extension reads the existing metadata.
- Their local renderer starts automatically.
- No GM interaction is required.

---

## Extension Reload

Reload a client while the configured scene remains open.

The renderer should reconstruct itself from:

```text
scene metadata + local render-distance setting
```

No persistent local tile state should be required.

---

## Background Replacement

Replace the texture while multiple clients are connected.

All clients should transition to the new image without accumulating stale local items.

---

## Background Removal

Clear the background.

All clients should remove only this extension's local tiles.

Other extensions' local items must remain untouched.

---

## Interaction Test

Attempt to:

- Click a tile.
- Box-select a tile.
- Drag a tile.
- Context-click a tile.

The background should behave as if no selectable scene object exists there.

---

## Other Extension Test

Install at least one extension that enumerates normal scene items.

Verify the tiled background does not appear in its normal `OBR.scene.items` enumeration.

Also test alongside an extension that uses `OBR.scene.local`, if available, to ensure our cleanup logic does not interfere with its local items.

---

# Performance Instrumentation

During development, expose debug information behind a development-only flag:

```text
Background enabled
Render radius
Pool size
Current camera tile X/Y
Number of tile moves during last update
Total local items owned by extension
Polling interval
Last renderer update duration
```

Do not ship noisy logging by default.

A useful development invariant is:

```ts
ownedLocalTileCount <= configuredPoolSize
```

Treat violation of that invariant as a bug.

---

# Non-Goals for Version 1

Do not implement:

- Truly infinite simultaneous rendering.
- Dynamic tile count based on visible viewport.
- Shader-based texture sampling.
- Post-process rendering tricks.
- DOM injection into Owlbear Rodeo.
- Animated background textures.
- Multiple background layers.
- Per-player scene background images.
- Procedural textures.
- Parallax.
- Rotation.
- Automatic supertiles/LOD.
- Network synchronization of individual tile positions.

These can be reconsidered later if real-world performance shows a need.

---

# Design Principle

The important mental model is:

```text
The scene owns the background definition.
Each device owns the rendering cost.
```

The GM chooses **what** the background is.

Each client independently chooses **how far** to render it.

The repeated images are disposable local renderer artifacts, not scene content.

---

# Definition of Done

The feature is complete when:

1. A GM can choose one image for a scene.
2. Every connected client sees that image tiled beneath the scene.
3. The texture remains fixed in world coordinates during panning.
4. The tiles cannot be selected or interacted with.
5. The tiles never enter `OBR.scene.items`.
6. Each device has its own render-distance setting.
7. The number of local tiles is strictly bounded by that setting.
8. Zooming out does not create additional tiles.
9. Panning recycles existing local items rather than continually creating and deleting them.
10. Scene switching, reloads, late joins, replacing an image, and clearing an image all work correctly.
11. The extension never alters local items belonging to another extension.
12. Performance remains acceptable at the default Medium setting on ordinary desktop and mobile hardware.

Build the simplest implementation satisfying these requirements before adding any additional features.