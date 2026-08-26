# OBR Battle Mat

OBR Battle Mat is an Owlbear Rodeo extension that repeats one GM-selected map image beneath a scene. The pattern is fixed to world coordinates, cannot be selected, and is visible to every client without adding synchronized scene items.

## How it works

- The GM-selected image and its grid, scale, and origin are stored in namespaced scene metadata.
- GMs can choose an Owlbear Rodeo map asset or a built-in background maintained in this repository.
- A manifest background page renders only `OBR.scene.local` image items on each client.
- A fixed-size pool follows the camera by recycling tiles only after the center crosses a tile boundary.
- Zoom never changes the pool size.
- Render distance is saved in namespaced `localStorage`, independently on each device.
- Every cleanup path filters on `com.ex-asperis.obr-battle-mat/local-tile` and leaves other extensions' local items untouched.

| Setting | Radius | Local tiles |
| --- | ---: | ---: |
| Off | 0 | 0 |
| Low | 2 | 25 |
| Medium | 4 | 81 |
| High | 6 | 169 |
| Extreme | 8 | 289 |

## Local development

```sh
pnpm install
pnpm run dev
```

Add `http://localhost:5173/manifest-local.json` as a development extension in Owlbear Rodeo. Open a scene, choose a map asset as the GM, and use a second client to verify that the selected asset URL can be reused across clients, reloads, and late joins.

## Verification

```sh
pnpm run check:identity
pnpm run check:versions
pnpm run typecheck
pnpm run test
pnpm run build
```

The pure pool tests verify bounded preset sizes, fixed logical coordinates, long-distance reassignment, and the nine-item update expected when a Medium pool moves one tile horizontally. Full acceptance testing also requires an Owlbear room to verify cross-client asset access, z-order beneath maps and grid, noninteraction, scene switching, and local-item behavior.

## Managing built-in backgrounds

Built-in images and their manually maintained catalog live in `public/backgrounds/`. To publish a background:

1. Add a PNG, JPEG, or WebP image to `public/backgrounds/` or a subfolder beneath it.
2. Add an entry to `public/backgrounds/manifest.json` with its display name, relative file path, columns, and rows:

   ```json
   {
     "name": "Stone Floor",
     "file": "stone-floor.webp",
     "columns": 8,
     "rows": 6
   }
   ```

3. Commit and push the image and manifest change to `main`, wait for the Azure Static Web Apps deployment, then use **Refresh** in the built-in gallery.

Catalog order controls gallery order. Removing an entry hides it from the gallery, but scenes that already use it retain its URL. Keep the underlying image hosted while those scenes may still need it. When changing an image's pixels, use a new filename so clients do not reuse a cached copy.

## Install

After deployment, add either manifest URL to Owlbear Rodeo:

```text
https://obr-battle-mat.ex-asperis.com/manifest.json
https://obr-battle-mat.ex-asperis.com/manifest-v0.2.0.json
```

Published by **ex Asperis**.
