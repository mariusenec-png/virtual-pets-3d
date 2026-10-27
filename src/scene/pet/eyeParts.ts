import * as THREE from 'three';

/**
 * One eye: a pivot group placed at the eyeball center that holds every
 * matching part (eyeball, pupil, glint, socket). Scaling the group resizes
 * the eye around its center (babies have bigger eyes).
 *
 * Each eye also gets eyelids: two half-shells hugging the eye (an ellipsoid
 * fitted to the eye parts). They rotate over the eye to blink, squint or
 * sleep, with a thin dark line along the lid edge.
 */
export interface EyeGroup {
  pivot: THREE.Group;
  lids: Lids | null;
}

interface Lids {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  /** Lash lines: half rings that must stay on the side facing out of the eye. */
  upperEdge: THREE.Object3D;
  lowerEdge: THREE.Object3D;
}

const tmpBox = new THREE.Box3();
const tmpSphere = new THREE.Sphere();

/**
 * Groups eye meshes (matched by name) per eyeball. Must be called once the
 * meshes have their final parents (after rigging, the head bone), since the
 * pivot groups are inserted under that parent. With `lidColor` each eye gets
 * eyelids in that color.
 */
export function collectEyeParts(root: THREE.Object3D, pattern: string, lidColor?: THREE.Color): EyeGroup[] {
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
    const lids = lidColor ? buildLids(pivot, a.members, lidColor) : null;
    return { pivot, lids };
  });
}

/**
 * Rotation (radians, around the lid's horizontal axis) of the upper / lower
 * lid. A lid is a half shell whose edge crosses the front of the eye at an
 * elevation of minus this angle (upper) or this angle minus 180 degrees
 * (lower): open, the edges sit above and below the iris; closed, they meet
 * just below the middle of the eye.
 */
const UPPER_OPEN = -0.8;
const UPPER_CLOSED = 0.25;
const LOWER_OPEN = Math.PI + 0.85;
const LOWER_CLOSED = Math.PI + 0.2;

function buildLids(
  pivot: THREE.Group,
  members: THREE.Mesh[],
  color: THREE.Color,
): Lids | null {
  if (members.length === 0) return null;
  // Eye parts in pivot space: the largest is the eyeball, the rest sit in front (pupil, iris, glint).
  const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const all = new THREE.Box3();
  const ball = new THREE.Box3();
  const front = new THREE.Vector3();
  let frontCount = 0;
  members.forEach((m, i) => {
    m.geometry.computeBoundingBox();
    tmpBox.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPivot, m.matrixWorld));
    all.union(tmpBox);
    if (i === 0) ball.copy(tmpBox);
    else {
      front.add(tmpBox.getCenter(new THREE.Vector3()));
      frontCount++;
    }
  });
  // Where the eye looks: from the eyeball center towards the pupil; fall back to "forward".
  const ballCenter = ball.getCenter(new THREE.Vector3());
  const gaze = frontCount > 0 ? front.divideScalar(frontCount).sub(ballCenter) : new THREE.Vector3(0, 0, 1);
  gaze.y = 0;
  if (gaze.lengthSq() < 1e-12) gaze.set(0, 0, 1);
  gaze.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(up, gaze).normalize();

  // Ellipsoid around all parts: half extents measured from the eyeball center along the lid axes.
  const half = (axis: THREE.Vector3) => {
    let r = 0;
    for (const x of [all.min.x, all.max.x])
      for (const y of [all.min.y, all.max.y])
        for (const z of [all.min.z, all.max.z]) r = Math.max(r, Math.abs((x - ballCenter.x) * axis.x + (y - ballCenter.y) * axis.y + (z - ballCenter.z) * axis.z));
    return r;
  };
  const radii = new THREE.Vector3(half(side), half(up), half(gaze)).multiplyScalar(1.12);
  if (!(radii.x > 0 && radii.y > 0 && radii.z > 0)) return null;

  const frame = new THREE.Group();
  frame.name = 'eyelids';
  frame.position.copy(ballCenter);
  frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, gaze));
  frame.scale.copy(radii);
  pivot.add(frame);

  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const lash = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.25), roughness: 0.7 });
  const shell = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  // Lash line along the front half of the lid edge only.
  const rim = new THREE.TorusGeometry(1, 0.06, 6, 24, Math.PI);
  const makeLid = (name: string, angle: number) => {
    const lid = new THREE.Group();
    lid.name = name;
    lid.rotation.x = angle;
    const cap = new THREE.Mesh(shell, skin);
    const edge = new THREE.Mesh(rim, lash);
    edge.rotation.order = 'YXZ';
    edge.rotation.x = Math.PI / 2;
    for (const m of [cap, edge]) {
      m.castShadow = false;
      m.receiveShadow = true;
      m.raycast = () => {};
      lid.add(m);
    }
    frame.add(lid);
    return { lid, edge };
  };
  const upper = makeLid('upper-lid', UPPER_OPEN);
  const lower = makeLid('lower-lid', LOWER_OPEN);
  return { upper: upper.lid, lower: lower.lid, upperEdge: upper.edge, lowerEdge: lower.edge };
}

/**
 * Scales eyes around their centers (1 = original size) and sets how open
 * they are (1 = open, 0 = closed). Eyes without lids fall back to squashing.
 */
export function applyEyeScale(eyes: EyeGroup[], scale: number, open = 1): void {
  const closed = 1 - Math.min(1, Math.max(0, open));
  for (const e of eyes) {
    if (e.lids) {
      e.pivot.scale.setScalar(scale);
      const up = UPPER_OPEN + (UPPER_CLOSED - UPPER_OPEN) * closed;
      const low = LOWER_OPEN + (LOWER_CLOSED - LOWER_OPEN) * closed;
      e.lids.upper.rotation.x = up;
      e.lids.lower.rotation.x = low;
      // Keep each lash line on the visible (outer) half of the lid edge.
      e.lids.upperEdge.rotation.y = Math.cos(up) < 0 ? Math.PI : 0;
      e.lids.lowerEdge.rotation.y = Math.cos(low) < 0 ? Math.PI : 0;
    } else {
      e.pivot.scale.set(scale, scale * Math.max(0.06, open), scale);
    }
  }
}

/** Average color of a material (base color times its texture, if any). */
export function averageAlbedo(material: THREE.Material): THREE.Color {
  const m = material as THREE.MeshStandardMaterial;
  const c = (m.color ?? new THREE.Color('#888888')).clone();
  const img = m.map?.image as CanvasImageSource | undefined;
  if (!img || typeof document === 'undefined') return c;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return c;
    ctx.drawImage(img, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    const avg = new THREE.Color();
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 4;
    avg.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
    return c.multiply(avg);
  } catch {
    return c;
  }
}
