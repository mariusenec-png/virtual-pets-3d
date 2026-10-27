import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAT_RIG, DOG_RIG } from '../../../species/rigs';
import { RigAnimator, type RigAnimInput } from '../animator';
import { buildRig, computeSkinWeights, rigJoints } from '../autoRig';

function weightsAt(points: number[][], cfg = CAT_RIG) {
  const joints = rigJoints(cfg);
  const { indices, weights } = computeSkinWeights(new Float32Array(points.flat()), joints, cfg);
  return points.map((_, v) => {
    const out = new Map<string, number>();
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      if (w > 0) out.set(joints[indices[v * 4 + k]].name, (out.get(joints[indices[v * 4 + k]].name) ?? 0) + w);
    }
    return out;
  });
}

function dominant(m: Map<string, number>): string {
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

describe('auto-rig', () => {
  it('builds a mirrored quadruped skeleton', () => {
    const names = rigJoints(DOG_RIG).map((j) => j.name);
    for (const n of ['pelvis', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'hockL', 'hockR', 'tail0']) {
      expect(names).toContain(n);
    }
    const joints = rigJoints(CAT_RIG);
    const l = joints.find((j) => j.name === 'elbowL')!;
    const r = joints.find((j) => j.name === 'elbowR')!;
    expect(r.head[0]).toBeCloseTo(-l.head[0]);
  });

  it('gives every vertex normalized weights and keeps the legs apart', () => {
    const L = CAT_RIG.landmarks;
    const [frontLeft, frontRight, hindLeft, tailTip, head, belly] = weightsAt([
      [L.elbow[0], 0.12, L.elbow[2]],
      [-L.elbow[0], 0.12, L.elbow[2]],
      [L.hock[0], 0.12, L.hock[2] + 0.03],
      [0, 0.9, -0.48],
      [0, 0.66, 0.42],
      [0, 0.32, 0],
    ]);
    for (const m of [frontLeft, frontRight, hindLeft, tailTip, head, belly]) {
      const sum = [...m.values()].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
    expect(dominant(frontLeft)).toMatch(/^(elbow|wrist)L$/);
    expect([...frontLeft.keys()].some((n) => n.endsWith('R'))).toBe(false);
    expect(dominant(frontRight)).toMatch(/^(elbow|wrist)R$/);
    expect(dominant(hindLeft)).toMatch(/^(knee|hock)L$/);
    expect(dominant(tailTip)).toMatch(/^tail\d$/);
    expect(dominant(head)).toMatch(/^(head|neck)$/);
    expect(dominant(belly)).toMatch(/^(pelvis|spine|chest)$/);
  });

  it('skins a mesh and animates every activity without NaNs', () => {
    const wrapper = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial());
    body.position.set(0, 0.45, 0);
    body.scale.set(0.6, 0.6, 1.5);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshStandardMaterial());
    eye.position.set(0.05, 0.65, 0.45);
    wrapper.add(body, eye);
    wrapper.updateMatrixWorld(true);
    const rig = buildRig(wrapper, 1, body, [eye], CAT_RIG, 'test');
    expect(rig.body.isSkinnedMesh).toBe(true);
    expect(eye.parent?.name).toBe('head');
    expect(rig.proxies.length).toBeGreaterThan(0);

    const anim = new RigAnimator(rig, CAT_RIG, 'cat', 7);
    const activities: RigAnimInput['activity'][] = [
      null, 'eat', 'drink', 'play', 'petted', 'bath', 'sleep', 'wake', 'celebrate', 'refuse',
    ];
    const cases: [RigAnimInput['activity'], string | null, RigAnimInput['behavior']][] = [
      ...activities.map((a) => [a, null, null] as [RigAnimInput['activity'], string | null, RigAnimInput['behavior']]),
      ...['sit', 'paw', 'down', 'spin', 'beg', 'rollOver'].map(
        (id) => ['trick', id, null] as [RigAnimInput['activity'], string | null, RigAnimInput['behavior']],
      ),
      ['confused', 'paw', null],
      ...(['look', 'window', 'beg', 'watch', 'groom', 'sniff', 'toy', 'chaseTail', 'rest', 'stretch'] as const).map(
        (b) => [null, null, b] as [RigAnimInput['activity'], string | null, RigAnimInput['behavior']],
      ),
    ];
    for (const [activity, itemId, behavior] of cases) {
      for (let k = 0; k < 120; k++) {
        anim.update(
          {
            time: k / 30,
            speed: activity === null && !behavior && k < 60 ? 0.9 : 0,
            height: 0.6,
            activity,
            itemId,
            behavior,
            behaviorProgress: k / 120,
            spinning: behavior === 'chaseTail' || itemId === 'spin',
            progress: k / 120,
            arrived: true,
            sleeping: activity === 'sleep' && k > 100,
            unwell: false,
            happiness: 70,
            hop: 0,
            flinch: 0,
          },
          1 / 30,
        );
      }
      for (const bone of rig.bones.values()) {
        expect(Number.isFinite(bone.quaternion.x + bone.quaternion.y + bone.quaternion.z + bone.quaternion.w)).toBe(true);
        expect(Number.isFinite(bone.position.y)).toBe(true);
      }
      expect(anim.blink).toBeGreaterThan(0);
      expect(anim.blink).toBeLessThanOrEqual(1);
    }
  });
});
