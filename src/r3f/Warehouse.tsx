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
const CARGO_COLOR = '#1a1a2e';
const CARGO_ACCENT = '#0f3460';
const STRUT_COLOR = '#16213e';
const PANEL_COLOR = '#0f172a';

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
      {/* Base foundation plate with detail */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[3.8, 4.2, 0.4, 24]} />
        <meshPhysicalMaterial
          color={PANEL_COLOR}
          metalness={0.45}
          roughness={0.75}
          clearcoat={0.3}
          clearcoatRoughness={0.8}
        />
      </mesh>

      {/* Base foundation struts */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * 3.5;
        const z = Math.sin(angle) * 3.5;
        return (
          <mesh
            key={`strut-${i}`}
            position={[x, -0.15, z]}
            rotation={[Math.PI / 2, angle, 0]}
            receiveShadow
          >
            <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
            <meshPhysicalMaterial
              color={STRUT_COLOR}
              metalness={0.6}
              roughness={0.6}
              clearcoat={0.2}
            />
          </mesh>
        );
      })}

      {/* Primary hub cylinder */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.6, 2.6, 24]} />
        <meshPhysicalMaterial
          color={HUB_COLOR}
          metalness={0.55}
          roughness={0.45}
          emissive={HUB_EMISSIVE}
          emissiveIntensity={0.5}
          clearcoat={0.25}
          clearcoatRoughness={0.7}
        />
      </mesh>

      {/* Hub detail rings */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={`hub-ring-${i}`} position={[0, -0.8 + i * 1.3, 0]} receiveShadow>
          <cylinderGeometry args={[2.35, 2.35, 0.12, 24]} />
          <meshPhysicalMaterial
            color={CARGO_ACCENT}
            metalness={0.7}
            roughness={0.3}
            emissive="#005a7f"
            emissiveIntensity={0.25}
            clearcoat={0.15}
          />
        </mesh>
      ))}

      {/* Upper hub section */}
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.35, 1.2, 24]} />
        <meshPhysicalMaterial
          color="#12343c"
          metalness={0.75}
          roughness={0.25}
          emissive={HUB_EMISSIVE}
          emissiveIntensity={0.72}
          clearcoat={0.3}
          clearcoatRoughness={0.6}
        />
      </mesh>

      {/* Cargo arms with enhanced detail */}
      {armOffsets.map((arm, idx) => (
        <group key={`storage-arm-${arm.position[0]}-${arm.position[2]}`}>
          {/* Main arm structure */}
          <mesh
            position={arm.position}
            rotation={arm.rotation}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.45, 0.65, 3.2, 16]} />
            <meshPhysicalMaterial
              color={ARM_COLOR}
              metalness={0.65}
              roughness={0.65}
              clearcoat={0.2}
              clearcoatRoughness={0.75}
            />
          </mesh>

          {/* Cargo pods attached to arms */}
          {Array.from({ length: 2 }).map((_, podIdx) => {
            const podZ = -1.2 + podIdx * 2.4;
            return (
              <mesh
                key={`cargo-pod-${idx}-${podIdx}`}
                position={[
                  arm.position[0],
                  arm.position[1] + 0.3,
                  arm.position[2] + podZ,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.8, 0.6, 1.0, 2, 2, 2]} />
                <meshPhysicalMaterial
                  color={CARGO_COLOR}
                  metalness={0.5}
                  roughness={0.7}
                  emissive={CARGO_ACCENT}
                  emissiveIntensity={0.15}
                  clearcoat={0.15}
                  clearcoatRoughness={0.8}
                />
              </mesh>
            );
          })}

          {/* Support strut from hub to arm */}
          <mesh
            position={[arm.position[0] * 0.6, 0.2, arm.position[2] * 0.6]}
            rotation={arm.rotation}
            receiveShadow
          >
            <cylinderGeometry args={[0.12, 0.12, 2.0, 8]} />
            <meshPhysicalMaterial
              color={STRUT_COLOR}
              metalness={0.55}
              roughness={0.65}
              clearcoat={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Primary docking ring */}
      <group ref={ringGroupRef} position={[0, 1.6, 0]}>
        <mesh castShadow>
          <torusGeometry args={[3.2, 0.18, 24, 96]} />
          <meshPhysicalMaterial
            color={RING_COLOR}
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.85}
            metalness={0.85}
            roughness={0.2}
            clearcoat={0.4}
            clearcoatRoughness={0.5}
          />
        </mesh>

        {/* Secondary docking ring */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[3.2, 0.08, 12, 64]} />
          <meshPhysicalMaterial
            color="#083344"
            emissive="#0f172a"
            emissiveIntensity={0.35}
            metalness={0.7}
            roughness={0.4}
            clearcoat={0.15}
          />
        </mesh>

        {/* Docking ports around ring */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          const x = Math.cos(angle) * 3.2;
          const z = Math.sin(angle) * 3.2;
          return (
            <mesh
              key={`dock-port-${i}`}
              position={[x, 0, z]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.3, 0.3, 0.25, 2, 2, 1]} />
              <meshPhysicalMaterial
                color={ANTENNA_COLOR}
                emissive={HUB_EMISSIVE}
                emissiveIntensity={0.6}
                metalness={0.75}
                roughness={0.3}
                clearcoat={0.25}
              />
            </mesh>
          );
        })}
      </group>

      {/* Secondary docking ring (non-rotating) */}
      <mesh position={[0, 0.8, 0]}>
        <torusGeometry args={[2.6, 0.12, 20, 80]} />
        <meshPhysicalMaterial
          color="#0a2f42"
          emissive="#005a7f"
          emissiveIntensity={0.4}
          metalness={0.65}
          roughness={0.5}
          clearcoat={0.2}
          clearcoatRoughness={0.7}
        />
      </mesh>

      {/* Solar panels with more complex geometry */}
      {solarOffsets.map((panel, index) => (
        <group key={`solar-${index}`}>
          {/* Main solar panel */}
          <mesh
            position={panel.position}
            rotation={panel.rotation}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[3.2, 1.4, 4, 4]} />
            <meshPhysicalMaterial
              color={SOLAR_COLOR}
              emissive="#1e3a8a"
              emissiveIntensity={0.22}
              metalness={0.9}
              roughness={0.15}
              side={DoubleSide}
              clearcoat={0.35}
              clearcoatRoughness={0.4}
            />
          </mesh>

          {/* Solar panel frame */}
          <mesh
            position={panel.position}
            rotation={panel.rotation}
            receiveShadow
          >
            <boxGeometry args={[3.35, 1.55, 0.05, 1, 1, 1]} />
            <meshPhysicalMaterial
              color={STRUT_COLOR}
              metalness={0.7}
              roughness={0.5}
              clearcoat={0.15}
            />
          </mesh>

          {/* Solar panel support struts */}
          {Array.from({ length: 2 }).map((_, i) => {
            const offset = i === 0 ? -1.5 : 1.5;
            const xOff = panel.position[0] + Math.sin(panel.rotation[2]) * offset;
            const yOff = panel.position[1] + Math.cos(panel.rotation[2]) * offset;
            const zOff = panel.position[2];
            return (
              <mesh
                key={`solar-strut-${index}-${i}`}
                position={[xOff, yOff, zOff]}
                rotation={[panel.rotation[0], panel.rotation[1], panel.rotation[2]]}
              >
                <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                <meshPhysicalMaterial
                  color={STRUT_COLOR}
                  metalness={0.6}
                  roughness={0.6}
                  clearcoat={0.1}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Communication/sensor tower */}
      <group position={[0, 2.3, 0]}>
        {/* Main antenna mast */}
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.24, 1.4, 16]} />
          <meshPhysicalMaterial
            color={ANTENNA_COLOR}
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.75}
            metalness={0.75}
            roughness={0.3}
            clearcoat={0.25}
            clearcoatRoughness={0.6}
          />
        </mesh>

        {/* Top beacon cone */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <coneGeometry args={[0.12, 0.35, 16]} />
          <meshPhysicalMaterial
            color="#f0f9ff"
            emissive={HUB_EMISSIVE}
            emissiveIntensity={0.95}
            metalness={0.7}
            roughness={0.15}
            clearcoat={0.3}
            clearcoatRoughness={0.5}
          />
        </mesh>

        {/* Communication dishes */}
        {Array.from({ length: 3 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 3;
          const x = Math.cos(angle) * 0.5;
          const z = Math.sin(angle) * 0.5;
          return (
            <mesh
              key={`comm-dish-${i}`}
              position={[x, 0.9, z]}
              rotation={[Math.PI / 3, angle, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.28, 0.28, 0.08, 16]} />
              <meshPhysicalMaterial
                color="#0a5a7f"
                emissive="#005a7f"
                emissiveIntensity={0.5}
                metalness={0.8}
                roughness={0.25}
                clearcoat={0.25}
                clearcoatRoughness={0.6}
              />
            </mesh>
          );
        })}
      </group>

      {/* Radiator panels (extending from sides) */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 4;
        const x = Math.cos(angle) * 2.8;
        const z = Math.sin(angle) * 2.8;
        const rotY = angle + Math.PI / 2;
        return (
          <mesh
            key={`radiator-${i}`}
            position={[x, 0.2, z]}
            rotation={[0, rotY, Math.PI / 6]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.15, 1.2, 0.8, 1, 4, 2]} />
            <meshPhysicalMaterial
              color="#1a1f3a"
              emissive="#1e1e2e"
              emissiveIntensity={0.2}
              metalness={0.7}
              roughness={0.5}
              clearcoat={0.15}
            />
          </mesh>
        );
      })}

      {/* Primary central light */}
      <pointLight
        position={[0, 2.4, 0]}
        intensity={0.65}
        color={HUB_EMISSIVE}
        distance={15}
        decay={2}
      />

      {/* Ambient glow lights around arms */}
      {armOffsets.map((arm, i) => (
        <pointLight
          key={`arm-light-${i}`}
          position={[arm.position[0], arm.position[1] + 0.5, arm.position[2]]}
          intensity={0.3}
          color="#0066cc"
          distance={8}
          decay={2}
        />
      ))}
    </group>
  );
};
