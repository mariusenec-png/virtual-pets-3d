import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Image-based ambient light from three's procedural RoomEnvironment (no
 * HDR file to download). Gives materials soft, direction-dependent fill
 * light and subtle reflections instead of flat ambient light.
 */
export function SoftEnvironment({ intensity = 0.4 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    (room as unknown as { dispose?: () => void }).dispose?.();
    pmrem.dispose();
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}
