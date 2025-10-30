/* eslint-disable react/no-unknown-property */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { gameWorld } from '@/ecs/world';
import { useStore } from '@/state/store';
import { PROFILE_CONFIG, TRANSFER_POOL_SIZE } from './constants';
import type { TransferState } from './types';

const identityQuaternion = new Quaternion();
const tempMatrix = new Matrix4();
const tempVector = new Vector3();
const fxScale = new Vector3(0.22, 0.22, 0.22);
const fxColor = new Color('#38bdf8');

export const FactoryTransferFX = () => {
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
