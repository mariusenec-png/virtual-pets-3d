# 3D assets

## Currently used

| File                    | Species | Source                         | Rig / animations | Notes |
| ----------------------- | ------- | ------------------------------ | ---------------- | ----- |
| `public/models/cat.glb` | Cat     | Supplied by the project owner (self-made/generated) | None | ~100k vertices, flat colors (no textures), faces +Z |
| `public/models/dog.glb` | Dog     | Supplied by the project owner (self-made/generated) | None | ~17k vertices, 6 PNG textures, faces +X (rotated in config). Used from milestone 2 |

Both models are static meshes exported from Blender (glTF I/O 5.2). They are stylized,
not photorealistic.

## How models are used

`src/scene/pet/PetModel.tsx` loads the GLB, rotates it with `model.rotationY` from the
species config, puts the feet on the floor, centers it and normalizes it to 1 unit tall.
The growth-stage height from the species config (`stages.*.height`) then scales it.

Because there is no skeleton, all motion is **procedural** (`src/scene/pet/poses.ts`):
walking bob, leaning into bowls, hopping, squashing when petted, lying down to sleep,
shaking after a bath. This is a fallback, not real character animation.

## Fur

Fur is rendered in real time with **shell texturing** (`src/scene/fur/furShells.ts`): the body
mesh (the mesh with the most vertices, or `fur.bodyMeshName`) is drawn 12 or 24 extra times in a
single instanced draw call, each copy pushed further out along the normals. A procedural strand
pattern in the shader keeps only the hair strands, which taper towards the tips, droop slightly and
sway. No fur textures or UVs are required.

- Fur look per species: `fur` in `src/species/cat.ts` / `dog.ts` (length, density, droop, shading).
- Quality (Off / Low / High = 0 / 12 / 24 shells): Settings → Fur. Stored in the save.
- Fur fades out near other parts of the model (eyes, nose, mouth, whiskers, ears, paws) using a
  per-vertex mask computed once when the model loads.
- Fur flattens while wet during a bath and slowly dries afterwards; it darkens with dirt like the body.
- Fur is on render layer 1, so contact shadows ignore it, and it never intercepts clicks.

Limitations: shells look best from the side; at grazing angles on very thin parts (tail tip, ear
edges) individual layers can be visible. Fur color follows the base material color/texture.

If a model fails to load, `PlaceholderPet` (built from primitives) is shown and the UI
labels it "Placeholder model".

## Upgrading to animated models later

For real animation, a rigged GLB with clips is needed. Suggested clip names so they can be
mapped automatically later: `Idle`, `Walk`, `Eat`, `Drink`, `Play`, `Sleep`, `Happy`, `Shake`.
Per growth stage you can either ship separate models (`cat-baby.glb`, …) or keep one model and
rely on scaling. Always record the license and source of downloaded assets in this file.
