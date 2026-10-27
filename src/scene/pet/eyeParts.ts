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
  brow: Brow | null;
}

/** Options for the extra eye details (eyelids, lashes, brows). */
export interface EyeOptions {
  /** Coat color around the eyes; enables eyelids, lashes and brows. */
  lidColor?: THREE.Color;
  /** Body mesh, so brows can sit on the head surface. */
  body?: THREE.Mesh | null;
  /** How far above the skin the brows float (fur thickness), model units. */
  surfaceOffset?: number;
  /** Cats: a few long whiskers above each eye. */
  browWhiskers?: boolean;
}

/** Brow expression: raised (+) / lowered (-), worried (+) / cross (-), one brow up. */
export interface BrowExpression {
  raise: number;
  worry: number;
  quirk: number;
}

interface Brow {
  group: THREE.Object3D;
  basePosition: THREE.Vector3;
  baseQuaternion: THREE.Quaternion;
  /** +1 when the brow's local +X points towards the nose. */
  innerSign: number;
  /** Vertical size of the eye, scales the brow movement. */
  lift: number;
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
export function collectEyeParts(root: THREE.Object3D, pattern: string, options: EyeOptions = {}): EyeGroup[] {
  const lidColor = options.lidColor;
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
    const frame = lidColor ? eyeFrame(pivot, a.members) : null;
    const lids = frame && lidColor ? buildLids(pivot, frame, lidColor) : null;
    const brow = frame && lidColor ? buildBrow(pivot, frame, lidColor, options) : null;
    return { pivot, lids, brow };
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

interface EyeFrame {
  center: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
  gaze: THREE.Vector3;
  /** Half sizes of the ellipsoid around the eye along side / up / gaze. */
  radii: THREE.Vector3;
}

/** Fits an ellipsoid around the eye parts, oriented along the eye's gaze (pivot space). */
function eyeFrame(pivot: THREE.Group, members: THREE.Mesh[]): EyeFrame | null {
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
  return { center: ballCenter, side, up, gaze, radii };
}

function buildLids(pivot: THREE.Group, f: EyeFrame, color: THREE.Color): Lids {
  const { center: ballCenter, side, up, gaze, radii } = f;
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
  // Eyelashes on the upper lid: they follow it when blinking.
  const lashes = new THREE.Mesh(lashGeometry(), lashMaterial(color.clone().multiplyScalar(0.1)));
  lashes.name = 'eyelashes';
  lashes.castShadow = false;
  lashes.raycast = () => {};
  lashes.userData.noFurMask = true;
  upper.lid.add(lashes);
  return { upper: upper.lid, lower: lower.lid, upperEdge: upper.edge, lowerEdge: lower.edge };
}

let lashTexture: THREE.CanvasTexture | null = null;

/** Alpha texture with tapered, slightly curved lash strands (roots at the bottom). */
function lashMap(): THREE.CanvasTexture | null {
  if (lashTexture) return lashTexture;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  const count = 26;
  for (let i = 0; i < count; i++) {
    const x = 8 + (i / (count - 1)) * 240;
    const len = 0.7 + 0.3 * Math.abs(Math.sin(i * 1.7));
    // Lashes fan out from the middle of the lid.
    const lean = ((x - 128) / 128) * 14;
    for (let k = 0; k < 6; k++) {
      ctx.lineWidth = 4.2 - k * 0.62;
      ctx.beginPath();
      const y0 = 64 - (k / 6) * 60 * len;
      const y1 = 64 - ((k + 1) / 6) * 60 * len;
      ctx.moveTo(x + lean * (k / 6) ** 2, y0);
      ctx.lineTo(x + lean * ((k + 1) / 6) ** 2, y1);
      ctx.stroke();
    }
  }
  lashTexture = new THREE.CanvasTexture(c);
  lashTexture.colorSpace = THREE.SRGBColorSpace;
  return lashTexture;
}

function lashMaterial(color: THREE.Color): THREE.Material {
  const map = lashMap();
  return new THREE.MeshStandardMaterial({
    color,
    map,
    alphaMap: map,
    alphaTest: 0.35,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 0.6,
  });
}

/**
 * A curved band along the front half of the upper lid edge (lid space: the
 * edge is the unit circle in the XZ plane, the lid dome points to +Y).
 * Lashes grow outwards and curl up.
 */
function lashGeometry(): THREE.BufferGeometry {
  const seg = 18;
  const u0 = 0.12 * Math.PI;
  const u1 = 0.88 * Math.PI;
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const u = u0 + (u1 - u0) * t;
    const x = Math.cos(u);
    const z = Math.sin(u);
    // Longer in the middle of the lid.
    const reach = 0.3 + 0.2 * Math.sin(Math.PI * t);
    pos.push(x * 1.02, 0, z * 1.02, x * (1 + reach), reach * 0.75, z * (1 + reach));
    uv.push(t, 0, t, 1);
    if (i < seg) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Nearest body vertex (pivot space) and its normal, for sitting brows on the head. */
function surfacePoint(
  body: THREE.Mesh,
  toPivot: THREE.Matrix4,
  normalMatrix: THREE.Matrix3,
  target: THREE.Vector3,
): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
  const pos = body.geometry.getAttribute('position');
  const nor = body.geometry.getAttribute('normal');
  if (!pos || !nor) return null;
  // Search in body space (no per-vertex matrix multiply).
  const local = target.clone().applyMatrix4(new THREE.Matrix4().copy(toPivot).invert());
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - local.x;
    const dy = pos.getY(i) - local.y;
    const dz = pos.getZ(i) - local.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  return {
    point: new THREE.Vector3().fromBufferAttribute(pos, best).applyMatrix4(toPivot),
    normal: new THREE.Vector3().fromBufferAttribute(nor, best).applyMatrix3(normalMatrix).normalize(),
  };
}

/** A soft arc above the eye (plus whiskers for cats), sitting on the head. */
function buildBrow(pivot: THREE.Group, f: EyeFrame, coat: THREE.Color, options: EyeOptions): Brow | null {
  const { center, side, up, gaze, radii } = f;
  // Which way is the nose? Pivot axes are the model's axes; the head's midline is x = 0.
  const towardNose = new THREE.Vector3(pivot.position.x > 0 ? -1 : 1, 0, 0);
  const innerSign = side.dot(towardNose) >= 0 ? 1 : -1;

  const toPivot = options.body ? new THREE.Matrix4().copy(pivot.matrixWorld).invert().multiply(options.body.matrixWorld) : null;
  const normalMatrix = toPivot ? new THREE.Matrix3().getNormalMatrix(toPivot) : null;
  const offset = options.surfaceOffset ?? radii.y * 0.3;

  // Arc above the eye: higher in the middle, the inner end a little lower.
  const points: THREE.Vector3[] = [];
  for (let k = 0; k <= 6; k++) {
    const t = -1 + (2 * k) / 6;
    const p = center
      .clone()
      .addScaledVector(side, t * radii.x * 1.05)
      .addScaledVector(up, radii.y * (1.55 - 0.22 * t * t - 0.08 * t * innerSign))
      .addScaledVector(gaze, radii.z * 0.1);
    if (options.body && toPivot && normalMatrix) {
      const s = surfacePoint(options.body, toPivot, normalMatrix, p);
      if (s && s.point.distanceTo(p) < radii.y * 1.5) p.copy(s.point).addScaledVector(s.normal, offset);
    }
    points.push(p);
  }
  const mid = points[3].clone();
  const group = new THREE.Group();
  group.name = 'brow';
  group.position.copy(mid);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, gaze));
  pivot.add(group);
  group.updateMatrixWorld(true);
  const toBrow = new THREE.Matrix4().copy(group.matrix).invert();
  const local = points.map((p) => p.clone().applyMatrix4(toBrow));

  const curve = new THREE.CatmullRomCurve3(local);
  const thickness = radii.y * 0.11;
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 24, thickness, 6, false),
    new THREE.MeshStandardMaterial({ color: coat.clone().multiplyScalar(0.42), roughness: 0.9 }),
  );
  tube.name = 'eyebrow';
  group.add(tube);

  if (options.browWhiskers) {
    const whiskerMat = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.5 });
    const outer = -innerSign;
    [0.25, 0.5, 0.75].forEach((t, i) => {
      const start = curve.getPoint(0.5 + outer * t * 0.5);
      const len = radii.y * (2.0 + 0.4 * i);
      const dir = new THREE.Vector3(outer * (0.35 + 0.2 * i), 1, 0.25).normalize();
      const bend = new THREE.Vector3(outer * 0.4, 0, 0.2);
      const pts = [0, 0.5, 1].map((s) =>
        start.clone().addScaledVector(dir, len * s).addScaledVector(bend, len * s * s * 0.3),
      );
      const whisker = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, radii.y * 0.022, 4, false),
        whiskerMat,
      );
      whisker.name = 'brow-whisker';
      group.add(whisker);
    });
  }
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.raycast = () => {};
    // Brows sit on top of the fur: the fur must not be cleared around them.
    m.userData.noFurMask = true;
  });
  return {
    group,
    basePosition: group.position.clone(),
    baseQuaternion: group.quaternion.clone(),
    innerSign,
    lift: radii.y,
  };
}

const tmpQuat = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);

/**
 * Scales eyes around their centers (1 = original size) and sets how open
 * they are (1 = open, 0 = closed). Eyes without lids fall back to squashing.
 * `brows` moves the eyebrows (expressions).
 */
export function applyEyeScale(eyes: EyeGroup[], scale: number, open = 1, brows?: BrowExpression): void {
  const closed = 1 - Math.min(1, Math.max(0, open));
  eyes.forEach((e, index) => {
    if (e.brow) {
      const b = e.brow;
      const raise = (brows?.raise ?? 0) + (index === 0 ? (brows?.quirk ?? 0) * 0.8 : 0);
      // Brows also follow the lids a little when the eyes close.
      const droop = closed * 0.25;
      b.group.position.copy(b.basePosition);
      b.group.quaternion.copy(b.baseQuaternion);
      b.group.translateY((raise * 0.35 - droop) * b.lift);
      // Worried: inner ends up; cross: inner ends down.
      const tilt = b.innerSign * (brows?.worry ?? 0) * 0.32 - (index === 0 ? (brows?.quirk ?? 0) * 0.15 * b.innerSign : 0);
      b.group.quaternion.multiply(tmpQuat.setFromAxisAngle(zAxis, tilt));
    }

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
  });
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
