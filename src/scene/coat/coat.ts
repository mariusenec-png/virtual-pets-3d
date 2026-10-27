import * as THREE from 'three';
import type { CoatStyle } from './coatTypes';

/**
 * Procedural coat markings (tabby stripes, darker back, lighter belly)
 * painted in the shader from the model's rest-pose position. The same
 * function colors the skin and the fur shells, so markings line up and
 * follow the skeleton when the pet moves. No textures needed.
 */

export type { CoatStyle };

export interface CoatUniforms {
  [name: string]: THREE.IUniform;
  uCoatMatrix: THREE.IUniform<THREE.Matrix4>;
  uCoatStripe: THREE.IUniform<THREE.Color>;
  uCoatBelly: THREE.IUniform<THREE.Color>;
  /** x stripe strength, y stripe frequency, z back shade, w belly strength */
  uCoatParams: THREE.IUniform<THREE.Vector4>;
  /** x sock strength, y leg top, z tail start z, w neck z */
  uCoatParams2: THREE.IUniform<THREE.Vector4>;
}

export function createCoatUniforms(
  style: CoatStyle,
  toModel: THREE.Matrix4,
  regions: { legTop: number; tailStartZ: number; neckZ: number },
): CoatUniforms {
  return {
    uCoatMatrix: { value: toModel.clone() },
    uCoatStripe: { value: new THREE.Color(style.stripeColor) },
    uCoatBelly: { value: new THREE.Color(style.bellyColor) },
    uCoatParams: {
      value: new THREE.Vector4(style.stripeStrength, style.stripeFrequency, style.backShade, style.bellyStrength),
    },
    uCoatParams2: { value: new THREE.Vector4(style.sockStrength, regions.legTop, regions.tailStartZ, regions.neckZ) },
  };
}

/** GLSL declarations shared by vertex and fragment shaders. */
export const COAT_VARYINGS = /* glsl */ `
uniform mat4 uCoatMatrix;
varying vec3 vCoatPos;
varying vec3 vCoatNormal;
`;

/** Vertex code: rest-pose position/normal in normalized model space (1 = model height). */
export const COAT_VERTEX = /* glsl */ `
vCoatPos = (uCoatMatrix * vec4(position, 1.0)).xyz;
vCoatNormal = normalize(mat3(uCoatMatrix) * normal);
`;

export const COAT_FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uCoatStripe;
uniform vec3 uCoatBelly;
uniform vec4 uCoatParams;
uniform vec4 uCoatParams2;

float coatHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float coatNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(coatHash(i), coatHash(i + vec3(1, 0, 0)), f.x), mix(coatHash(i + vec3(0, 1, 0)), coatHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(coatHash(i + vec3(0, 0, 1)), coatHash(i + vec3(1, 0, 1)), f.x), mix(coatHash(i + vec3(0, 1, 1)), coatHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

vec3 coatColor(vec3 base, vec3 p, vec3 n) {
  float legTop = uCoatParams2.y;
  float tailZ = uCoatParams2.z;
  float neckZ = uCoatParams2.w;
  float isLeg = 1.0 - smoothstep(legTop - 0.04, legTop + 0.03, p.y);
  float isTail = (1.0 - smoothstep(tailZ - 0.02, tailZ + 0.03, p.z)) * (1.0 - isLeg);
  float isHead = smoothstep(neckZ - 0.02, neckZ + 0.06, p.z) * (1.0 - isLeg);

  // Stripes run around the body, the legs and the tail.
  float along = mix(p.z, p.y * 1.3, max(isLeg, isTail * 0.8));
  float warp = coatNoise(p * 9.0) * 2.2 + coatNoise(p * 23.0) * 0.6;
  float s = sin(along * uCoatParams.y * 6.2831 + warp + abs(p.x) * 6.0);
  float stripe = smoothstep(0.25, 0.75, s);
  // Fewer, finer stripes on the head (classic "M" area on the forehead).
  stripe *= mix(1.0, 0.55, isHead) * (1.0 - 0.6 * isLeg * smoothstep(legTop * 0.5, 0.0, p.y));

  float back = smoothstep(0.1, 0.9, n.y) * (1.0 - isLeg);
  float belly = smoothstep(-0.05, -0.6, n.y) * (1.0 - isTail);
  // Chest and muzzle face forward and down.
  belly = max(belly, smoothstep(0.35, 0.85, n.z) * smoothstep(legTop + 0.25, legTop + 0.05, p.y) * (1.0 - isLeg));
  belly = max(belly, isHead * smoothstep(0.2, 0.8, n.z) * smoothstep(0.62, 0.55, p.y));
  float sock = isLeg * smoothstep(legTop * 0.45, legTop * 0.2, p.y) * uCoatParams2.x;

  vec3 c = base;
  c = mix(c, c * uCoatStripe * 2.0, clamp(stripe * uCoatParams.x + back * uCoatParams.z, 0.0, 1.0));
  c = mix(c, uCoatBelly, clamp(max(belly * uCoatParams.w, sock), 0.0, 1.0));
  return c;
}
`;

/**
 * Adds the coat pattern to a standard material (the skin under the fur).
 * The material must be unique to this pet (PetModel clones materials).
 */
export function applyCoatToMaterial(material: THREE.Material, uniforms: CoatUniforms): void {
  const mat = material as THREE.MeshStandardMaterial;
  if (!mat.isMeshStandardMaterial) return;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COAT_VARYINGS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${COAT_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COAT_VARYINGS}\n${COAT_FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb = coatColor(diffuseColor.rgb, vCoatPos, normalize(vCoatNormal));`);
  };
  mat.customProgramCacheKey = () => 'coat-v1';
  mat.needsUpdate = true;
}
