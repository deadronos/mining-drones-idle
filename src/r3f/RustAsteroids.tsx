import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect, useMemo } from 'react';
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
  const useRustSim = useStore((state) => state.settings.useRustSim);

  const resourceColors = useMemo(
    () => [
      new Color('#9ca3af'), // ore
      new Color('#7dd3fc'), // ice
      new Color('#c084fc'), // metals
      new Color('#f97316'), // crystals
      new Color('#22c55e'), // organics
    ],
    [],
  );

  useEffect(() => {
    asteroidQuery.connect();
    return () => {
      asteroidQuery.disconnect();
    };
  }, [asteroidQuery]);

  useEffect(() => {
    if (useRustSim) {
      return;
    }
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
  }, [camera, asteroidQuery, setSelectedAsteroid, useRustSim]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !bridge) return;

    const positions = bridge.getAsteroidPositions();
    const oreRemaining = bridge.getAsteroidOre();
    const resourceProfile = bridge.getAsteroidResourceProfile();
    const asteroids = asteroidQuery.entities;

    const bufferCount = Math.min(
      Math.floor(positions.length / 3),
      oreRemaining.length,
      Math.floor(resourceProfile.length / 5),
    );
    const count = Math.min(bufferCount, ASTEROID_LIMIT);

    for (let i = 0; i < count; i++) {
      const asteroid = asteroids[i];
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      // Derive a radius from ore remaining for a simple visual proxy
      const ore = oreRemaining[i] ?? 0;
      const radius = Math.max(0.5, Math.cbrt(Math.max(ore, 1) / 80));

      const spinSource = asteroid?.spin ?? 0;
      tempQuat.setFromAxisAngle(up, spinSource);
      tempScale.setScalar(radius);
      tempMatrix.compose(new Vector3(x, y, z), tempQuat, tempScale);
      mesh.setMatrixAt(i, tempMatrix);

      // Color driven by dominant resource profile when available; fall back to biome palette
      const profileOffset = i * 5;
      const profile = resourceProfile.slice(profileOffset, profileOffset + 5);
      let dominantIndex = 0;
      let dominantValue = profile[0] ?? 0;
      for (let j = 1; j < profile.length; j++) {
        const v = profile[j] ?? 0;
        if (v > dominantValue) {
          dominantValue = v;
          dominantIndex = j;
        }
      }
      const paletteColor = resourceColors[dominantIndex] ?? resourceColors[0];

      const colorBias = asteroid?.colorBias ?? 1;
      const biome = asteroid?.biome;
      if (biome) {
        const biomeDef = getBiomeDefinition(biome.biomeId);
        const primaryColor = new Color(biomeDef.palette.primary);
        const secondaryColor = new Color(biomeDef.palette.secondary);
        const t = Math.min(Math.max((colorBias - 0.8) / 0.8, 0), 1);
        tempColor.copy(primaryColor).lerp(secondaryColor, t);
      } else {
        tempColor.copy(paletteColor);
      }

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
