/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstancedMesh, MeshStandardMaterial, PointLight, Group, Mesh, MeshBasicMaterial } from 'three';
import { AdditiveBlending } from 'three';
import { gameWorld } from '@/ecs/world';
import { useStore } from '@/state/store';
import type { BuildableFactory } from '@/ecs/factories';
import { getConveyorTexture, releaseConveyorTexture } from '../assetCache';
import { FACTORY_COLORS, BELTS, ITEM_POOL_SIZE } from './constants';
import type { ItemState } from './types';
import { useFactoryAnimation } from './useFactoryAnimation';

export const FactoryModel = ({ factory }: { factory: BuildableFactory }) => {
  const { position, id } = factory;
  const performanceProfile = useStore((state) => state.settings.performanceProfile);
  const highlighted = useStore((state) => state.highlightedFactories);
  const isSourceHighlight = highlighted.sourceId === id;
  const isDestinationHighlight = highlighted.destId === id;
  const sharedBeltTexture = useMemo(() => getConveyorTexture(), []);
  const beltTextures = useMemo(() => BELTS.map(() => sharedBeltTexture), [sharedBeltTexture]);

  useEffect(
    () => () => {
      releaseConveyorTexture();
    },
    [],
  );

  const beltOffsets = useRef<number[]>(BELTS.map(() => 0));
  const beltMaterials = useRef<Array<MeshStandardMaterial | null>>(BELTS.map(() => null));
  const itemMeshRef = useRef<InstancedMesh>(null);
  const coreMaterialRef = useRef<MeshStandardMaterial>(null);
  const ringMaterialRef = useRef<MeshStandardMaterial>(null);
  const baseMaterialRef = useRef<MeshStandardMaterial>(null);
  const boostLightRef = useRef<PointLight>(null);
  const ringGroupRef = useRef<Group>(null);
  const highlightRingRef = useRef<Mesh>(null);
  const highlightRingMaterialRef = useRef<MeshBasicMaterial>(null);
  const highlightStrengthRef = useRef(0);
  const highlightPulseRef = useRef(0);

  const [initialItemStates] = useState<ItemState[]>(() =>
    Array.from({ length: ITEM_POOL_SIZE }, (_, index) => ({
      pathIndex: index % BELTS.length,
      progress: Math.random(),
      speed: 0.5 + Math.random() * 0.5,
      jitter: (Math.random() - 0.5) * 0.3,
    })),
  );
  const itemStates = useRef<ItemState[]>(initialItemStates);

  useFactoryAnimation({
    refs: {
      beltOffsets,
      beltMaterials,
      itemMeshRef,
      coreMaterialRef,
      ringMaterialRef,
      baseMaterialRef,
      boostLightRef,
      ringGroupRef,
      highlightRingRef,
      highlightRingMaterialRef,
      itemStates,
      highlightStrengthRef,
      highlightPulseRef,
    },
    performanceProfile,
    beltTextures,
    isSourceHighlight,
    isDestinationHighlight,
  });

  const orientation = gameWorld.factory.orientation;
  const positionArray: [number, number, number] = [position.x, position.y, position.z];

  return (
    <group position={positionArray} quaternion={orientation}>
      {/* Foundation base plate */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.6, 0.25, 32]} />
        <meshPhysicalMaterial
          color={FACTORY_COLORS.PANEL}
          metalness={0.4}
          roughness={0.7}
          clearcoat={0.2}
          clearcoatRoughness={0.8}
        />
      </mesh>

      {/* Foundation support struts */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * 2.8;
        const z = Math.sin(angle) * 2.8;
        return (
          <mesh
            key={`foundation-strut-${i}`}
            position={[x, -0.08, z]}
            rotation={[Math.PI / 2, angle, 0]}
          >
            <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
            <meshPhysicalMaterial
              color={FACTORY_COLORS.STRUT}
              metalness={0.55}
              roughness={0.6}
              clearcoat={0.1}
            />
          </mesh>
        );
      })}

      {/* Main base cylinder with enhanced detail */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.8, 1.2, 32]} />
        <meshPhysicalMaterial
          ref={baseMaterialRef}
          color={FACTORY_COLORS.BASE}
          metalness={0.6}
          roughness={0.35}
          emissive={FACTORY_COLORS.GLOW}
          emissiveIntensity={0.22}
          clearcoat={0.25}
          clearcoatRoughness={0.65}
        />
      </mesh>

      <mesh
        ref={highlightRingRef}
        position={[0, -0.18, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={-1}
      >
        <ringGeometry args={[2.4, 3.4, 48]} />
        <meshBasicMaterial
          ref={highlightRingMaterialRef}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          color={FACTORY_COLORS.RING}
          toneMapped={false}
        />
      </mesh>

      {/* Base detail rings */}
      {Array.from({ length: 2 }).map((_, i) => (
        <mesh key={`base-ring-${i}`} position={[0, -0.35 + i * 0.7, 0]} receiveShadow>
          <cylinderGeometry args={[2.85, 2.85, 0.1, 32]} />
          <meshPhysicalMaterial
            color={FACTORY_COLORS.ACCENT}
            metalness={0.65}
            roughness={0.4}
            emissive="#06b6d4"
            emissiveIntensity={0.2}
            clearcoat={0.15}
          />
        </mesh>
      ))}

      {/* Processing core */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 1, 32]} />
        <meshPhysicalMaterial
          ref={coreMaterialRef}
          color={FACTORY_COLORS.CORE}
          metalness={0.7}
          roughness={0.25}
          emissive={FACTORY_COLORS.RING}
          emissiveIntensity={0.6}
          clearcoat={0.3}
          clearcoatRoughness={0.55}
        />
      </mesh>

      {/* Core detail rings */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={`core-ring-${i}`} position={[0, 0.1 + i * 0.4, 0]} receiveShadow>
          <cylinderGeometry args={[1.7, 1.7, 0.08, 32]} />
          <meshPhysicalMaterial
            color="#0f2942"
            metalness={0.65}
            roughness={0.45}
            emissive="#0c4a6e"
            emissiveIntensity={0.15}
            clearcoat={0.15}
          />
        </mesh>
      ))}

      {/* Primary rotating docking ring */}
      <group ref={ringGroupRef} position={[0, 1.5, 0]}>
        <mesh castShadow>
          <torusGeometry args={[1.9, 0.12, 18, 64]} />
          <meshPhysicalMaterial
            ref={ringMaterialRef}
            color={FACTORY_COLORS.RING}
            emissive={FACTORY_COLORS.ACCENT}
            emissiveIntensity={0.8}
            metalness={0.5}
            roughness={0.2}
            clearcoat={0.35}
            clearcoatRoughness={0.5}
          />
        </mesh>

        {/* Docking port connectors around ring */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 6;
          const x = Math.cos(angle) * 1.9;
          const z = Math.sin(angle) * 1.9;
          return (
            <mesh key={`dock-connector-${i}`} position={[x, 0, z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.25, 0.25, 0.2, 2, 2, 1]} />
              <meshPhysicalMaterial
                color={FACTORY_COLORS.RING}
                emissive={FACTORY_COLORS.RING}
                emissiveIntensity={0.5}
                metalness={0.75}
                roughness={0.25}
                clearcoat={0.2}
              />
            </mesh>
          );
        })}

        {/* Secondary stabilizing ring (perpendicular) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8, 0.06, 12, 48]} />
          <meshPhysicalMaterial
            color="#0a3a52"
            metalness={0.6}
            roughness={0.4}
            emissive="#05596f"
            emissiveIntensity={0.3}
            clearcoat={0.15}
          />
        </mesh>
      </group>

      {/* Secondary static ring */}
      <mesh position={[0, 0.75, 0]}>
        <torusGeometry args={[2.1, 0.08, 20, 80]} />
        <meshPhysicalMaterial
          color="#0c2d42"
          emissive="#0a4a62"
          emissiveIntensity={0.35}
          metalness={0.6}
          roughness={0.45}
          clearcoat={0.2}
        />
      </mesh>

      {/* Floor platform with grid detail */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.16, 3.4]} />
        <meshPhysicalMaterial
          color={FACTORY_COLORS.PANEL}
          metalness={0.3}
          roughness={0.65}
          clearcoat={0.1}
        />
      </mesh>

      {/* Corner support struts */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i * Math.PI) / 2;
        const x = Math.cos(angle) * 1.4;
        const z = Math.sin(angle) * 1.4;
        return (
          <mesh
            key={`support-strut-${i}`}
            position={[x, 0.35, z]}
            rotation={[0, angle, 0]}
            receiveShadow
          >
            <cylinderGeometry args={[0.08, 0.08, 0.9, 12]} />
            <meshPhysicalMaterial
              color={FACTORY_COLORS.STRUT}
              metalness={0.5}
              roughness={0.65}
              clearcoat={0.1}
            />
          </mesh>
        );
      })}

      {/* Radiator heat fins (side panels) */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 4;
        const x = Math.cos(angle) * 2.5;
        const z = Math.sin(angle) * 2.5;
        const rotY = angle + Math.PI / 2;
        return (
          <mesh
            key={`radiator-${i}`}
            position={[x, 0.5, z]}
            rotation={[0, rotY, Math.PI / 8]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.12, 0.8, 0.6, 1, 3, 2]} />
            <meshPhysicalMaterial
              color="#0d1f2d"
              emissive="#0f2a3a"
              emissiveIntensity={0.15}
              metalness={0.65}
              roughness={0.5}
              clearcoat={0.12}
            />
          </mesh>
        );
      })}

      {/* Conveyor belts */}
      {BELTS.map((belt, index) => (
        <mesh
          key={`belt-${index}`}
          position={belt.position}
          rotation={[0, index === 0 ? 0 : Math.PI, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={belt.scale} />
          <meshPhysicalMaterial
            ref={(material) => {
              beltMaterials.current[index] = material;
            }}
            color={FACTORY_COLORS.GLOW}
            metalness={0.35}
            roughness={0.45}
            emissive="#155e75"
            emissiveIntensity={0.18}
            map={beltTextures[index] ?? undefined}
            clearcoat={0.15}
          />
        </mesh>
      ))}

      {/* Items on conveyor */}
      <instancedMesh
        ref={itemMeshRef}
        args={[undefined as never, undefined as never, ITEM_POOL_SIZE]}
        castShadow
      >
        <boxGeometry args={[0.28, 0.18, 0.28]} />
        <meshPhysicalMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.3}
          clearcoat={0.2}
        />
      </instancedMesh>

      {/* Top beacon */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <coneGeometry args={[0.15, 0.3, 16]} />
        <meshPhysicalMaterial
          color="#7dd3fc"
          emissive={FACTORY_COLORS.ACCENT}
          emissiveIntensity={0.7}
          metalness={0.65}
          roughness={0.2}
          clearcoat={0.25}
        />
      </mesh>

      {/* Boost/activity light */}
      <pointLight
        ref={boostLightRef}
        position={[0, 2.6, 0]}
        color={FACTORY_COLORS.RING}
        intensity={0.8}
        distance={10}
        decay={2}
      />

      {/* Ambient accent lights around radiators */}
      {Array.from({ length: 4 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 4;
        const x = Math.cos(angle) * 2.5;
        const z = Math.sin(angle) * 2.5;
        return (
          <pointLight
            key={`accent-light-${i}`}
            position={[x, 0.5, z]}
            color="#0ea5e9"
            intensity={0.25}
            distance={6}
            decay={2}
          />
        );
      })}
    </group>
  );
};
