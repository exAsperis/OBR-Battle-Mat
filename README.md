# OBR Battle Mat

OBR Battle Mat is an Owlbear Rodeo extension that repeats one GM-selected map image beneath a scene. The pattern is fixed to world coordinates, cannot be selected, and is visible to every client without adding synchronized scene items.

## How it works

- The GM-selected image and its grid, scale, and origin are stored in namespaced scene metadata.
- GMs can choose an Owlbear Rodeo map asset or a public background maintained in this repository.
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

## Managing public backgrounds

Public images and their manually maintained catalog live in `public/backgrounds/`. To publish a background:

1. Add a PNG, JPEG, or WebP image to `public/backgrounds/` or a subfolder beneath it.
2. Add an entry to `public/backgrounds/manifest.json` with its display name, relative file path, columns, rows, rights information, AI disclosure, and one or more collections. `creator` is required; `license` and additional rights fields are optional:

   ```json
   {
     "name": "Stone Floor",
     "file": "stone-floor.webp",
     "columns": 8,
     "rows": 6,
     "rights": {
       "creator": "Artist Name",
       "license": "CC BY 4.0",
       "source": "https://example.com/original"
     },
     "ai": false,
     "collection": ["Interior", "Fantasy"]
   }
   ```

3. Commit and push the image and manifest change to `main`, wait for the Azure Static Web Apps deployment, then use **Refresh** in the public gallery.

Catalog order controls gallery order. Removing an entry hides it from the gallery, but scenes that already use it retain its URL. Keep the underlying image hosted while those scenes may still need it. When changing an image's pixels, use a new filename so clients do not reuse a cached copy.

### Contributing a public background

Contributions are welcome through pull requests:

1. Fork this repository and create a branch for your background.
2. Add the PNG, JPEG, or WebP file beneath `public/backgrounds/`. Use a descriptive, unique filename and optimize the image for web delivery before committing it.
3. Add the image to `public/backgrounds/manifest.json` using the structure above. Set `rights.creator` to the name that should be displayed, include the license and source when applicable, disclose generative-AI use accurately with `ai`, and assign every applicable label in the `collection` array. Prefer an existing collection when it fits.
4. Run the verification commands documented above and test the image through the local public-background gallery.
5. Open a pull request describing the image, its source or creation process, its license or your permission to contribute it, and any attribution requirements.

Only contribute images you have the right to redistribute. By submitting a pull request, you confirm that the project may host and display the image under the stated rights information. Maintainers may request file-size, formatting, metadata, collection, licensing, or attribution changes before merging.

## Install

After deployment, add either manifest URL to Owlbear Rodeo:

```text
https://obr-battle-mat.ex-asperis.com/manifest.json
https://obr-battle-mat.ex-asperis.com/manifest-v0.2.0.json
```

Published by **ex Asperis**.
