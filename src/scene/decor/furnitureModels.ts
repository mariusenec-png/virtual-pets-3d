import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Procedural furniture models (no external assets). Plain three.js builders
 * so they can be rendered and checked outside React. Each model stands on
 * y = 0 with its front facing +Z (towards the room). Sizes are in meters.
 */

export interface FurnitureModel {
  object: THREE.Group;
  /** Per-frame animation (fish swimming...). */
  update?: (time: number) => void;
  dispose(): void;
}

type V3 = [number, number, number];

class Builder {
  readonly group = new THREE.Group();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly owned: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  mat(color: string, roughness = 0.8, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    const key = `${color}|${roughness}|${JSON.stringify(extra, (k, v) => (k === 'map' ? undefined : v))}|${extra.map ? (extra.map as THREE.Texture).uuid : ''}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
      this.materials.set(key, m);
      this.owned.push(m);
    }
    return m;
  }

  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
    scale: V3 = [1, 1, 1],
    parent: THREE.Object3D = this.group,
  ): THREE.Mesh {
    this.owned.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(size: V3, color: string, position: V3, rotation: V3 = [0, 0, 0], roughness = 0.8): THREE.Mesh {
    return this.add(new THREE.BoxGeometry(...size), this.mat(color, roughness), position, rotation);
  }

  rounded(size: V3, radius: number, color: string, position: V3, roughness = 0.9): THREE.Mesh {
    return this.add(new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius), this.mat(color, roughness), position);
  }

  cylinder(rTop: number, rBottom: number, height: number, material: THREE.Material, position: V3, rotation: V3 = [0, 0, 0], segments = 24): THREE.Mesh {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material, position, rotation);
  }

  sphere(radius: number, color: string, position: V3, scale: V3 = [1, 1, 1], roughness = 0.8): THREE.Mesh {
    return this.add(new THREE.SphereGeometry(radius, 20, 14), this.mat(color, roughness), position, [0, 0, 0], scale);
  }

  texture(t: THREE.Texture): THREE.Texture {
    this.owned.push(t);
    return t;
  }

  finish(update?: (time: number) => void): FurnitureModel {
    const owned = this.owned;
    return {
      object: this.group,
      update,
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
}

function stripes(a: string, b: string, count: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(0, (i * 256) / count, 32, 256 / count);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cardboardBox(): FurnitureModel {
  const b = new Builder();
  const w = 0.44;
  const d = 0.34;
  const h = 0.22;
  const th = 0.012;
  const side = '#c99a62';
  const flap = '#d3a873';
  b.box([w, th, d], '#b88a55', [0, th / 2, 0]);
  b.box([w, h, th], side, [0, h / 2, d / 2]);
  b.box([w, h, th], side, [0, h / 2, -d / 2]);
  b.box([th, h, d], side, [-w / 2, h / 2, 0]);
  b.box([th, h, d], side, [w / 2, h / 2, 0]);
  b.box([w, 0.14, th], flap, [0, h + 0.05, d / 2 + 0.05], [0.9, 0, 0]);
  b.box([w, 0.14, th], flap, [0, h + 0.05, -d / 2 - 0.05], [-0.9, 0, 0]);
  b.box([th, 0.12, d], flap, [-w / 2 - 0.045, h + 0.045, 0], [0, 0, 0.8]);
  b.box([0.06, h * 0.8, 0.003], '#e8d9b4', [0, h * 0.55, d / 2 + 0.008], [0, 0, 0], 0.4);
  return b.finish();
}

function floorCushion(): FurnitureModel {
  const b = new Builder();
  b.sphere(1, '#8fb3d9', [0, 0.065, 0], [0.33, 0.065, 0.33], 1);
  b.sphere(0.025, '#5f86b3', [0, 0.125, 0], [1, 0.5, 1]);
  b.add(new THREE.TorusGeometry(0.31, 0.012, 8, 48), b.mat('#6f97c4'), [0, 0.07, 0], [-Math.PI / 2, 0, 0]);
  return b.finish();
}

function scratchingPost(): FurnitureModel {
  const b = new Builder();
  const rope = b.mat('#ffffff', 1, { map: b.texture(stripes('#d9c29a', '#c4a97c', 40)) });
  b.rounded([0.42, 0.05, 0.42], 0.015, '#b8a6d4', [0, 0.025, 0]);
  b.cylinder(0.06, 0.06, 0.7, rope, [0, 0.4, 0]);
  b.cylinder(0.16, 0.16, 0.04, b.mat('#b8a6d4', 1), [0, 0.77, 0], [0, 0, 0], 32);
  b.cylinder(0.003, 0.003, 0.28, b.mat('#555555'), [0.13, 0.62, 0], [0, 0, 0], 6);
  b.sphere(0.035, '#e06b8b', [0.13, 0.47, 0], [1, 1, 1], 1);
  return b.finish();
}

function catTree(): FurnitureModel {
  const b = new Builder();
  const rope = b.mat('#ffffff', 1, { map: b.texture(stripes('#d9c29a', '#c4a97c', 48)) });
  const plush = '#c9b8a6';
  b.rounded([0.6, 0.06, 0.6], 0.02, plush, [0, 0.03, 0], 1);
  b.cylinder(0.065, 0.065, 0.76, rope, [0, 0.42, 0]);
  b.cylinder(0.05, 0.05, 0.38, rope, [0.2, 0.22, -0.12]);
  b.cylinder(0.15, 0.15, 0.04, b.mat(plush, 1), [0.2, 0.43, -0.12], [0, 0, 0], 32);
  b.cylinder(0.25, 0.23, 0.05, b.mat(plush, 1), [0, 0.8, 0], [0, 0, 0], 40);
  b.add(new THREE.TorusGeometry(0.23, 0.035, 12, 40), b.mat('#b3a08d', 1), [0, 0.835, 0], [-Math.PI / 2, 0, 0]);
  b.cylinder(0.003, 0.003, 0.26, b.mat('#555555'), [-0.2, 0.66, 0.12], [0, 0, 0], 6);
  b.sphere(0.035, '#7ec4a4', [-0.2, 0.52, 0.12], [1, 1, 1], 1);
  return b.finish();
}

function kennel(): FurnitureModel {
  const b = new Builder();
  const body = '#e8d3b0';
  const roof = '#b5533c';
  const w = 0.72;
  const h = 0.46;
  const d = 0.72;
  b.box([w, h, 0.04], body, [0, h / 2, -d / 2 + 0.02]);
  b.box([0.04, h, d], body, [-w / 2 + 0.02, h / 2, 0]);
  b.box([0.04, h, d], body, [w / 2 - 0.02, h / 2, 0]);
  b.box([0.22, h, 0.04], body, [-0.25, h / 2, d / 2 - 0.02]);
  b.box([0.22, h, 0.04], body, [0.25, h / 2, d / 2 - 0.02]);
  b.box([0.28, 0.12, 0.04], body, [0, h - 0.06, d / 2 - 0.02]);
  b.box([w - 0.06, 0.03, d - 0.06], '#7a5a40', [0, 0.015, 0]);
  // Gables (triangles) and roof.
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2, 0);
  tri.lineTo(w / 2, 0);
  tri.lineTo(0, 0.26);
  tri.closePath();
  for (const z of [d / 2 - 0.04, -d / 2]) {
    b.add(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), b.mat(body), [0, h, z]);
  }
  const slope = Math.atan2(0.26, w / 2);
  const len = Math.hypot(0.26, w / 2) + 0.08;
  for (const s of [-1, 1]) {
    b.box([len, 0.035, d + 0.14], roof, [(s * w) / 4, h + 0.13 + 0.02, 0], [0, 0, -s * slope]);
  }
  b.box([0.18, 0.06, 0.01], '#fbf3e2', [0, h + 0.08, d / 2 + 0.006]);
  return b.finish();
}

function armchair(): FurnitureModel {
  const b = new Builder();
  const fabric = '#6f8fb3';
  b.rounded([0.74, 0.3, 0.66], 0.05, fabric, [0, 0.22, 0], 1);
  b.rounded([0.52, 0.1, 0.5], 0.04, '#86a5c7', [0, 0.38, 0.05], 1);
  b.rounded([0.74, 0.5, 0.16], 0.06, fabric, [0, 0.56, -0.26], 1);
  b.rounded([0.12, 0.26, 0.64], 0.05, fabric, [-0.31, 0.47, 0], 1);
  b.rounded([0.12, 0.26, 0.64], 0.05, fabric, [0.31, 0.47, 0], 1);
  const leg = b.mat('#5b4030');
  for (const [x, z] of [
    [-0.3, -0.26],
    [0.3, -0.26],
    [-0.3, 0.26],
    [0.3, 0.26],
  ]) {
    b.cylinder(0.025, 0.02, 0.07, leg, [x, 0.035, z], [0, 0, 0], 10);
  }
  return b.finish();
}

function aquarium(): FurnitureModel {
  const b = new Builder();
  b.rounded([0.8, 0.45, 0.38], 0.02, '#8a6446', [0, 0.225, 0], 0.6);
  const tank = new THREE.Group();
  tank.position.y = 0.45;
  b.group.add(tank);
  b.add(new THREE.BoxGeometry(0.72, 0.05, 0.3), b.mat('#d8c8a8'), [0, 0.03, 0], undefined, undefined, tank);
  const water = b.add(
    new THREE.BoxGeometry(0.72, 0.3, 0.3),
    b.mat('#6fb7d6', 0.1, { transparent: true, opacity: 0.28, depthWrite: false }),
    [0, 0.2, 0],
    undefined,
    undefined,
    tank,
  );
  water.castShadow = false;
  [-0.25, -0.18, 0.22].forEach((x, i) =>
    b.add(new THREE.CapsuleGeometry(0.015, 0.16 + i * 0.04, 4, 8), b.mat('#4f9a5c'), [x, 0.15 + i * 0.02, -0.07], [0, 0, (i - 1) * 0.2], undefined, tank),
  );
  const fish: { g: THREE.Group; phase: number; y: number; r: number }[] = [];
  [
    ['#f08a3c', 0, 0.2, 0.25],
    ['#f5d14a', 2.1, 0.26, 0.2],
    ['#ea5a5a', 4.2, 0.15, 0.27],
  ].forEach(([color, phase, y, r]) => {
    const g = new THREE.Group();
    b.add(new THREE.SphereGeometry(0.022, 12, 8), b.mat(color as string, 0.4), [0, 0, 0], undefined, [1.6, 1, 0.6], g);
    b.add(new THREE.ConeGeometry(0.018, 0.03, 8), b.mat(color as string, 0.4), [-0.045, 0, 0], [0, 0, Math.PI / 2], undefined, g);
    tank.add(g);
    fish.push({ g, phase: phase as number, y: y as number, r: r as number });
  });
  const glass = b.add(
    new THREE.BoxGeometry(0.76, 0.36, 0.34),
    b.mat('#dff1f7', 0.05, { transparent: true, opacity: 0.16, depthWrite: false }),
    [0, 0.19, 0],
    undefined,
    undefined,
    tank,
  );
  glass.castShadow = false;
  b.add(new THREE.BoxGeometry(0.78, 0.03, 0.36), b.mat('#3f4a52'), [0, 0.385, 0], undefined, undefined, tank);
  return b.finish((time) => {
    for (const f of fish) {
      const t = time * 0.5 + f.phase;
      f.g.position.set(Math.sin(t) * f.r, f.y + Math.sin(t * 2.3) * 0.02, Math.cos(t * 1.3) * 0.06);
      f.g.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
    }
  });
}

function bigPlant(): FurnitureModel {
  const b = new Builder();
  b.cylinder(0.2, 0.15, 0.4, b.mat('#e6dccd'), [0, 0.2, 0], [0, 0, 0], 28);
  b.cylinder(0.185, 0.185, 0.02, b.mat('#6b4e35', 1), [0, 0.39, 0], [0, 0, 0], 28);
  // Long strap leaves arching out of the pot.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
    const tilt = 0.25 + (i % 3) * 0.2;
    const len = 0.55 + (i % 4) * 0.12;
    const leaf = b.add(
      new THREE.CapsuleGeometry(0.035, len, 4, 10),
      b.mat(i % 2 ? '#4f7f4c' : '#62925a', 0.7),
      [Math.cos(a) * (0.05 + Math.sin(tilt) * len * 0.5), 0.4 + (Math.cos(tilt) * len) / 2, Math.sin(a) * (0.05 + Math.sin(tilt) * len * 0.5)],
      [0, 0, 0],
      [1, 1, 0.3],
    );
    // Tilt outwards around the axis perpendicular to the leaf direction.
    leaf.rotation.set(0, -a, 0);
    leaf.rotateZ(-tilt);
  }
  return b.finish();
}

function floorLamp(light?: { color: string; intensity: number; height: number }): FurnitureModel {
  const b = new Builder();
  const metal = b.mat('#3f3a36', 0.5, { metalness: 0.3 });
  b.cylinder(0.16, 0.18, 0.04, metal, [0, 0.02, 0], [0, 0, 0], 28);
  b.cylinder(0.015, 0.015, 1.4, metal, [0, 0.72, 0], [0, 0, 0], 10);
  const shade = b.add(
    new THREE.CylinderGeometry(0.13, 0.22, 0.24, 28, 1, true),
    b.mat('#fbe9c9', 0.9, { emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    [0, 1.45, 0],
  );
  shade.castShadow = false;
  if (light) {
    const l = new THREE.PointLight(light.color, light.intensity, 4.5, 2);
    l.position.set(0, light.height, 0);
    b.group.add(l);
  }
  return b.finish();
}

function bookshelf(): FurnitureModel {
  const b = new Builder();
  const wood = '#a77b52';
  b.box([0.04, 1.5, 0.3], wood, [-0.4, 0.75, 0]);
  b.box([0.04, 1.5, 0.3], wood, [0.4, 0.75, 0]);
  for (const y of [0.02, 0.4, 0.78, 1.16, 1.48]) b.box([0.84, 0.04, 0.3], wood, [0, y, 0]);
  b.box([0.8, 1.5, 0.02], '#8e6645', [0, 0.75, -0.14]);
  const colors = ['#c65f4a', '#5a7fb3', '#e2a25e', '#6f9e63', '#8d6ab0', '#d9c27a', '#4a8a8a'];
  for (let shelf = 0; shelf < 3; shelf++) {
    let x = -0.36;
    let k = shelf * 3;
    while (x < 0.3) {
      const w = 0.035 + ((k * 7) % 4) * 0.008;
      const h = 0.2 + ((k * 5) % 3) * 0.03;
      const tilt = k % 9 === 4 ? 0.2 : 0;
      b.box([w, h, 0.22], colors[k % colors.length], [x + w / 2, 0.04 + shelf * 0.38 + h / 2, 0.02], [0, 0, tilt]);
      x += w + 0.006;
      k++;
      if (k % 11 === 6) x += 0.08;
    }
  }
  return b.finish();
}

/** Builds the model for a decor id (null for unknown ids). */
export function buildFurniture(id: string, light?: { color: string; intensity: number; height: number }): FurnitureModel | null {
  switch (id) {
    case 'box':
      return cardboardBox();
    case 'cushion':
      return floorCushion();
    case 'scratchPost':
      return scratchingPost();
    case 'catTree':
      return catTree();
    case 'kennel':
      return kennel();
    case 'armchair':
      return armchair();
    case 'aquarium':
      return aquarium();
    case 'bigPlant':
      return bigPlant();
    case 'floorLamp':
      return floorLamp(light);
    case 'bookshelf':
      return bookshelf();
    default:
      return null;
  }
}
