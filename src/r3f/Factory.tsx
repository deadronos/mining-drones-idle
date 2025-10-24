/* eslint-disable react/no-unknown-property */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstancedMesh, MeshStandardMaterial, PointLight, Group } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';
import { useStore, type PerformanceProfile } from '@/state/store';
import { getConveyorTexture, releaseConveyorTexture } from './assetCache';

interface BeltDefinition {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  direction: number;
  pathFrom: Vector3;
  pathTo: Vector3;
}

const BELTS: BeltDefinition[] = [
  {
    position: [0, 0.32, 1.6],
    scale: [3.4, 0.18, 1],
    direction: 1,
    pathFrom: new Vector3(-1.7, 0.55, 1.4),
    pathTo: new Vector3(0.4, 0.55, 0.5),
  },
  {
    position: [0, 0.32, -1.6],
    scale: [3.4, 0.18, 1],
    direction: -1,
    pathFrom: new Vector3(1.7, 0.55, -1.4),
    pathTo: new Vector3(-0.4, 0.55, -0.5),
  },
];

const PROFILE_CONFIG: Record<
  PerformanceProfile,
  {
    itemCount: number;
    transferLimit: number;
    beltSpeed: number;
    effectMultiplier: number;
  }
> = {
  low: { itemCount: 0, transferLimit: 0, beltSpeed: 0.55, effectMultiplier: 0.6 },
  medium: { itemCount: 12, transferLimit: 12, beltSpeed: 0.85, effectMultiplier: 1 },
  high: { itemCount: 24, transferLimit: 20, beltSpeed: 1.25, effectMultiplier: 1.3 },
};

const ITEM_POOL_SIZE = 36;
const TRANSFER_POOL_SIZE = 28;
const identityQuaternion = new Quaternion();
const tempMatrix = new Matrix4();
const tempVector = new Vector3();
const fxScale = new Vector3(0.22, 0.22, 0.22);
const itemScale = new Vector3(0.2, 0.2, 0.2);
const fxColor = new Color('#38bdf8');

// Factory color palette
const FACTORY_BASE = '#1f2937';
const FACTORY_CORE = '#1e293b';
const FACTORY_RING = '#38bdf8';
const FACTORY_ACCENT = '#0ea5e9';
const FACTORY_STRUT = '#1a1a2e';
const FACTORY_PANEL = '#111827';
const FACTORY_GLOW = '#0f172a';

type TransferState = {
  active: boolean;
  elapsed: number;
  duration: number;
  from: Vector3;
  to: Vector3;
  arcHeight: number;
  amount: number;
};

type ItemState = {
  pathIndex: number;
  progress: number;
  speed: number;
  jitter: number;
};

const FactoryModel = ({ position }: { position: Vector3 }) => {
  const performanceProfile = useStore((state) => state.settings.performanceProfile);
  // Use shared conveyor texture cache: all factories share the same texture resource
  const sharedBeltTexture = useMemo(() => getConveyorTexture(), []);
  const beltTextures = useMemo(() => BELTS.map(() => sharedBeltTexture), [sharedBeltTexture]);

  useEffect(
    () => () => {
      // Release the shared texture reference when component unmounts
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

  const [initialItemStates] = useState<ItemState[]>(() =>
    Array.from({ length: ITEM_POOL_SIZE }, (_, index) => ({
      pathIndex: index % BELTS.length,
      progress: Math.random(),
      speed: 0.5 + Math.random() * 0.5,
      jitter: (Math.random() - 0.5) * 0.3,
    })),
  );
  const itemStates = useRef<ItemState[]>(initialItemStates);

  useFrame((_, delta) => {
    const { factory } = gameWorld;
    const activity = factory.activity;
    const profileConfig = PROFILE_CONFIG[performanceProfile];

    const processing = activity.processing;
    if (baseMaterialRef.current) {
      baseMaterialRef.current.emissiveIntensity = 0.18 + processing * 0.35;
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 0.5 + processing * 0.9 + activity.boost * 0.6;
    }
    if (ringMaterialRef.current) {
      ringMaterialRef.current.emissiveIntensity = 0.75 + activity.boost * 1.4;
    }
    beltMaterials.current.forEach((material) => {
      if (!material) return;
      material.emissiveIntensity = 0.12 + processing * 0.5;
    });
    if (boostLightRef.current) {
      boostLightRef.current.intensity = 0.6 + activity.boost * 1.6;
    }

    // Rotate the docking ring
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.z += delta * 0.8;
    }

    beltTextures.forEach((texture, index) => {
      if (!texture) return;
      const direction = BELTS[index]?.direction ?? 1;
      const baseSpeed = profileConfig.beltSpeed;
      const speed = (0.25 + processing) * baseSpeed * direction;
      const offset = beltOffsets.current[index] + delta * speed;
      const wrapped = ((offset % 1) + 1) % 1;
      beltOffsets.current[index] = wrapped;
      texture.offset.x = wrapped;
    });

    const itemMesh = itemMeshRef.current;
    if (itemMesh) {
      const targetCount = profileConfig.itemCount;
      if (targetCount <= 0) {
        itemMesh.count = 0;
        itemMesh.instanceMatrix.needsUpdate = true;
      } else {
        let count = 0;
        const states = itemStates.current;
        const speedFactor = 0.5 + processing * 1.4;
        for (let i = 0; i < targetCount && i < states.length; i += 1) {
          const state = states[i];
          state.progress = (state.progress + delta * state.speed * speedFactor) % 1;
          const path = BELTS[state.pathIndex % BELTS.length];
          tempVector.copy(path.pathFrom).lerp(path.pathTo, state.progress);
          tempVector.y += state.jitter * 0.08;
          tempMatrix.compose(tempVector, identityQuaternion, itemScale);
          itemMesh.setMatrixAt(count, tempMatrix);
          count += 1;
        }
        itemMesh.count = count;
        itemMesh.instanceMatrix.needsUpdate = count > 0;
      }
    }
  });

  const orientation = gameWorld.factory.orientation;
  const positionArray: [number, number, number] = [position.x, position.y, position.z];

  return (
    <group position={positionArray} quaternion={orientation}>
      {/* Foundation base plate */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.6, 0.25, 32]} />
        <meshPhysicalMaterial
          color={FACTORY_PANEL}
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
              color={FACTORY_STRUT}
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
          color={FACTORY_BASE}
          metalness={0.6}
          roughness={0.35}
          emissive={FACTORY_GLOW}
          emissiveIntensity={0.22}
          clearcoat={0.25}
          clearcoatRoughness={0.65}
        />
      </mesh>

      {/* Base detail rings */}
      {Array.from({ length: 2 }).map((_, i) => (
        <mesh key={`base-ring-${i}`} position={[0, -0.35 + i * 0.7, 0]} receiveShadow>
          <cylinderGeometry args={[2.85, 2.85, 0.1, 32]} />
          <meshPhysicalMaterial
            color={FACTORY_ACCENT}
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
          color={FACTORY_CORE}
          metalness={0.7}
          roughness={0.25}
          emissive={FACTORY_RING}
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
            color={FACTORY_RING}
            emissive={FACTORY_ACCENT}
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
                color={FACTORY_RING}
                emissive={FACTORY_RING}
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
          color={FACTORY_PANEL}
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
              color={FACTORY_STRUT}
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
            color={FACTORY_GLOW}
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
          emissive={FACTORY_ACCENT}
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
        color={FACTORY_RING}
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

const FactoryTransferFX = () => {
  const performanceProfile = useStore((state) => state.settings.performanceProfile);
  const transferMeshRef = useRef<InstancedMesh>(null);
  const [initialTransferStates] = useState<TransferState[]>(() =>
    Array.from({ length: TRANSFER_POOL_SIZE }, () => ({
      active: false,
      elapsed: 0,
      duration: 0.65,
      from: new Vector3(),
      to: new Vector3(),
      arcHeight: 0.5,
      amount: 0,
    })),
  );
  const transferStates = useRef<TransferState[]>(initialTransferStates);

  useFrame((_, delta) => {
    const { events, factory } = gameWorld;
    const activity = factory.activity;
    const profileConfig = PROFILE_CONFIG[performanceProfile];
    const transferMesh = transferMeshRef.current;
    const queue = events.transfers;

    if (!transferMesh) {
      queue.length = 0;
      return;
    }

    if (profileConfig.transferLimit <= 0) {
      queue.length = 0;
      transferStates.current.forEach((state) => {
        state.active = false;
        state.elapsed = 0;
      });
      transferMesh.count = 0;
      transferMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    let spawnBudget = profileConfig.transferLimit;
    while (queue.length > 0 && spawnBudget > 0) {
      const event = queue.shift();
      if (!event) break;
      spawnBudget -= 1;
      const slot = transferStates.current.find((state) => !state.active);
      if (!slot) {
        queue.unshift(event);
        break;
      }
      slot.active = true;
      slot.elapsed = 0;
      slot.duration = event.duration;
      slot.from.copy(event.from);
      slot.to.copy(event.to);
      slot.amount = event.amount;
      slot.arcHeight = 0.4 + Math.min(1, event.amount / 80) * 0.5 * profileConfig.effectMultiplier;
    }

    if (queue.length > TRANSFER_POOL_SIZE) {
      queue.splice(0, queue.length - TRANSFER_POOL_SIZE);
    }

    let count = 0;
    for (const state of transferStates.current) {
      if (!state.active) continue;
      state.elapsed += delta;
      const progress = state.duration > 0 ? state.elapsed / state.duration : 1;
      if (progress >= 1) {
        state.active = false;
        continue;
      }
      const eased = progress * (2 - progress);
      tempVector.copy(state.from).lerp(state.to, eased);
      tempVector.y += Math.sin(Math.PI * eased) * state.arcHeight;
      tempMatrix.compose(tempVector, identityQuaternion, fxScale);
      transferMesh.setMatrixAt(count, tempMatrix);
      const brightness = 0.55 + activity.boost * 0.4 + Math.min(0.4, state.amount / 140);
      fxColor.setHSL(0.53, 0.85, Math.min(0.8, brightness));
      transferMesh.setColorAt?.(count, fxColor);
      count += 1;
    }

    transferMesh.count = count;
    transferMesh.instanceMatrix.needsUpdate = count > 0;
    if (transferMesh.instanceColor) {
      transferMesh.instanceColor.needsUpdate = count > 0;
    }
  });

  return (
    <instancedMesh
      ref={transferMeshRef}
      args={[undefined as never, undefined as never, TRANSFER_POOL_SIZE]}
      castShadow
    >
      <sphereGeometry args={[0.16, 12, 12]} />
      <meshStandardMaterial
        color="#38bdf8"
        emissive="#0ea5e9"
        emissiveIntensity={0.9}
        roughness={0.25}
        metalness={0.2}
        vertexColors
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
};

export const Factory = () => {
  const factories = useStore((state) => state.factories);

  return (
    <>
      {factories.map((factory) => (
        <FactoryModel key={factory.id} position={factory.position} />
      ))}
      <FactoryTransferFX />
    </>
  );
};
