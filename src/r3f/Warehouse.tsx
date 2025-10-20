/* eslint-disable react/no-unknown-property */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { DoubleSide } from 'three';
import { gameWorld, WAREHOUSE_POSITION } from '@/ecs/world';
import {
  createArmOffsets,
  createSolarOffsets,
  updateDockingRingRotation,
} from './warehouseHelpers';

const HUB_COLOR = '#1A5F5F';
const HUB_EMISSIVE = '#00D9FF';
const ARM_COLOR = '#2A2A3E';
const RING_COLOR = '#00D9FF';
const SOLAR_COLOR = '#1A3A5F';
const ANTENNA_COLOR = '#00D9FF';

export const Warehouse = () => {
  const ringGroupRef = useRef<Group>(null);
  const armOffsets = useMemo(() => createArmOffsets(), []);
  const solarOffsets = useMemo(() => createSolarOffsets(), []);
  const position = useMemo(() => {
    const { warehouse } = gameWorld;
    const vector = warehouse?.position ?? WAREHOUSE_POSITION;
    return [vector.x, vector.y, vector.z] as const;
  }, []);

  useFrame((_, delta) => {
    if (ringGroupRef.current) {
      updateDockingRingRotation(ringGroupRef.current, delta);
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[3.8, 4.2, 0.4, 24]} />
        <meshStandardMaterial color="#0f172a" metalness={0.35} roughness={0.8} />
      </mesh>

      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.6, 2.6, 24]} />
        <meshStandardMaterial
          color={HUB_COLOR}
          metalness={0.45}
          roughness={0.55}
          emissive={HUB_EMISSIVE}
          emissiveIntensity={0.5}
        />
      </mesh>

      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.35, 1.2, 24]} />
        <meshStandardMaterial
          color="#12343c"
          metalness={0.65}
          roughness={0.32}
          emissive={HUB_EMISSIVE}
          emissiveIntensity={0.72}
        />
      </mesh>

      {armOffsets.map((arm) => (
        <mesh
          key={`storage-arm-${arm.position[0]}-${arm.position[2]}`}
          position={arm.position}
          rotation={arm.rotation}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.45, 0.65, 3.2, 16]} />
          <meshStandardMaterial color={ARM_COLOR} metalness={0.6} roughness={0.8} />
        </mesh>
      ))}

      <group ref={ringGroupRef} position={[0, 1.6, 0]}>
        <mesh castShadow>
          <torusGeometry args={[3.2, 0.18, 24, 96]} />
          <meshStandardMaterial
            color={RING_COLOR}
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.85}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[3.2, 0.08, 12, 64]} />
          <meshStandardMaterial
            color="#083344"
            emissive="#0f172a"
            emissiveIntensity={0.35}
            metalness={0.65}
            roughness={0.5}
          />
        </mesh>
      </group>

      {solarOffsets.map((panel, index) => (
        <mesh
          key={`solar-${index}`}
          position={panel.position}
          rotation={panel.rotation}
          castShadow
          receiveShadow
        >
          <planeGeometry args={[3.2, 1.4, 1, 1]} />
          <meshStandardMaterial
            color={SOLAR_COLOR}
            emissive="#1e3a8a"
            emissiveIntensity={0.18}
            metalness={0.85}
            roughness={0.25}
            side={DoubleSide}
          />
        </mesh>
      ))}

      <group position={[0, 2.3, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.24, 1.4, 16]} />
          <meshStandardMaterial
            color={ANTENNA_COLOR}
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.75}
            metalness={0.7}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <coneGeometry args={[0.12, 0.35, 16]} />
          <meshStandardMaterial
            color="#f0f9ff"
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.9}
            metalness={0.65}
            roughness={0.2}
          />
        </mesh>
      </group>

      <pointLight
        position={[0, 2.4, 0]}
        intensity={0.6}
        color={HUB_EMISSIVE}
        distance={14}
        decay={2}
      />
    </group>
  );
};
