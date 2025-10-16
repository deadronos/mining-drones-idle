import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';
import { getBiomeDefinition } from '@/lib/biomes';

const ASTEROID_LIMIT = 256;
const primaryColor = new Color();
const secondaryColor = new Color();
const regionMix = new Color();
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
      const biomeDef = getBiomeDefinition(asteroid.biome.biomeId);
      primaryColor.set(biomeDef.palette.primary);
      secondaryColor.set(biomeDef.palette.secondary);
      let displayColor = primaryColor;
      if (asteroid.regions && asteroid.regions.length > 0) {
        regionMix.setRGB(0, 0, 0);
        for (const region of asteroid.regions) {
          const regionDef = getBiomeDefinition(region.biomeId);
          tempColor.set(regionDef.palette.primary).multiplyScalar(region.weight);
          regionMix.add(tempColor);
        }
        displayColor = regionMix;
      }
      const t = Math.min(Math.max((asteroid.colorBias - 0.8) / 0.8, 0), 1);
      tempColor.copy(displayColor).lerp(secondaryColor, t);
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
