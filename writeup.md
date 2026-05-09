# Taumako Star Navigation Viewer Notes

These notes summarize what was learned across two implementation passes so the project can be restarted from scratch without losing useful context.

## Goal

Build an interactive visualization inspired by the Taumako Island Polynesian navigation diagram in `reference/tntm.pdf`.

The target visual is not a physically exact astronomy simulator. It is an approximate, respectful recreation of the diagram's conceptual sky: a south-facing horizon dome with local Taumako star names, star-motion paths, islands, a voyaging boat, and the Taumako wind compass beneath the boat.

## Reference Assets

The workspace initially contained only:

- `reference/tntm.pdf`
- `reference/boat.svg`
- `reference/compass.ai`

There was no app scaffold and no git repository metadata in this folder.

### `reference/tntm.pdf`

This is the primary composition reference. Useful observations:

- The diagram title reads `Nga Hetu o Lata`.
- The view is toward the south.
- The horizon is a gentle arch across the middle/lower-middle of the image.
- The sky is deep navy with a brighter blue band near the horizon.
- The sea/globe area uses curved latitude-like and longitude-like grid lines.
- Star paths are dashed blue arcs with arrowheads.
- Stars are yellow, drawn as bright hand-diagram style star glyphs.
- Local labels are ochre/yellow and feel hand-lettered.
- Cardinal letters are large, white, and hand-lettered:
  - `S` near the upper center.
  - `E` on the left.
  - `W` on the right.
  - `N` near Taumako at the bottom.
- The boat is in white in the lower third, centered above the wind compass.
- The boat is visually traveling from Taumako toward the central Vanuatu/Santos direction.
- Islands are green shapes with white labels.

Important star/group placements from the reference:

- `Takelo` is on the right side and corresponds to Orion's belt / Orion area.
- `Kaua Kona` is near the center and corresponds to the Southern Cross / Crux.
- The right side also includes bird-related figures:
  - `Sino`
  - `Te Manu`
  - `Papakau`
  - `Papakau Ndeni`
- The left side includes:
  - `Salo Lavoi`
  - `Ohaa`
  - `Kilika`
- The upper middle-left includes:
  - `Salo Tapio`
  - `Lau`
  - `Lae Ohaa`
- The lower middle includes:
  - `Luoonaii`
  - `Hetu Mdayo`
- The lower right includes:
  - `Hakangi`

Important island placements:

- `TAUMAKO` is large and green near the bottom center-left.
- `Anuta` is left of center, below the horizon.
- `Tikopia` is left of center, near the horizon.
- `Torres Is.` is near the center-left horizon.
- `SANTOS / Vanuatu` is slightly right of center above the boat direction.
- `Vanikoro` and `Uturoa` are near the center-right.
- `Reef Is.` is lower right.
- `Nendo` is far lower right.

### More Complete Star/Wind Extraction

The other implementation pass extracted a fuller star table. Treat this as a working catalog, not final scholarship: several spellings should be checked against high-resolution crops before locking UI copy.

| Polynesian name | Translation / association | Diagram location | Wind / season note |
| --- | --- | --- | --- |
| `Salo Lavoi` | Good Taro | Far left, mid altitude | `Lae Te Matangi` / no special wind |
| `Salo Tapio` | Bad Taro | Upper left-of-center | `Lae Te Matangi` / no special wind |
| `Lau` | Leaves | Cluster near `Salo Tapio` | Small leaf pattern |
| `Lae Ohaa` | No Fruit | Center-left | Between `Lau` and `Luoonaii` |
| `Ohaa` | Fruit | Far left, low | Close to the horizon sequence |
| `Kilika` | Sharkskin tool | Far left, very low | `Lae Te Matangi me Kona` / no strong wind |
| `Paeikea` | Crab | Below horizon, left | Black-shape note; wind from Tokelau |
| `Ula` | Crayfish | Below horizon, left/lower center | Black-shape note; no special wind |
| `Hetu Mdayo` / `Hetu Mdavo` | Star cluster | Lower left-of-center | `Nga Langi Lima I Te Angeho` / five days of westerlies |
| `Luoonaii` / `Louonaii` | Two Eyes | Center/lower center | One day of strong wind, any or variable direction |
| `Kaua Kona` | Southern Cross / Crux | Center, upper | `Lae Te Matangi` / no special wind |
| `Sino` | Body of the Bird | Upper right | `Lae Te Matangi` / no special wind |
| `Te Manu` | The Bird | Mid right | Bird figure connecting `Sino`, `Papakau`, and lower wing points |
| `Papakau` | Wing of the Bird | Far upper right | `Lae Te Matangi Me Kona` / no special wind |
| `Papakau Ndeni` | Wing of the Bird | Mid right | One day of strong wind from the tradewind direction |
| `Takelo` | Orion's Belt / Orion area | Far right, low | `Nga Akahu Lua`; starts when `Takelo` sets |
| `Hakangi` | Strong westerlies | Lower right | Strong westerlies for five days |

Spelling caution from comparing passes: verify `Te Ngatai` versus `Te Ngalu`, `Te Hakahiu` versus `Te Hakahiti`, `Luoonaii` versus `Louonaii`, and `Hetu Mdayo` versus `Hetu Mdavo` directly from the PDF before a final public version.

The diagram also shows horizon hints on both sides:

- `I Luna` means above the horizon.
- `Te Moanga` means the horizon.
- `I Lalo` means below the horizon.

### Rendering The PDF

The environment did not have Poppler, ImageMagick, Ghostscript, mutool, or Inkscape:

- `pdfinfo`: not installed
- `pdftoppm`: not installed
- `magick`: not installed
- `convert`: not installed
- `gs`: not installed
- `mutool`: not installed
- `inkscape`: not installed

macOS Quick Look was available and worked:

```sh
mkdir -p .tmp/ref-previews
qlmanage -t -s 2200 -o .tmp/ref-previews reference/tntm.pdf
qlmanage -t -s 1800 -o .tmp/ref-previews reference/compass.ai
```

This produced:

- `.tmp/ref-previews/tntm.pdf.png`
- `.tmp/ref-previews/compass.ai.png`

Those previews were enough to inspect layout, colors, relative positions, and compass structure.

Another pass found `sips` useful for higher-resolution PDF crops on macOS. The important gotcha is that `sips -c` takes height before width, and crop offset as y before x:

```sh
sips -s format png -Z 4000 reference/tntm.pdf --out /tmp/tntm.png
sips -g pixelHeight -g pixelWidth /tmp/tntm.png
sips -c 1500 1500 --cropOffset 0 0 /tmp/tntm.png --out /tmp/topleft.png
```

Use Quick Look first for full-page inspection, then `sips` crops if a label needs closer reading.

### `reference/boat.svg`

The boat asset is already an SVG and is clean enough to copy directly into `public/boat.svg`.

It has:

- `viewBox="0 0 50.13 56.31"`
- White fill only
- A narrow vertical/canoe-like silhouette

In the first pass, it was placed above the compass, centered in the lower third, with a subtle drop shadow.

### `reference/compass.ai`

The `.ai` file is actually PDF-backed:

```sh
file reference/compass.ai
```

returned:

```text
reference/compass.ai: PDF document, version 1.5, 1 pages
```

Quick Look can rasterize it. The visible compass structure:

- Outer red arc labeled `Te Ngatai - Tradewind`.
- Outer green arc labeled `Te Angeho - Cyclone`.
- Gray, orange, yellow, and pale-yellow wind strength bands.
- Blue inner directional ring.
- Large blue radial tabs/points labeled:
  - `Te Alunga`
  - `Te Tonga`
  - `Te Ulu`
  - `Te Laki`
  - `Te Hakahiu`
  - `Te Tokelau`
  - `Te Palapu`
  - `Te TokelauTu`

The first pass did not perfectly convert the Illustrator geometry. Instead, it created a hand-traced `public/compass.svg` inspired by the asset. This was much more controllable and avoided adding a conversion dependency.

The other pass identified the compass as a 32-point wind/star compass. Good restart approach:

- Draw a dark blue gear-tooth backing with 32 alternating-radius wedges.
- Draw annulus segments for colored wind bands rather than trying to trace one huge path.
- Use SVG `<textPath>` for curved labels.
- Reverse bottom-half text paths so text reads left-to-right instead of upside down.
- Keep the boat as a separate overlay on top of the compass rather than embedding it inside the compass SVG.

## Implementation Stack

The first pass used:

- Vite
- React
- React Three Fiber
- Three.js
- lucide-react
- Playwright for verification

This was a reasonable fit because:

- The sky stars benefited from canvas/WebGL rendering.
- SVG remained better for diagrammatic overlays like horizon, grid, paths, islands, and compass.
- React state was useful for toggles, selection, hover panels, time slider, zoom, and pan.

The app structure created:

- `index.html`
- `package.json`
- `src/main.jsx`
- `src/App.jsx`
- `src/styles.css`
- `public/boat.svg`
- `public/compass.svg`
- `public/favicon.svg`

The other implementation used a more modular layout that is worth copying on a clean restart:

```text
src/
  App.tsx
  App.css
  index.css
  types.ts
  data/
    stars.ts
  assets/
    boat.svg
    Compass.tsx
  scene/
    SkyScene.tsx
    Foreground.tsx
    Controls.tsx
```

The key lesson is to make `data/stars.ts` the single source of truth for constellation positions, lines, label anchors, alignment, and descriptions. Iterating the renderer is much easier when the star catalog is not mixed into component code.

## Important Implementation Decisions

### Use R3F Only Where It Helps

The first pass used React Three Fiber for stars and background star dots only. The rest of the diagram was SVG/HTML:

- R3F:
  - Yellow star glyphs.
  - Sparse background stars.
  - Star click/hover hit targets.
- SVG overlay:
  - Horizon.
  - Sea/globe area.
  - Grid lines.
  - Dashed star paths and arrowheads.
  - Constellation connecting lines.
  - Island silhouettes.
- HTML:
  - Local labels.
  - Control panel.
  - Selected star information panel.
  - Cardinal direction letters.
  - Boat and compass image layers.

This split was easier than trying to draw all labels and UI in WebGL.

The other pass pushed more of the sky into R3F, including lines, grid, horizon, and label anchors, then kept the compass/boat/islands/title as foreground HTML/SVG. Both splits are viable. The durable rule is: sky geometry can live in R3F, but the compass and dense curved typography should stay SVG/HTML.

### Approximate Diagram Coordinates

The first pass treated the reference image as a 100 by 100 coordinate system. Star positions, labels, islands, and path control points were manually placed as percentages.

This worked well for matching the diagram because the target is a conceptual map rather than a strict celestial projection.

### Projection Lesson

The other implementation spent time testing a literal celestial dome and found a major trap: a normal perspective camera with a typical FOV cannot show a full hemisphere cleanly. Stars at high altitude get clipped or crammed into the top edge. Tilting the camera loses the horizon, and extreme FOV values create fish-eye distortion.

The better model is a stylized panoramic projection: treat azimuth and altitude as inputs, then map them into a wide, mostly 2D stage with a slight bowl/depth curve.

```ts
function toCart(az: number, alt: number, rPad = 0): [number, number, number] {
  const xN = az / 100;
  const yN = alt / 90;
  const x = xN * (WIDTH / 2);
  const y = HORIZON_Y + (TOP_Y - HORIZON_Y) * yN ** 0.85;
  const bowl = Math.cos((xN * Math.PI) / 2) * 1.6;
  const horizonArch = (1 - Math.abs(xN)) * 0.5 * Math.max(0, 1 - yN * 4);

  return [x, y + horizonArch, DEPTH + bowl + rPad];
}
```

For this project, matching the illustration matters more than matching astronomy. Start with either percentage coordinates or a panoramic projection. Do not spend the early pass fighting spherical camera math.

### Local Labels

Labels were implemented as clickable HTML buttons positioned over the sky. This made interactions simple and accessible.

Important labels included:

- `Takelo` with translation `Orion's belt`.
- `Kaua Kona` with translation `Southern Cross`.

Other labels were included to fill out the visual field and match the reference:

- `Salo Lavoi`
- `Ohaa`
- `Kilika`
- `Salo Tapio`
- `Lau`
- `Lae Ohaa`
- `Luoonaii`
- `Sino`
- `Papakau`
- `Te Manu`
- `Papakau Ndeni`
- `Hakangi`
- `Hetu Mdayo`

### Interaction Model

Useful controls:

- Play/pause star motion.
- Toggle local labels.
- Toggle horizon/grid lines.
- Toggle star-motion paths.
- Toggle wind compass.
- Reset view.
- Time slider.
- Zoom slider.
- Drag/pan the scene.
- Click a star label or star glyph to update the selected body panel.

This gave the piece enough interactivity without turning it into a complicated astronomy app.

The other pass found layer toggles valuable for debugging, not just as user features. Being able to hide field stars, grid, labels, motion arcs, and horizon hints makes it much faster to tune the visual stack.

For hover interactions in an R3F-heavy version, use invisible larger hit meshes around stars. Keep HTML labels `pointer-events: none` if label hover interferes with star hover; or use clickable HTML labels if accessibility is more important than pure 3D picking.

### Star Movement

The first pass animated stars subtly along per-constellation motion vectors and animated the dashed path offsets. This suggests star travel without needing real astronomy calculations.

The reference uses arcing arrows to show conceptual star movement. The important thing visually is the sense of east-to-west/arched motion across the southern sky.

Another useful interaction from the other pass was a sky-rotation slider, roughly `-30deg` to `+30deg`, applied as an azimuth offset. It is a cheap way to demonstrate diurnal motion while keeping the layout diagrammatic.

### Compass Placement

Initial placement made the compass too large and too high, obscuring the sky. Better placement:

- Desktop: compass around 28vw wide, low in the frame.
- Mobile: larger relative width, but lower-middle, leaving important star labels visible.

The boat should remain centered above the compass and visually aligned with the direction arrow.

### Compass SVG Construction

For a stronger second pass, build the compass as a React SVG component rather than a static traced SVG. This makes text, colors, and segment angles easier to revise.

Useful helper:

```ts
function annulusPath(cx, cy, ri, ro, startAng, endAng) {
  const p1 = polar(cx, cy, ro, startAng);
  const p2 = polar(cx, cy, ro, endAng);
  const p3 = polar(cx, cy, ri, endAng);
  const p4 = polar(cx, cy, ri, startAng);

  return `M ${p1.x} ${p1.y}
          A ${ro} ${ro} 0 0 1 ${p2.x} ${p2.y}
          L ${p3.x} ${p3.y}
          A ${ri} ${ri} 0 0 0 ${p4.x} ${p4.y} Z`;
}
```

Notes from the other pass:

- Use `<textPath href="#arc-id">` for each curved label.
- If a segment's mid-angle is on the bottom half, reverse the text arc so the label is readable.
- Use 32 alternating-radius wedges for the dark backing behind the rings.
- Use the reference colors as a guide: red tradewind band, green cyclone band, blue directional tabs, yellow/orange wind strength bands, dark blue backing.
- The compass is typography-heavy. SVG is the right abstraction.

### Background Stars

The first background-star attempt was too large and looked like gray circles. Better:

- Keep background stars tiny.
- Keep opacity low.
- Let named yellow stars carry the visual weight.

The named stars should read as yellow star glyphs, not as glowing bubbles.

If using a richer 3D field-star layer, the other pass found these values reasonable:

- About 180 field stars. More than roughly 250 starts fighting the named constellations.
- Azimuth range around `[-100, 100]`, altitude range around `[3, 90]`.
- Magnitudes around `2.8` to `5.3`.
- Star core size roughly `max(0.025, 0.11 - magnitude * 0.018)`.
- Two transparent halo meshes at about `1.6x` and `2.6x` can replace bloom/postprocessing.
- Use `meshBasicMaterial` and `toneMapped={false}` to keep yellow stars saturated.

## Styling Notes

The reference style is a diagram, not a dashboard. Useful visual choices:

- Deep navy background.
- Slight brighter blue near horizon.
- Blue dashed arcs with arrowheads.
- Thin translucent grid lines.
- Yellow star glyphs.
- Ochre/yellow labels.
- Green island shapes.
- White boat and cardinal letters.
- Hand-lettered feel for labels and cardinal marks.

Avoid:

- Large decorative circles or heavy glows around every star.
- Oversized UI panels that dominate the map.
- A generic space-app look.
- Overly realistic starfield treatment.

## Toolchain Gotchas

### Vite Build Script

Do not set:

```json
"build": "vite"
```

That starts a dev server. Use:

```json
"build": "vite build"
```

### React Import

Without `@vitejs/plugin-react`, JSX in this setup needed an explicit React import in component files:

```js
import React, { useEffect, useMemo, useRef, useState } from 'react';
```

Otherwise the app crashed with:

```text
React is not defined
```

An alternative clean restart could install and configure `@vitejs/plugin-react`, but the first pass avoided the plugin and used the explicit import.

### Invalid npm Tag

This package entry was invalid:

```json
"@vitejs/plugin-react": "^latest"
```

NPM rejected it with:

```text
Invalid tag name "^latest"
```

Use a concrete semver range or omit the plugin.

### Canvas Pixel Verification

For Playwright to inspect the canvas pixels, the R3F canvas should preserve the drawing buffer:

```jsx
<Canvas
  orthographic
  camera={{ position: [0, 0, 10], zoom: 80 }}
  gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
>
```

This allowed `gl.readPixels` checks to confirm the canvas was nonblank and that yellow star pixels existed.

### Raw Chrome Headless WebGL

Playwright with local Chrome worked in this pass. The other pass found that raw Chrome `--headless` may fail WebGL unless explicit GPU/WebGL flags are provided. If a screenshot shows only HTML overlays or the console says `THREE.WebGLRenderer: A WebGL context could not be created`, try:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --enable-webgl \
  --ignore-gpu-blocklist \
  --use-angle=metal \
  --window-size=1800,1100 \
  --virtual-time-budget=4000 \
  --screenshot=/tmp/page.png \
  http://localhost:5173/
```

Remove stale screenshot files before each run; Chrome can leave a zero-byte or old image when it fails.

### TypeScript Gotchas

If the clean restart uses React + TypeScript:

- Run `tsc --noEmit` early.
- Strict mode fails on unused destructured props.
- With the modern JSX runtime, do not import `React` unless the setup actually needs it.
- `@react-three/drei` can reduce boilerplate: `<Line>` helps with constellation/grid lines, and `<Html>` helps with labels anchored to 3D positions.

### Dev Server Port

Port `5173` was already in use during the first pass, so Vite moved to:

```text
http://localhost:5174/
```

A clean restart may use `5173` if it is free.

### Responsiveness

The other pass was tuned around a wide `1800x1100` screenshot and noted that it was not responsive below roughly `1400px`. This pass added mobile checks at `390x844`, which caught compass scale and panel overlap issues. Decide early whether mobile matters, because the lower-third compass, foreground Taumako island, labels, and controls compete for the same space.

## Verification Used

The first pass verified:

```sh
npm run build
```

and used Playwright with local Google Chrome to check:

- Desktop render at `1440x900`.
- Mobile render at `390x844`.
- Canvas exists and is visible.
- Canvas pixels are nonblank.
- Yellow star pixels are present.
- All 15 labels render.
- Clicking `Takelo` updates the selected panel heading to `Takelo`.
- Toggling labels removes labels.
- Toggling compass hides the compass.
- No console/page errors during final render.

Example final verification result:

```json
[
  {
    "case": "desktop",
    "stats": {
      "w": 1468,
      "h": 918,
      "lit": 13600,
      "yellow": 4506,
      "labels": 15,
      "afterClick": "Takelo"
    },
    "errors": []
  },
  {
    "case": "mobile",
    "stats": {
      "w": 397,
      "h": 860,
      "lit": 2861,
      "yellow": 778,
      "labels": 15
    },
    "errors": []
  }
]
```

## Suggested Restart Plan

1. Re-render `reference/tntm.pdf` and `reference/compass.ai` with Quick Look if richer inspection is needed.
2. Use `sips` crops for label spellings and compass details that are hard to read in the full-page preview.
3. Scaffold a Vite React app. React + TypeScript is fine if the data model is split out early.
4. Copy `reference/boat.svg` into the app as an asset.
5. Create `data/stars.ts` before building much UI. Include each constellation's position, stars, line pairs, label anchor, alignment, description, and wind note.
6. Choose the sky projection up front: percentage coordinates or the stylized panoramic `toCart()` approach. Skip literal celestial-sphere camera work for the first pass.
7. Recreate the compass as SVG rather than depending on Illustrator conversion.
8. Build the diagram as layered systems:
   - Background gradient.
   - R3F star canvas.
   - SVG horizon/grid/path/island overlay.
   - HTML local-label layer.
   - Compass and boat layer.
   - Control and selection UI.
9. Add layer toggles early so visual debugging is easy.
10. Get screenshot verification working before deep tuning. For raw Chrome, use the WebGL flags above; for Playwright, use local Chrome and preserve the canvas drawing buffer.
11. Tune layout from screenshots, especially:
   - Compass size and vertical position.
   - Star label crowding.
   - Mobile control panel overlap.
   - Whether the Southern Cross and Orion/Takelo are clearly visible.
   - Whether islands sit naturally on the curved horizon.
12. Run production build and Playwright screenshot/pixel checks before calling it done.

## Most Valuable Lessons

- Quick Look is enough to inspect both the PDF and Illustrator-backed compass in this environment.
- The compass is better recreated manually as SVG than converted automatically.
- A hybrid R3F/SVG/HTML approach is simpler and more reliable than making everything WebGL.
- The reference is conceptual. Manual percentage placement is acceptable and efficient.
- A stylized panoramic projection is a better starting point than a literal celestial dome.
- Keep star data in one typed/catalog file; do not bury positions throughout components.
- Use layer toggles as debugging tools from the beginning.
- Build the compass with annulus segments, text paths, and a 32-point backing if fidelity matters.
- Keep background stars very small. Named stars and labels should dominate.
- The boat and compass must sit low enough that the sky remains readable.
- Final verification should include screenshots, canvas pixel checks, WebGL error checks, and at least one real interaction.
