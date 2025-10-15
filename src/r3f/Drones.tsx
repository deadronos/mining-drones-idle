import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';

const DRONE_LIMIT = 128;
const idleColor = new Color('#94a3b8');
const miningColor = new Color('#f97316');
const returningColor = new Color('#22d3ee');
const unloadingColor = new Color('#cbd5f5');
const baseMatrix = new Matrix4();
const orientation = new Quaternion();
const scale = new Vector3(0.25, 0.6, 0.25);
const forward = new Vector3(0, 1, 0);
const direction = new Vector3();
const color = new Color();

const colorForState = (state: string) => {
  switch (state) {
    case 'mining':
      return miningColor;
    case 'returning':
      return returningColor;
    case 'unloading':
      return unloadingColor;
    default:
      return idleColor;
  }
};

export const Drones = () => {
  const ref = useRef<InstancedMesh>(null);
  const { droneQuery } = gameWorld;

  useEffect(() => {
    droneQuery.connect();
    return () => {
      droneQuery.disconnect();
    };
  }, [droneQuery]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const drones = droneQuery.entities;
    const count = Math.min(drones.length, DRONE_LIMIT);
    for (let i = 0; i < count; i += 1) {
      const drone = drones[i];
      if (drone.travel) {
        direction.copy(drone.travel.to).sub(drone.travel.from);
      } else if (drone.state === 'returning' || drone.state === 'unloading') {
        direction.copy(gameWorld.factory.position).sub(drone.position);
      } else {
        direction.set(0, 1, 0);
      }
      if (direction.lengthSq() < 1e-4) {
        orientation.identity();
      } else {
        orientation.setFromUnitVectors(forward, direction.normalize());
      }
      baseMatrix.compose(drone.position, orientation, scale);
      mesh.setMatrixAt(i, baseMatrix);
      color.copy(colorForState(drone.state));
      mesh.setColorAt(i, color);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined as never, undefined as never, DRONE_LIMIT]}>
      <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
      <meshStandardMaterial
        vertexColors
        emissiveIntensity={0.6}
        emissive={'#0ea5e9'}
        roughness={0.4}
        metalness={0.2}
      />
    </instancedMesh>
  );
};
