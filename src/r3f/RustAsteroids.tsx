import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3, Raycaster, Vector2 } from 'three';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { useStore } from '@/state/store';
import { getBiomeDefinition } from '@/lib/biomes';
import { gameWorld } from '@/ecs/world';

const ASTEROID_LIMIT = 256;
const tempMatrix = new Matrix4();
const tempQuat = new Quaternion();
const tempScale = new Vector3();
const up = new Vector3(0, 1, 0);
const tempColor = new Color();

interface RustAsteroidsProps {
  bridge: RustSimBridge | null;
}

/**
 * Asteroid renderer that reads position data from Rust WASM buffers.
 * Falls back to ECS data for biome/color information since those
 * aren't stored in the Rust buffers.
 */
export const RustAsteroids = ({ bridge }: RustAsteroidsProps) => {
  const ref = useRef<InstancedMesh>(null);
  const { asteroidQuery } = gameWorld;
  const { camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const setSelectedAsteroid = useStore((state) => state.setSelectedAsteroid);

  useEffect(() => {
    asteroidQuery.connect();
    return () => {
      asteroidQuery.disconnect();
    };
  }, [asteroidQuery]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const mesh = ref.current;
      if (!mesh) return;

      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      if (!rect) return;

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(new Vector2(x, y), camera);

      const intersects = raycaster.current.intersectObject(mesh, false);

      if (intersects.length > 0) {
        const instanceIndex = intersects[0].instanceId;
        if (instanceIndex !== undefined) {
          const asteroids = asteroidQuery.entities;
          const selectedAsteroid = asteroids[instanceIndex];
          if (selectedAsteroid) {
            setSelectedAsteroid(selectedAsteroid.id);
          }
        }
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [camera, asteroidQuery, setSelectedAsteroid]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !bridge) return;

    const positions = bridge.getAsteroidPositions();
    const oreRemaining = bridge.getAsteroidOre();
    const asteroids = asteroidQuery.entities;

    const count = Math.min(oreRemaining.length, asteroids.length, ASTEROID_LIMIT);

    for (let i = 0; i < count; i++) {
      const asteroid = asteroids[i];

      // Read position from Rust buffer
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      tempQuat.setFromAxisAngle(up, asteroid.rotation);
      tempScale.setScalar(asteroid.radius);
      tempMatrix.compose(new Vector3(x, y, z), tempQuat, tempScale);
      mesh.setMatrixAt(i, tempMatrix);

      // Color from ECS biome data (not in Rust buffers)
      const biomeDef = getBiomeDefinition(asteroid.biome.biomeId);
      const primaryColor = new Color(biomeDef.palette.primary);
      const secondaryColor = new Color(biomeDef.palette.secondary);

      let displayColor = primaryColor;
      if (asteroid.regions && asteroid.regions.length > 0) {
        const regionMix = new Color(0, 0, 0);
        for (const region of asteroid.regions) {
          const regionDef = getBiomeDefinition(region.biomeId);
          const regionColor = new Color(regionDef.palette.primary).multiplyScalar(region.weight);
          regionMix.add(regionColor);
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
