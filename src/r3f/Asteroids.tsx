import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';

const ASTEROID_LIMIT = 256;
const baseColor = new Color('#475569');
const richColor = new Color('#8dd0ff');
const tempMatrix = new Matrix4();
const tempQuat = new Quaternion();
const tempScale = new Vector3();
const up = new Vector3(0, 1, 0);
const tempColor = new Color();

export const Asteroids = () => {
  const ref = useRef<InstancedMesh>(null);
  const { asteroidQuery } = gameWorld;

  useEffect(() => {
    asteroidQuery.connect();
    return () => {
      asteroidQuery.disconnect();
    };
  }, [asteroidQuery]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const asteroids = asteroidQuery.entities;
    const count = Math.min(asteroids.length, ASTEROID_LIMIT);
    for (let i = 0; i < count; i += 1) {
      const asteroid = asteroids[i];
      tempQuat.setFromAxisAngle(up, asteroid.rotation);
      tempScale.setScalar(asteroid.radius);
      tempMatrix.compose(asteroid.position, tempQuat, tempScale);
      mesh.setMatrixAt(i, tempMatrix);
      const t = Math.min(Math.max((asteroid.colorBias - 0.8) / 0.8, 0), 1);
      tempColor.copy(baseColor).lerp(richColor, t);
      mesh.setColorAt(i, tempColor);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined as never, undefined as never, ASTEROID_LIMIT]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
    </instancedMesh>
  );
};
