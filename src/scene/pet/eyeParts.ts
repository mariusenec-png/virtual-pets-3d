import * as THREE from 'three';

export interface EyePart {
  node: THREE.Object3D;
  basePosition: THREE.Vector3;
  baseScale: THREE.Vector3;
  /** Center the part scales around (the eyeball it belongs to). */
  pivot: THREE.Vector3;
}

/**
 * Groups eye meshes (matched by name) around their eyeball so they can be
 * scaled together: bigger eyes make babies look like babies.
 */
export function collectEyeParts(root: THREE.Object3D, pattern: string): EyePart[] {
  const re = new RegExp(pattern, 'i');
  const parts: { node: THREE.Object3D; radius: number }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !re.test(m.name)) return;
    m.geometry.computeBoundingSphere();
    const r = (m.geometry.boundingSphere?.radius ?? 0) * Math.max(m.scale.x, m.scale.y, m.scale.z);
    parts.push({ node: m, radius: r });
  });
  // Largest parts become anchors (eyeballs); smaller parts join the nearest anchor.
  parts.sort((a, b) => b.radius - a.radius);
  const anchors: { center: THREE.Vector3; radius: number }[] = [];
  const result: EyePart[] = [];
  for (const p of parts) {
    const pos = p.node.position.clone();
    let anchor = anchors.find((a) => a.center.distanceTo(pos) < a.radius * 1.6);
    if (!anchor) {
      anchor = { center: pos.clone(), radius: p.radius };
      anchors.push(anchor);
    }
    result.push({ node: p.node, basePosition: pos, baseScale: p.node.scale.clone(), pivot: anchor.center });
  }
  return result;
}

/** Scales eye parts around their eyeball pivots (1 = original size). */
export function applyEyeScale(eyes: EyePart[], scale: number): void {
  for (const e of eyes) {
    e.node.position.copy(e.basePosition).sub(e.pivot).multiplyScalar(scale).add(e.pivot);
    e.node.scale.copy(e.baseScale).multiplyScalar(scale);
  }
}
