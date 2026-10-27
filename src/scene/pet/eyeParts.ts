import * as THREE from 'three';

/**
 * One eye: a pivot group placed at the eyeball center that holds every
 * matching part (eyeball, pupil, glint, socket). Scaling the group resizes
 * the eye around its center (babies have bigger eyes); squashing it
 * vertically closes the eye (blinking, sleeping).
 */
export interface EyeGroup {
  pivot: THREE.Group;
}

const tmpBox = new THREE.Box3();
const tmpSphere = new THREE.Sphere();

/**
 * Groups eye meshes (matched by name) per eyeball. Must be called once the
 * meshes have their final parents (after rigging, the head bone), since the
 * pivot groups are inserted under that parent.
 */
export function collectEyeParts(root: THREE.Object3D, pattern: string): EyeGroup[] {
  const re = new RegExp(pattern, 'i');
  root.updateWorldMatrix(true, true);
  const parts: { node: THREE.Mesh; center: THREE.Vector3; radius: number }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !re.test(m.name) || !m.parent) return;
    m.geometry.computeBoundingBox();
    tmpBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    tmpBox.getBoundingSphere(tmpSphere);
    parts.push({ node: m, center: tmpSphere.center.clone(), radius: tmpSphere.radius });
  });
  // Largest parts become anchors (eyeballs); smaller parts join the nearest anchor.
  parts.sort((a, b) => b.radius - a.radius);
  const anchors: { center: THREE.Vector3; radius: number; parent: THREE.Object3D; members: THREE.Mesh[] }[] = [];
  for (const p of parts) {
    let anchor = anchors.find((a) => a.parent === p.node.parent && a.center.distanceTo(p.center) < a.radius * 1.6);
    if (!anchor) {
      anchor = { center: p.center, radius: p.radius, parent: p.node.parent!, members: [] };
      anchors.push(anchor);
    }
    anchor.members.push(p.node);
  }
  return anchors.map((a) => {
    const pivot = new THREE.Group();
    pivot.name = 'eye-pivot';
    a.parent.add(pivot);
    a.parent.updateWorldMatrix(true, false);
    pivot.position.copy(a.parent.worldToLocal(a.center.clone()));
    pivot.updateMatrixWorld(true);
    for (const m of a.members) pivot.attach(m);
    return { pivot };
  });
}

/**
 * Scales eyes around their centers (1 = original size). `open` squashes
 * them vertically (1 = open, ~0 = closed). The vertical axis is the parent's
 * Y, which is "up" for the model root and for the rig's head bone.
 */
export function applyEyeScale(eyes: EyeGroup[], scale: number, open = 1): void {
  for (const e of eyes) e.pivot.scale.set(scale, scale * open, scale);
}
