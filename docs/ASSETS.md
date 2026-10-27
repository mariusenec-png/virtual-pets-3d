# 3D assets

## Currently used

| File                    | Species | Source                         | Rig / animations | Notes |
| ----------------------- | ------- | ------------------------------ | ---------------- | ----- |
| `public/models/cat.glb` | Cat     | Supplied by the project owner (self-made/generated) | None in the file (auto-rigged at load) | ~100k vertices, flat colors (no textures), faces +Z |
| `public/models/dog.glb` | Dog     | Supplied by the project owner (self-made/generated) | None in the file (auto-rigged at load) | ~17k vertices, 6 PNG textures, faces +X (rotated in config). Used from milestone 2 |

Both models are static meshes exported from Blender (glTF I/O 5.2). They are stylized,
not photorealistic.

## How models are used

`src/scene/pet/PetModel.tsx` loads the GLB, rotates it with `model.rotationY` from the
species config, puts the feet on the floor, centers it and normalizes it to 1 unit tall.
The growth-stage height from the species config (`stages.*.height`) then scales it.

### Automatic skeleton (milestone 7)

The GLBs ship without a skeleton, so one is generated when the model loads
(`src/scene/rig/autoRig.ts`):

1. **Landmarks** per species (`src/species/rigs.ts`) give the joint positions in normalized
   model space (facing +Z, feet at y = 0, 1 unit tall): pelvis, spine, chest, neck, head, front
   leg (shoulder, elbow, wrist, toe), hind leg (hip, knee, hock, toe) and 5 tail points. They
   were measured from slices of the model geometry. Left legs are listed; the right side mirrors.
2. **Bones** (21) are created from the landmarks.
3. **Skin weights**: every body vertex gets up to 4 bones, weighted by distance to the bone
   segments and softly gated by body region (left/right, front/back legs, tail, head) so a leg
   never pulls the other leg or the belly. Computed once per model (~0.2 s for the cat).
4. The body becomes a `SkinnedMesh`; eyes, nose, whiskers, ears and paws are attached rigidly to
   the bone that would dominate at their center (head, wrist, hock...).
5. Invisible ellipsoids on the spine and head bones receive clicks (raycasting a skinned 100k
   vertex mesh is too slow).

To rig a new model, add a `rig` entry with its landmarks. Without one the species falls back to
whole-body motion (`computePose` in `src/scene/pet/poses.ts`).

### Procedural animation

`src/scene/rig/animator.ts` builds a target pose every frame from layers and eases every bone
towards it: postures (stand, sit after a while idle, curled sleep / dogs stretched out, crouch),
a trot gait with phase-offset legs, knee and wrist flex, body bob and tail sway, idle head
look-around (split between neck and head), breathing, blinking and per-activity overlays (head in
the bowl while eating or drinking, pounce cycle while playing, head tilt and half-closed eyes when
petted, full-body shake after a bath, play-bow stretch when waking up, head shake when refusing,
low head and tail when ill). Dogs wag faster and wider the happier they are; cats hold the tail up
when content and low when unhappy. This is procedural motion, not motion capture: it is fluid,
but not as rich as hand-made animation clips.

### Autonomous behavior (milestone 8)

`src/scene/pet/behaviors.ts` picks what the pet does while idle (weights by species,
personality, needs and health); `Pet.tsx` walks it there and the animator plays the matching
overlay (window, watch, groom, sniff, toy, tail chase, rest, stretch, begging by the bowl). Tricks
(`trick` / `confused` activities) have their own overlays; Roll over also rolls the whole model
around the body center (`computeRiggedOuterPose`).

## Furniture (milestone 9)

All furniture is procedural three.js geometry (`src/scene/decor/furnitureModels.ts`), no external
models or textures (the rope and tile patterns are drawn on a canvas). The catalog with prices,
comfort and what pets do with each piece is in `src/config/decor.ts`.

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
- On rigged models the shells are separate skinned meshes sharing the skeleton, so fur moves with
  the body.
- Fur writes no alpha to the canvas (otherwise the page background would shine through and the
  coat would look frosted).

Limitations: shells look best from the side; at grazing angles on very thin parts (tail tip, ear
edges) individual layers can be visible. Fur color follows the base material color/texture and the coat markings.

## Coat markings

`src/scene/coat/coat.ts` paints markings in the shader from the rest-pose position, on the skin and
the fur alike: the cat is a grey mackerel tabby (stripes around body, legs and tail, darker back,
pale belly and chest, light paws); the dog gets a darker back and a lighter belly over its
texture. Configured per species in `coat` (`src/species/cat.ts`, `dog.ts`).

## Lighting

Besides the sun, sky and window lights, the scene uses three's procedural `RoomEnvironment`
(`src/scene/SoftEnvironment.tsx`) as soft image-based light. No HDR files are downloaded.

If a model fails to load, `PlaceholderPet` (built from primitives) is shown and the UI
labels it "Placeholder model".

## Upgrading to animated models later

For hand-made animation, a rigged GLB with clips is needed. Suggested clip names so they can be
mapped automatically later: `Idle`, `Walk`, `Eat`, `Drink`, `Play`, `Sleep`, `Happy`, `Shake`.
Per growth stage you can either ship separate models (`cat-baby.glb`, …) or keep one model and
rely on scaling. Always record the license and source of downloaded assets in this file.
