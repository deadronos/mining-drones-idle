/* eslint-disable react/no-unknown-property */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstancedMesh, MeshStandardMaterial, PointLight } from 'three';
import { CanvasTexture, Color, Matrix4, Quaternion, RepeatWrapping, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';
import { useStore, type PerformanceProfile } from '@/state/store';

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

const createConveyorTexture = () => {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#1f2937';
    for (let x = 0; x < size; x += 16) {
      context.fillRect(x, 0, 8, size);
    }
    context.fillStyle = '#38bdf8';
    context.globalAlpha = 0.2;
    for (let x = 0; x < size; x += 32) {
      context.fillRect(x, 0, 4, size);
    }
    context.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
};

const FactoryModel = ({ position }: { position: Vector3 }) => {
  const performanceProfile = useStore((state) => state.settings.performanceProfile);
  const beltTextures = useMemo(() => BELTS.map(() => createConveyorTexture()), []);
  useEffect(
    () => () => {
      beltTextures.forEach((texture) => texture?.dispose());
    },
    [beltTextures],
  );

  const beltOffsets = useRef<number[]>(BELTS.map(() => 0));
  const beltMaterials = useRef<Array<MeshStandardMaterial | null>>(BELTS.map(() => null));
  const itemMeshRef = useRef<InstancedMesh>(null);
  const coreMaterialRef = useRef<MeshStandardMaterial>(null);
  const ringMaterialRef = useRef<MeshStandardMaterial>(null);
  const baseMaterialRef = useRef<MeshStandardMaterial>(null);
  const boostLightRef = useRef<PointLight>(null);

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
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.8, 1.2, 32]} />
        <meshStandardMaterial
          ref={baseMaterialRef}
          color="#1f2937"
          metalness={0.55}
          roughness={0.4}
          emissive="#0f172a"
          emissiveIntensity={0.22}
        />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 1, 32]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#1e293b"
          metalness={0.65}
          roughness={0.3}
          emissive="#38bdf8"
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <torusGeometry args={[1.9, 0.12, 18, 64]} />
        <meshStandardMaterial
          ref={ringMaterialRef}
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={0.8}
          metalness={0.45}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.16, 3.4]} />
        <meshStandardMaterial color="#111827" metalness={0.2} roughness={0.65} />
      </mesh>
      {BELTS.map((belt, index) => (
        <mesh
          key={`belt-${index}`}
          position={belt.position}
          rotation={[0, index === 0 ? 0 : Math.PI, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={belt.scale} />
          <meshStandardMaterial
            ref={(material) => {
              beltMaterials.current[index] = material;
            }}
            color="#0f172a"
            metalness={0.25}
            roughness={0.5}
            emissive="#155e75"
            emissiveIntensity={0.18}
            map={beltTextures[index] ?? undefined}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={itemMeshRef}
        args={[undefined as never, undefined as never, ITEM_POOL_SIZE]}
        castShadow
      >
        <boxGeometry args={[0.28, 0.18, 0.28]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={0.4}
          roughness={0.4}
        />
      </instancedMesh>
      <pointLight
        ref={boostLightRef}
        position={[0, 2.6, 0]}
        color="#38bdf8"
        intensity={0.8}
        distance={10}
        decay={2}
      />
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
