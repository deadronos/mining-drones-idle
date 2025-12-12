import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type {
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Texture,
} from 'three';
import { gameWorld } from '@/ecs/world';
import type { PerformanceProfile } from '@/state/types';

import {
  BASE_BASE_EMISSIVE,
  BASE_BELT_EMISSIVE,
  BASE_CORE_EMISSIVE,
  BASE_LIGHT_COLOR,
  BASE_RING_COLOR,
  BASE_RING_EMISSIVE,
  BELTS,
  HIGHLIGHT_DEST,
  HIGHLIGHT_SOURCE,
  PROFILE_CONFIG,
} from './constants';
import type { ItemState } from './types';

const identityQuaternion = new Quaternion();
const tempMatrix = new Matrix4();
const tempVector = new Vector3();
const itemScale = new Vector3(0.2, 0.2, 0.2);

export interface FactoryAnimationRefs {
  beltOffsets: MutableRefObject<number[]>;
  beltMaterials: MutableRefObject<Array<MeshStandardMaterial | null>>;
  itemMeshRef: MutableRefObject<InstancedMesh | null>;
  coreMaterialRef: MutableRefObject<MeshStandardMaterial | null>;
  ringMaterialRef: MutableRefObject<MeshStandardMaterial | null>;
  baseMaterialRef: MutableRefObject<MeshStandardMaterial | null>;
  boostLightRef: MutableRefObject<PointLight | null>;
  ringGroupRef: MutableRefObject<Group | null>;
  highlightRingRef: MutableRefObject<Mesh | null>;
  highlightRingMaterialRef: MutableRefObject<MeshBasicMaterial | null>;
  itemStates: MutableRefObject<ItemState[]>;
  highlightStrengthRef: MutableRefObject<number>;
  highlightPulseRef: MutableRefObject<number>;
}

interface UseFactoryAnimationOptions {
  refs: FactoryAnimationRefs;
  performanceProfile: PerformanceProfile;
  beltTextures: Array<Texture | null>;
  isSourceHighlight: boolean;
  isDestinationHighlight: boolean;
}

export const useFactoryAnimation = ({
  refs,
  performanceProfile,
  beltTextures,
  isSourceHighlight,
  isDestinationHighlight,
}: UseFactoryAnimationOptions) => {
  const {
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
  } = refs;

  useFrame((_, delta) => {
    const { factory: worldFactory } = gameWorld;
    const activity = worldFactory.activity;
    const profileConfig = PROFILE_CONFIG[performanceProfile];

    const processing = activity.processing;
    const highlightTarget = isSourceHighlight ? 1 : isDestinationHighlight ? 0.75 : 0;
    highlightStrengthRef.current = MathUtils.damp(
      highlightStrengthRef.current,
      highlightTarget,
      6,
      delta,
    );
    const highlightAmount = highlightStrengthRef.current;
    const highlightColor = isSourceHighlight ? HIGHLIGHT_SOURCE : HIGHLIGHT_DEST;

    if (baseMaterialRef.current) {
      baseMaterialRef.current.emissive
        .copy(BASE_BASE_EMISSIVE)
        .lerp(highlightColor, highlightAmount * 0.35);
      baseMaterialRef.current.emissiveIntensity = 0.18 + processing * 0.35 + highlightAmount * 0.45;
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissive
        .copy(BASE_CORE_EMISSIVE)
        .lerp(highlightColor, highlightAmount * 0.6);
      coreMaterialRef.current.emissiveIntensity =
        0.5 + processing * 0.9 + activity.boost * 0.6 + highlightAmount * 0.9;
    }
    if (ringMaterialRef.current) {
      ringMaterialRef.current.color.copy(BASE_RING_COLOR).lerp(highlightColor, highlightAmount * 0.6);
      ringMaterialRef.current.emissive
        .copy(BASE_RING_EMISSIVE)
        .lerp(highlightColor, highlightAmount);
      ringMaterialRef.current.emissiveIntensity =
        0.75 + activity.boost * 1.4 + highlightAmount * 0.8;
    }
    beltMaterials.current.forEach((material) => {
      if (!material) return;
      material.emissive.copy(BASE_BELT_EMISSIVE).lerp(highlightColor, highlightAmount * 0.3);
      material.emissiveIntensity = 0.12 + processing * 0.5 + highlightAmount * 0.3;
    });
    if (boostLightRef.current) {
      const lightColor = highlightAmount > 0.02 ? highlightColor : BASE_LIGHT_COLOR;
      boostLightRef.current.color.copy(lightColor);
      boostLightRef.current.intensity = 0.6 + activity.boost * 1.6 + highlightAmount * 1.2;
    }
    if (highlightRingRef.current && highlightRingMaterialRef.current) {
      if (highlightAmount > 0.02) {
        highlightPulseRef.current += delta * 1.5;
        const pulse = 1 + Math.sin(highlightPulseRef.current * 2) * 0.08 * highlightAmount;
        const baseScale = 1.05 + highlightAmount * 0.35;
        highlightRingRef.current.visible = true;
        highlightRingRef.current.scale.setScalar(baseScale * pulse);
        highlightRingRef.current.rotation.z += delta * 0.6;
        highlightRingMaterialRef.current.opacity = 0.2 + highlightAmount * 0.45;
        highlightRingMaterialRef.current.color.copy(highlightColor);
      } else {
        highlightRingRef.current.visible = false;
        highlightRingMaterialRef.current.opacity = 0;
      }
    }

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
          // eslint-disable-next-line react-hooks/immutability
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
};
