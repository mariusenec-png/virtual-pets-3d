import * as THREE from 'three';
import type { RigConfig, Vec3 } from './rigTypes';

/**
 * Automatic quadruped rig for static models.
 *
 * The supplied pet models have no skeleton. From a handful of landmark
 * points (species config) this builds a bone hierarchy, computes skin
 * weights for every vertex of the body mesh (distance to bone segments,
 * softly gated by body region so a leg never drags the other leg), turns
 * the body into a SkinnedMesh and rigidly attaches the remaining parts
 * (eyes, nose, whiskers, paws) to their nearest bone.
 */

interface JointDef {
  name: string;
  parent: string | null;
  head: Vec3;
  end: Vec3;
  kind: 'body' | 'neck' | 'head' | 'frontUpper' | 'frontLower' | 'hindUpper' | 'hindLower' | 'tail';
  side?: 'L' | 'R';
}

export interface PetRig {
  skeleton: THREE.Skeleton;
  bones: Map<string, THREE.Bone>;
  /** Rest pose of each bone (local). */
  rest: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>;
  body: THREE.SkinnedMesh;
  /** Model height in the wrapper's local units (bone offsets scale with it). */
  height: number;
  tailBones: string[];
  /** Invisible click targets that follow the bones (the skinned body does not raycast). */
  proxies: THREE.Mesh[];
}

/** Puts every bone back in its rest pose (e.g. before measuring the mesh). */
export function resetRigPose(rig: PetRig): void {
  for (const [name, bone] of rig.bones) {
    const r = rig.rest.get(name)!;
    bone.position.copy(r.position);
    bone.quaternion.copy(r.quaternion);
    bone.scale.set(1, 1, 1);
  }
}

const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

/** Invisible ellipsoid attached to a bone; `center` and `radii` are normalized. */
function makeProxy(bone: THREE.Bone, boneHead: Vec3, center: Vec3, radii: Vec3, height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), proxyMaterial);
  mesh.name = 'click-proxy';
  mesh.userData.proxy = true;
  mesh.position.set((center[0] - boneHead[0]) * height, (center[1] - boneHead[1]) * height, (center[2] - boneHead[2]) * height);
  mesh.scale.set(radii[0] * height, radii[1] * height, radii[2] * height);
  bone.add(mesh);
  return mesh;
}

const mirror = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];

export function rigJoints(cfg: RigConfig): JointDef[] {
  const L = cfg.landmarks;
  const joints: JointDef[] = [
    { name: 'pelvis', parent: null, head: L.pelvis, end: L.spine, kind: 'body' },
    { name: 'spine', parent: 'pelvis', head: L.spine, end: L.chest, kind: 'body' },
    { name: 'chest', parent: 'spine', head: L.chest, end: L.neck, kind: 'body' },
    { name: 'neck', parent: 'chest', head: L.neck, end: L.head, kind: 'neck' },
    { name: 'head', parent: 'neck', head: L.head, end: L.headEnd, kind: 'head' },
  ];
  for (const side of ['L', 'R'] as const) {
    const m = side === 'L' ? (v: Vec3) => v : mirror;
    joints.push(
      { name: `shoulder${side}`, parent: 'chest', head: m(L.shoulder), end: m(L.elbow), kind: 'frontUpper', side },
      { name: `elbow${side}`, parent: `shoulder${side}`, head: m(L.elbow), end: m(L.wrist), kind: 'frontLower', side },
      { name: `wrist${side}`, parent: `elbow${side}`, head: m(L.wrist), end: m(L.frontToe), kind: 'frontLower', side },
      { name: `hip${side}`, parent: 'pelvis', head: m(L.hip), end: m(L.knee), kind: 'hindUpper', side },
      { name: `knee${side}`, parent: `hip${side}`, head: m(L.knee), end: m(L.hock), kind: 'hindLower', side },
      { name: `hock${side}`, parent: `knee${side}`, head: m(L.hock), end: m(L.hindToe), kind: 'hindLower', side },
    );
  }
  for (let i = 0; i < L.tail.length - 1; i++) {
    joints.push({ name: `tail${i}`, parent: i === 0 ? 'pelvis' : `tail${i - 1}`, head: L.tail[i], end: L.tail[i + 1], kind: 'tail' });
  }
  return joints;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function segmentDistanceSq(px: number, py: number, pz: number, a: Vec3, b: Vec3): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = px - a[0];
  const apy = py - a[1];
  const apz = pz - a[2];
  const len2 = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby + apz * abz) / len2));
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

/** Soft region gate (0..1) for a joint at a normalized position. */
function gate(j: JointDef, x: number, y: number, z: number, cfg: RigConfig): number {
  const { legTop, tailStartZ, neckZ } = cfg.regions;
  const L = cfg.landmarks;
  const zMid = (L.shoulder[2] + L.hip[2]) / 2;
  const sideGate = j.side === 'L' ? smoothstep(-0.015, 0.015, x) : j.side === 'R' ? 1 - smoothstep(-0.015, 0.015, x) : 1;
  const front = smoothstep(zMid - 0.05, zMid + 0.05, z);
  const tailGate = (1 - smoothstep(tailStartZ - 0.03, tailStartZ + 0.05, z)) * smoothstep(legTop - 0.05, legTop + 0.05, y);
  const headGate = smoothstep(neckZ - 0.06, neckZ + 0.02, z) * smoothstep(legTop, legTop + 0.12, y);
  switch (j.kind) {
    case 'body':
      return 1 - 0.85 * Math.max(tailGate, j.name === 'chest' ? 0 : headGate);
    case 'neck':
      // Everything above the head joint (cranium, ears) follows the head only.
      return headGate * (1 - smoothstep(L.head[1] - 0.01, L.head[1] + 0.07, y));
    case 'head':
      return headGate;
    case 'tail':
      return tailGate;
    case 'frontUpper':
      return sideGate * front * (1 - smoothstep(legTop + 0.04, legTop + 0.2, y)) * (1 - headGate * 0.8);
    case 'frontLower':
      return sideGate * front * (1 - smoothstep(legTop - 0.06, legTop + 0.06, y));
    case 'hindUpper':
      return sideGate * (1 - front) * (1 - smoothstep(legTop + 0.04, legTop + 0.2, y)) * (1 - tailGate * 0.8);
    case 'hindLower':
      return sideGate * (1 - front) * (1 - smoothstep(legTop - 0.06, legTop + 0.06, y));
  }
}

/**
 * Skin weights for normalized vertex positions (x,y,z triplets).
 * Returns 4 bone indices and 4 weights per vertex (indices into `joints`).
 */
export function computeSkinWeights(
  positions: Float32Array,
  joints: JointDef[],
  cfg: RigConfig,
): { indices: Uint16Array; weights: Float32Array } {
  const count = positions.length / 3;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  const w = new Float32Array(joints.length);
  const order = joints.map((_, i) => i);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    for (let j = 0; j < joints.length; j++) {
      const g = gate(joints[j], x, y, z, cfg);
      if (g <= 1e-4) {
        w[j] = 0;
        continue;
      }
      const d2 = segmentDistanceSq(x, y, z, joints[j].head, joints[j].end);
      w[j] = g / ((d2 + 4e-4) * (d2 + 4e-4));
    }
    order.sort((a, b) => w[b] - w[a]);
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += w[order[k]];
    if (sum <= 0) {
      // Fallback: nearest body joint.
      indices[v * 4] = 0;
      weights[v * 4] = 1;
      continue;
    }
    for (let k = 0; k < 4; k++) {
      indices[v * 4 + k] = order[k];
      weights[v * 4 + k] = w[order[k]] / sum;
    }
  }
  return { indices, weights };
}

const weightCache = new WeakMap<THREE.BufferGeometry, string>();

/**
 * Builds the rig inside `wrapper` (whose local space is the model space:
 * centered, feet at y = 0, height `height`). `body` becomes a SkinnedMesh;
 * `others` are attached to their nearest bone.
 */
export function buildRig(
  wrapper: THREE.Object3D,
  height: number,
  body: THREE.Mesh,
  others: THREE.Mesh[],
  cfg: RigConfig,
  cacheKey: string,
): PetRig {
  const joints = rigJoints(cfg);
  const bones = new Map<string, THREE.Bone>();
  for (const j of joints) {
    const bone = new THREE.Bone();
    bone.name = j.name;
    const parent = j.parent ? joints.find((p) => p.name === j.parent)! : null;
    const origin = parent ? parent.head : ([0, 0, 0] as Vec3);
    bone.position.set((j.head[0] - origin[0]) * height, (j.head[1] - origin[1]) * height, (j.head[2] - origin[2]) * height);
    bones.set(j.name, bone);
    if (j.parent) bones.get(j.parent)!.add(bone);
    else wrapper.add(bone);
  }
  wrapper.updateMatrixWorld(true);

  // Skin weights (cached on the shared geometry).
  const geometry = body.geometry;
  if (weightCache.get(geometry) !== cacheKey) {
    const pos = geometry.getAttribute('position');
    const toWrapper = new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(body.matrixWorld);
    const norm = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toWrapper).divideScalar(height);
      norm[i * 3] = v.x;
      norm[i * 3 + 1] = v.y;
      norm[i * 3 + 2] = v.z;
    }
    const { indices, weights } = computeSkinWeights(norm, joints, cfg);
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    weightCache.set(geometry, cacheKey);
  }

  // Replace the body mesh with a skinned version in the same place.
  // (Raycasting a skinned 100k-vertex mesh on every pointer move is too
  // expensive; clicks use the proxies below instead.)
  const skinned = new THREE.SkinnedMesh(geometry, body.material);
  skinned.name = body.name;
  skinned.castShadow = body.castShadow;
  skinned.receiveShadow = body.receiveShadow;
  skinned.position.copy(body.position);
  skinned.quaternion.copy(body.quaternion);
  skinned.scale.copy(body.scale);
  skinned.frustumCulled = false;
  skinned.raycast = () => {};
  const parent = body.parent!;
  parent.add(skinned);
  parent.remove(body);
  wrapper.updateMatrixWorld(true);
  const boneList = joints.map((j) => bones.get(j.name)!);
  const skeleton = new THREE.Skeleton(boneList);
  skinned.bind(skeleton, skinned.matrixWorld);

  // Rigidly attach every other part to the closest bone.
  const toWrapperInv = new THREE.Matrix4().copy(wrapper.matrixWorld).invert();
  const center = new THREE.Vector3();
  for (const mesh of others) {
    mesh.geometry.computeBoundingSphere();
    center.copy(mesh.geometry.boundingSphere!.center).applyMatrix4(mesh.matrixWorld).applyMatrix4(toWrapperInv).divideScalar(height);
    // The bone that would dominate a skinned vertex at the part's center.
    const { indices } = computeSkinWeights(new Float32Array([center.x, center.y, center.z]), joints, cfg);
    const best = joints[indices[0]];
    bones.get(best.name)!.attach(mesh);
  }

  const rest = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  for (const [name, bone] of bones) rest.set(name, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });

  const L = cfg.landmarks;
  const bodyCenter: Vec3 = [0, (L.pelvis[1] + L.chest[1]) / 2 - 0.02, (L.pelvis[2] + L.chest[2]) / 2];
  const headCenter: Vec3 = [0, (L.head[1] + L.headEnd[1]) / 2 + 0.03, (L.head[2] + L.headEnd[2]) / 2];
  const proxies = [
    makeProxy(bones.get('spine')!, L.spine, bodyCenter, [L.shoulder[0] + 0.06, 0.16, (L.chest[2] - L.pelvis[2]) / 2 + 0.12], height),
    makeProxy(bones.get('head')!, L.head, headCenter, [0.13, 0.14, Math.abs(L.headEnd[2] - L.head[2]) / 2 + 0.06], height),
  ];

  return {
    proxies,
    skeleton,
    bones,
    rest,
    body: skinned,
    height,
    tailBones: joints.filter((j) => j.kind === 'tail').map((j) => j.name),
  };
}
