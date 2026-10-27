import * as THREE from 'three';
import type { MouthConfig } from './mouthTypes';

/**
 * An opening mouth for the static models: a dark cavity that grows under
 * the nose, a tongue that can stick out (lapping, licking, panting) and two
 * little fangs. Placed on the face surface and attached to the head bone, so
 * it follows the head. Purely cosmetic.
 */

export type { MouthConfig };

export interface MouthHandle {
  update(open: number, tongue: number): void;
  dispose(): void;
}

/**
 * `wrapper` is the model wrapper (local space = model units, height
 * `height`); `head` the bone the mouth follows; `body` is used to sit the
 * mouth on the face surface.
 */
export function buildMouth(
  wrapper: THREE.Object3D,
  head: THREE.Object3D,
  body: THREE.Mesh | null,
  height: number,
  cfg: MouthConfig,
): MouthHandle {
  const H = height;
  const center = new THREE.Vector3(cfg.center[0] * H, cfg.center[1] * H, cfg.center[2] * H);
  // Sit on the skin: nearest body vertex in front of the configured point.
  if (body) {
    wrapper.updateMatrixWorld(true);
    const toWrapper = new THREE.Matrix4().copy(wrapper.matrixWorld).invert().multiply(body.matrixWorld);
    const toBody = new THREE.Matrix4().copy(toWrapper).invert();
    const local = center.clone().applyMatrix4(toBody);
    const pos = body.geometry.getAttribute('position');
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
    if (best >= 0) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, best).applyMatrix4(toWrapper);
      if (p.distanceTo(center) < cfg.width * H * 1.5) center.z = Math.max(center.z, p.z);
    }
  }

  const w = cfg.width * H;
  const h = cfg.height * H;
  const group = new THREE.Group();
  group.name = 'mouth';
  group.position.copy(center);
  wrapper.add(group);
  wrapper.updateMatrixWorld(true);
  head.attach(group);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    geos.push(geo);
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    m.raycast = () => {};
    m.userData.noFurMask = true;
    return m;
  };
  const cavity = mesh(new THREE.SphereGeometry(1, 24, 14), new THREE.MeshStandardMaterial({ color: '#4a1c22', roughness: 0.6 }));
  const tongue = mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: '#e7808f', roughness: 0.45 }));
  const fangGeo = new THREE.ConeGeometry(w * 0.07, w * 0.2, 8);
  const fangMat = new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.3 });
  // Both fangs share one geometry and material (disposed separately below).
  const fangs = [-1, 1].map((s) => {
    const f = new THREE.Mesh(fangGeo, fangMat);
    f.castShadow = false;
    f.raycast = () => {};
    f.userData.noFurMask = true;
    f.rotation.x = Math.PI; // pointing down
    f.userData.side = s;
    return f;
  });
  const content = new THREE.Group();
  content.add(cavity, tongue, ...fangs);
  group.add(content);
  content.visible = false;

  return {
    update(open, tongueOut) {
      const o = Math.min(1, Math.max(0, open));
      const out = Math.min(1, Math.max(0, tongueOut));
      content.visible = o > 0.02 || out > 0.02;
      if (!content.visible) return;
      const oh = Math.max(0.05, o) * h * 0.5;
      cavity.scale.set(w * 0.5, oh, w * 0.32);
      // Tongue rests on the floor of the mouth and slides out, down and forward.
      const len = cfg.tongueLength * H * out;
      // Long axis = local z; tipping it down makes the tongue hang out of the mouth.
      tongue.scale.set(w * 0.3, w * 0.11, w * 0.26 + len * 0.55);
      tongue.rotation.x = 0.25 + 0.95 * out;
      const reach = w * 0.1 + len * 0.5;
      tongue.position.set(0, -oh * 0.5 - Math.sin(tongue.rotation.x) * reach * 0.8, w * 0.1 + Math.cos(tongue.rotation.x) * reach);
      for (const f of fangs) {
        f.position.set(f.userData.side * w * 0.26, oh * 0.75, w * 0.16);
        f.scale.setScalar(Math.min(1, o * 2));
      }
    },
    dispose() {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      fangGeo.dispose();
      fangMat.dispose();
    },
  };
}
