import * as THREE from 'three';
import { COAT_FRAGMENT_HEAD, COAT_VARYINGS, COAT_VERTEX, type CoatUniforms } from '../coat/coat';

/**
 * Shell-based fur.
 *
 * The body mesh is drawn N extra times (one instanced draw call, or N skinned
 * meshes sharing the skeleton when the body is rigged), each copy pushed a
 * little further out along the vertex normals. A procedural strand
 * pattern in the fragment shader keeps only the pixels that belong to a hair
 * strand, and strands taper with height. The result reads as a soft coat
 * without needing any fur textures or UVs.
 *
 * Vertices close to other parts of the model (eyes, nose, mouth, whiskers,
 * paws) get a per-vertex mask so the fur never covers the face details.
 */

export interface FurOptions {
  /** Number of shells (layers). 0 disables fur. */
  shells: number;
  /** Fur length as a fraction of the whole model height. */
  lengthRatio: number;
  /** Strands per model height (higher = finer fur). */
  densityPerHeight: number;
  /** How much the tips droop (fraction of fur length at the tip). */
  gravity: number;
  /** Brightness at the root (0..1) - fakes self-shadowing inside the coat. */
  rootShade: number;
  /** Random per-strand brightness variation (0..1). */
  strandVariation: number;
  /** How much strands lean along the body (combed coat), fraction of fur length. */
  comb?: number;
  /** How much strand tips gather into small tufts (0..1). */
  clump?: number;
  /** Soft light on the silhouette, like light scattering through hair (0..1). */
  rim?: number;
  /** Strength of the silky highlight running across the strands (0..1). */
  sheen?: number;
  /** Fur length per body region (1 = lengthRatio). */
  profile?: FurProfile;
}

export interface FurProfile {
  body: number;
  legs: number;
  head: number;
  tail: number;
  chest: number;
  belly: number;
}

/**
 * Where the body regions are, in normalized model space (facing +Z, feet at
 * y = 0, 1 unit tall), so fur can be longer on the tail and chest, shorter
 * on the face and legs, and combed from head to tail.
 */
export interface FurLayout {
  /** Body-mesh local space -> normalized model space. */
  toModel: THREE.Matrix4;
  regions: { legTop: number; tailStartZ: number; neckZ: number };
  /** Base of the tail (y, z) in normalized model space. */
  tailBase: [number, number];
}

/** Direction of the main light (world space), used for the fur sheen. */
const SHEEN_LIGHT_DIR = new THREE.Vector3(2.5, 4.5, 2.5).normalize();

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Per-vertex fur length multiplier and combing direction (body-local).
 * Pure CPU work, done once per fur build.
 */
function furLayoutAttributes(
  geometry: THREE.BufferGeometry,
  layout: FurLayout,
  profile: FurProfile,
): { length: Float32Array; flow: Float32Array } {
  const pos = geometry.getAttribute('position');
  const length = new Float32Array(pos.count);
  const flow = new Float32Array(pos.count * 3);
  const { legTop, tailStartZ, neckZ } = layout.regions;
  const back = new THREE.Matrix4().copy(layout.toModel).invert();
  const v = new THREE.Vector3();
  const f = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(layout.toModel);
    const leg = 1 - smoothstep(legTop - 0.05, legTop + 0.04, v.y);
    const tail = (1 - smoothstep(tailStartZ - 0.03, tailStartZ + 0.04, v.z)) * (1 - leg);
    const head = smoothstep(neckZ - 0.02, neckZ + 0.08, v.z) * smoothstep(legTop, legTop + 0.1, v.y) * (1 - leg);
    const torso = (1 - leg) * (1 - tail) * (1 - head);
    const chest = torso * smoothstep(neckZ - 0.22, neckZ - 0.04, v.z) * (1 - smoothstep(legTop + 0.15, legTop + 0.3, v.y));
    const belly = torso * (1 - chest) * (1 - smoothstep(legTop + 0.01, legTop + 0.1, v.y));
    let len = profile.body;
    len += (profile.belly - len) * belly;
    len += (profile.chest - len) * chest;
    len += (profile.head - len) * head;
    len += (profile.tail - len) * tail;
    len += (profile.legs - len) * leg;
    length[i] = len;

    // Combing: from the nose backwards, down the legs, out along the tail.
    f.set(0, -0.45, -1).multiplyScalar(torso);
    f.addScaledVector(tmp.set(0, -0.25, -1), head);
    f.addScaledVector(tmp.set(0, -1, 0.05), leg);
    tmp.set(0, v.y - layout.tailBase[0], v.z - layout.tailBase[1]);
    if (tmp.lengthSq() > 1e-6) f.addScaledVector(tmp.normalize(), tail);
    if (f.lengthSq() < 1e-6) f.set(0, -1, 0);
    f.transformDirection(back);
    flow[i * 3] = f.x;
    flow[i * 3 + 1] = f.y;
    flow[i * 3 + 2] = f.z;
  }
  return { length, flow };
}

export interface FurHandle {
  /** Add this as a child of the body mesh. */
  object: THREE.Object3D;
  /** Updates sway time and the length/density multipliers (wet fur, growth stage). */
  update(time: number, lengthScale: number, densityScale?: number): void;
  dispose(): void;
}

/** Render layer used for fur so helper passes (contact shadows) can skip it. */
export const FUR_LAYER = 1;

const tmpV = new THREE.Vector3();

/**
 * Builds a per-vertex mask (0 = no fur, 1 = full fur) that fades fur out near
 * the vertices of `excluded` meshes. Uses a spatial hash so it stays fast for
 * ~100k-vertex bodies.
 */
function buildFurMask(body: THREE.Mesh, excluded: THREE.Mesh[], radius: number): Float32Array {
  const pos = body.geometry.getAttribute('position') as THREE.BufferAttribute;
  const mask = new Float32Array(pos.count).fill(1);
  if (excluded.length === 0 || radius <= 0) return mask;

  const bodyInv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  const cell = radius;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

  for (const ex of excluded) {
    const ep = ex.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!ep) continue;
    const toBody = new THREE.Matrix4().multiplyMatrices(bodyInv, ex.matrixWorld);
    for (let i = 0; i < ep.count; i++) {
      tmpV.fromBufferAttribute(ep, i).applyMatrix4(toBody);
      const k = key(Math.floor(tmpV.x / cell), Math.floor(tmpV.y / cell), Math.floor(tmpV.z / cell));
      let bucket = grid.get(k);
      if (!bucket) grid.set(k, (bucket = []));
      bucket.push(tmpV.x, tmpV.y, tmpV.z);
    }
  }

  const inner = radius * 0.15;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(key(cx + dx, cy + dy, cz + dz));
          if (!bucket) continue;
          for (let j = 0; j < bucket.length; j += 3) {
            const ddx = bucket[j] - x;
            const ddy = bucket[j + 1] - y;
            const ddz = bucket[j + 2] - z;
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 < best) best = d2;
          }
        }
    if (best < Infinity) {
      mask[i] = THREE.MathUtils.smoothstep(Math.sqrt(best), inner, radius);
    }
  }
  return mask;
}

/** Masks are cached per source geometry so remounts and quality changes are instant. */
const maskCache = new WeakMap<THREE.BufferGeometry, Map<string, Float32Array>>();

function cachedFurMask(body: THREE.Mesh, excluded: THREE.Mesh[], radius: number): Float32Array {
  let byRadius = maskCache.get(body.geometry);
  if (!byRadius) maskCache.set(body.geometry, (byRadius = new Map()));
  const key = `${radius.toFixed(6)}:${excluded.length}`;
  let mask = byRadius.get(key);
  if (!mask) byRadius.set(key, (mask = buildFurMask(body, excluded, radius)));
  return mask;
}

function makeFurMaterial(
  base: THREE.Material,
  uniforms: Record<string, THREE.IUniform>,
  perMesh: boolean,
  coat: boolean,
): THREE.MeshStandardMaterial {
  const src = base as THREE.MeshStandardMaterial;
  // Prefer the untinted color if a visual effect (e.g. dirt) already changed it.
  const baseColor = (src.userData?.baseColor as THREE.Color | undefined) ?? src.color;
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor ? baseColor.clone() : new THREE.Color('#888888'),
    map: src.map ?? null,
    roughness: 0.95,
    metalness: 0,
    side: THREE.FrontSide,
  });
  mat.name = `${base.name || 'body'} (fur)`;
  mat.alphaToCoverage = true;
  // Skinned shells are separate meshes with their own shell index uniform.
  const defines: Record<string, string> = {};
  if (perMesh) defines.FUR_PER_MESH = '';
  if (coat) defines.FUR_COAT = '';
  // three.js honors `defines` on every material; the typings only declare it on ShaderMaterial.
  (mat as THREE.Material & { defines?: Record<string, string> }).defines = defines;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float furMask;
attribute float furLen;
attribute vec3 furFlow;
uniform float uComb;
varying vec3 vFurTangent;
uniform float uFurLength;
uniform float uShells;
uniform float uTime;
uniform float uGravity;
uniform float uShellIndex;
varying vec3 vFurBase;
varying float vFurH;
varying float vFurMask;
#ifdef FUR_COAT
${COAT_VARYINGS}
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#ifdef FUR_PER_MESH
float furH = (uShellIndex + 1.0) / uShells;
#else
float furH = (float(gl_InstanceID) + 1.0) / uShells;
#endif
float furL = uFurLength * furMask * furLen;
vec3 furN = normalize(normal);
// Strands lean along the coat's direction (combed), more towards the tips.
vec3 furT = furFlow - furN * dot(furFlow, furN);
furT = dot(furT, furT) > 1e-8 ? normalize(furT) : vec3(0.0);
vec3 transformed = vec3(position);
// Rest-pose normal: skinning is applied to the displaced position afterwards.
transformed += furN * furL * furH + furT * furL * uComb * pow(furH, 1.5);
// Tips droop and sway a little.
transformed.y -= uGravity * furL * furH * furH;
transformed.xz += vec2(sin(uTime * 1.7 + position.y * 60.0), cos(uTime * 1.3 + position.x * 60.0))
  * furL * 0.1 * furH * furH;
vFurTangent = normalize(normalMatrix * normalize(furN * 0.35 + furT * max(uComb, 0.05)));
vFurBase = position;
vFurH = furH;
vFurMask = furMask;
#ifdef FUR_COAT
${COAT_VERTEX}
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uDensity;
uniform float uRootShade;
uniform float uStrandVariation;
uniform float uClump;
uniform float uRim;
uniform float uSheen;
uniform vec3 uLightDir;
varying vec3 vFurTangent;
varying vec3 vFurBase;
varying float vFurH;
varying float vFurMask;
#ifdef FUR_COAT
${COAT_VARYINGS}
${COAT_FRAGMENT_HEAD}
#endif

float furHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Returns strand coverage (0..1) for one jittered lattice; rnd receives the strand id hash.
float furStrand(vec3 p, out float rnd) {
  vec3 cell = floor(p);
  vec3 f = fract(p) - 0.5;
  rnd = furHash(cell);
  vec3 jitter = vec3(furHash(cell + 11.3), furHash(cell + 27.1), furHash(cell + 43.7)) - 0.5;
  float strandLen = 0.55 + 0.45 * rnd;
  if (vFurH > strandLen) return 0.0;
  // Thick at the root, a fine point at the tip.
  float taper = 1.0 - vFurH / strandLen;
  float radius = 0.46 * taper * taper + 0.07 * taper + 0.04;
  float d = length(f - jitter * 0.5);
  return 1.0 - smoothstep(radius * 0.6, radius, d);
}

// Pulls strand tips towards the centre of small tufts (clumps).
vec3 furClump(vec3 p) {
  vec3 cp = p * 0.2;
  vec3 cell = floor(cp);
  vec3 centre = vec3(furHash(cell + 3.1), furHash(cell + 7.7), furHash(cell + 5.3)) * 0.6 + 0.2;
  vec3 offset = (fract(cp) - centre) / 0.2;
  return p + offset * uClump * vFurH * vFurH;
}`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
#ifdef FUR_COAT
diffuseColor.rgb = coatColor(diffuseColor.rgb, vCoatPos, normalize(vCoatNormal));
#endif
{
  vec3 p = furClump(vFurBase * uDensity);
  float r1; float r2;
  float c1 = furStrand(p, r1);
  float c2 = furStrand(p + vec3(0.5, 0.31, 0.77), r2);
  float cov = max(c1, c2) * step(0.04, vFurMask);
  // Faint coverage at the very tips only adds speckles on the silhouette.
  if (cov < 0.12) discard;
  diffuseColor.a = cov;
  float rnd = c1 >= c2 ? r1 : r2;
  // Darker deep in the coat (self-shadowing), slightly lighter tips.
  float shade = mix(uRootShade, 1.0, smoothstep(0.0, 0.85, vFurH)) + 0.05 * smoothstep(0.75, 1.0, vFurH);
  diffuseColor.rgb *= shade * (1.0 - uStrandVariation * 0.5 + uStrandVariation * rnd);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 furV = normalize(vViewPosition);
  // Light scattering through the hair on the silhouette.
  float furRim = pow(1.0 - saturate(dot(normal, furV)), 2.5);
  totalEmissiveRadiance += diffuseColor.rgb * furRim * uRim * (0.25 + 0.75 * vFurH);
  // Kajiya-Kay style highlight across the strands.
  vec3 furL = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
  vec3 furHv = normalize(furL + furV);
  float furTH = dot(normalize(vFurTangent), furHv);
  float furSpec = pow(sqrt(max(0.0, 1.0 - furTH * furTH)), 48.0) * smoothstep(-0.1, 0.4, dot(normal, furL));
  totalEmissiveRadiance += vec3(1.0, 0.96, 0.9) * furSpec * uSheen * vFurH * (0.6 + 0.4 * diffuseColor.r);
}`,
      );
  };
  // Distinct cache key so three does not reuse the plain standard program.
  mat.customProgramCacheKey = () => 'fur-shells-v3';
  return mat;
}

/**
 * Creates fur shells for `body`.
 * `space` is the model's root object and `modelHeight` the model height in
 * `space`'s local units; fur length and density are sized relative to it.
 * World matrices are refreshed here, so the model may already be in a scene.
 */
export function createFurShells(
  body: THREE.Mesh,
  excluded: THREE.Mesh[],
  space: THREE.Object3D,
  modelHeight: number,
  opts: FurOptions,
  coat?: CoatUniforms,
  layout?: FurLayout,
): FurHandle | null {
  if (opts.shells <= 0) return null;
  const normal = body.geometry.getAttribute('normal');
  if (!normal) return null;

  space.updateWorldMatrix(true, true);
  // Convert model-relative sizes to the body mesh's local units.
  const rel = new THREE.Matrix4().copy(space.matrixWorld).invert().multiply(body.matrixWorld);
  const bodyScale = new THREE.Vector3().setFromMatrixScale(rel).x || 1;
  const localHeight = modelHeight / bodyScale;
  const furLength = opts.lengthRatio * localHeight;
  const density = opts.densityPerHeight / localHeight;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', body.geometry.getAttribute('position'));
  geometry.setAttribute('normal', normal);
  const uv = body.geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv', uv);
  if (body.geometry.index) geometry.setIndex(body.geometry.index);
  geometry.setAttribute('furMask', new THREE.BufferAttribute(cachedFurMask(body, excluded, furLength * 1.1), 1));
  if (layout && opts.profile) {
    const attrs = furLayoutAttributes(body.geometry, layout, opts.profile);
    geometry.setAttribute('furLen', new THREE.BufferAttribute(attrs.length, 1));
    geometry.setAttribute('furFlow', new THREE.BufferAttribute(attrs.flow, 3));
  } else {
    const count = body.geometry.getAttribute('position').count;
    geometry.setAttribute('furLen', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    geometry.setAttribute('furFlow', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  }

  const uniforms: Record<string, THREE.IUniform> = {
    uFurLength: { value: furLength },
    uShells: { value: opts.shells },
    uTime: { value: 0 },
    uGravity: { value: opts.gravity },
    uDensity: { value: density },
    uRootShade: { value: opts.rootShade },
    uStrandVariation: { value: opts.strandVariation },
    uComb: { value: layout ? (opts.comb ?? 0) : 0 },
    uClump: { value: opts.clump ?? 0 },
    uRim: { value: opts.rim ?? 0 },
    uSheen: { value: opts.sheen ?? 0 },
    uLightDir: { value: SHEEN_LIGHT_DIR.clone() },
    ...coat,
  };

  const baseMaterial = Array.isArray(body.material) ? body.material[0] : body.material;
  const skinned = (body as THREE.SkinnedMesh).isSkinnedMesh ? (body as THREE.SkinnedMesh) : null;
  const materials: THREE.Material[] = [];
  let object: THREE.Object3D;
  if (skinned) {
    const skinIndex = body.geometry.getAttribute('skinIndex');
    const skinWeight = body.geometry.getAttribute('skinWeight');
    if (!skinIndex || !skinWeight) return null;
    geometry.setAttribute('skinIndex', skinIndex);
    geometry.setAttribute('skinWeight', skinWeight);
    const group = new THREE.Group();
    for (let i = 0; i < opts.shells; i++) {
      const material = makeFurMaterial(baseMaterial, { ...uniforms, uShellIndex: { value: i } }, true, !!coat);
      materials.push(material);
      const shell = new THREE.SkinnedMesh(geometry, material);
      shell.bind(skinned.skeleton, skinned.bindMatrix);
      setupShell(shell);
      // Draw inner shells first so the outer tips blend over them.
      shell.renderOrder = i;
      group.add(shell);
    }
    object = group;
  } else {
    const material = makeFurMaterial(baseMaterial, { ...uniforms, uShellIndex: { value: 0 } }, false, !!coat);
    materials.push(material);
    const shells = new THREE.InstancedMesh(geometry, material, opts.shells);
    const identity = new THREE.Matrix4();
    for (let i = 0; i < opts.shells; i++) shells.setMatrixAt(i, identity);
    shells.instanceMatrix.needsUpdate = true;
    setupShell(shells);
    object = shells;
  }
  object.name = 'fur-shells';

  return {
    object,
    update(time, lengthScale, densityScale = 1) {
      uniforms.uTime.value = time;
      uniforms.uFurLength.value = furLength * lengthScale;
      uniforms.uDensity.value = density * densityScale;
    },
    dispose() {
      object.removeFromParent();
      // Position/normal/uv are shared with the body; three re-uploads them on demand.
      geometry.dispose();
      for (const m of materials) m.dispose();
      if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
    },
  };
}

function setupShell(shell: THREE.Mesh): void {
  shell.castShadow = false;
  shell.receiveShadow = true;
  shell.frustumCulled = false;
  // Fur must never intercept clicks (and raycasting N shells is expensive).
  shell.raycast = () => {};
  shell.layers.set(FUR_LAYER);
  // Alpha-to-coverage needs the strand alpha in the shader, but writing it to
  // the framebuffer would make the canvas see-through there (the page would
  // shine through and the coat would look frosted). Keep the stored alpha.
  shell.onBeforeRender = (renderer) => renderer.getContext().colorMask(true, true, true, false);
  shell.onAfterRender = (renderer) => renderer.getContext().colorMask(true, true, true, true);
}

/** Picks the body mesh: by name when given, otherwise the mesh with the most vertices. */
export function findBodyMesh(root: THREE.Object3D, preferredName?: string): THREE.Mesh | null {
  let named: THREE.Mesh | null = null;
  let largest: THREE.Mesh | null = null;
  let largestCount = -1;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (preferredName && m.name === preferredName) named = m;
    const count = m.geometry.getAttribute('position')?.count ?? 0;
    if (count > largestCount) {
      largestCount = count;
      largest = m;
    }
  });
  return named ?? largest;
}
