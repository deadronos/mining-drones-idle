import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { useStore } from '../state/store';
import type { BuildableFactory } from '../ecs/factories';
import { WAREHOUSE_POSITION } from '../ecs/world';
import {
  computeAutofitCamera,
  lerpCameraState,
  DEFAULT_AUTOFIT_CONFIG,
  type CameraState,
} from '../lib/camera';

/**
 * Hook to manage camera autofit for factories and warehouse.
 * Smoothly animates camera to fit all factories and warehouse on screen with relative centering.
 * Works with perspective cameras.
 */
export const useFactoryAutofit = () => {
  const { camera, size } = useThree();
  const factories: BuildableFactory[] = useStore((state) => state.factories);
  const sequence = useStore((state) => state.factoryAutofitSequence);
  const lerpStartTime = useRef<number | null>(null);
  const previousCameraState = useRef<CameraState | null>(null);
  const lastSequence = useRef<number>(sequence);

  useEffect(() => {
    if (!factories || factories.length === 0) {
      lastSequence.current = sequence;
      return;
    }

    if (sequence === lastSequence.current) {
      return;
    }
    lastSequence.current = sequence;

    const perspCamera = camera as PerspectiveCamera;
    const currentState: CameraState = {
      position: perspCamera.position.clone(),
    };

    // Store initial state for lerp
    previousCameraState.current ??= currentState;

    // Compute target autofit state with viewport aspect ratio and FOV
    // Include warehouse and all factories in the autofit
    const positions = [
      WAREHOUSE_POSITION,
      ...factories.map((f) => new Vector3(f.position.x, f.position.y, f.position.z)),
    ];
    const aspect = size.width / size.height;
    const fov = 'fov' in perspCamera ? perspCamera.fov : 52;
    const targetState = computeAutofitCamera(positions, DEFAULT_AUTOFIT_CONFIG, fov, aspect);

    if (!targetState) return;

    // Start lerp animation
    lerpStartTime.current = Date.now();

    const animate = () => {
      if (!lerpStartTime.current || !previousCameraState.current || !targetState) return;

      const elapsed = (Date.now() - lerpStartTime.current) / 1000;
      const progress = Math.min(1, elapsed / DEFAULT_AUTOFIT_CONFIG.easeTime);

      const newState = lerpCameraState(previousCameraState.current, targetState, progress);
      perspCamera.position.copy(newState.position);
      // Perspective cameras rely on position updates only; distance is encoded in placement
      perspCamera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousCameraState.current = newState;
        lerpStartTime.current = null;
      }
    };

    animate();
  }, [factories, camera, size, sequence]);
};
