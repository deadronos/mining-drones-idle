import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3, Raycaster, Vector2 } from 'three';
import { gameWorld } from '@/ecs/world';
import { useStore } from '@/state/store';
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
  const { camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const setSelectedAsteroid = useStore((state) => state.setSelectedAsteroid);

  useEffect(() => {
    asteroidQuery.connect();
    return () => {
      asteroidQuery.disconnect();
    };
  }, [asteroidQuery]);

  // Add click handler for asteroid selection
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const mesh = ref.current;
      if (!mesh) return;

      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      if (!rect) return;

      // Convert mouse coordinates to normalized device coordinates
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(new Vector2(x, y), camera);

      // Get intersections with the asteroids mesh
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
