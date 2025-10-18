import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { Vector3 } from 'three';
import { useStore } from '../state/store';
import type { BuildableFactory } from '../ecs/factories';
import { computeAutofitCamera, lerpCameraState, type AutofitConfig } from '../lib/camera';

const DEFAULT_CONFIG: AutofitConfig = {
  margin: 5,
  maxZoomOut: 0.5,
  easeTime: 0.5,
};

/**
 * Hook to manage camera autofit for factories.
 * Smoothly animates camera to fit all factories on screen.
 */
export const useFactoryAutofit = () => {
  const { camera } = useThree();
  const factories: BuildableFactory[] = useStore((state) => state.factories);
  const lerpStartTime = useRef<number | null>(null);
  const previousCameraState = useRef<{
    position: Vector3;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    if (!factories || factories.length === 0) {
      return;
    }

    const orthoCamera = camera as OrthographicCamera;
    const currentState = {
      position: orthoCamera.position.clone(),
      zoom: orthoCamera.zoom,
    };

    // Store initial state for lerp
    previousCameraState.current ??= currentState;

    // Compute target autofit state
    const positions = factories.map((f) => new Vector3(f.position.x, f.position.y, f.position.z));
    const targetState = computeAutofitCamera(positions, DEFAULT_CONFIG);

    if (!targetState) return;

    // Start lerp animation
    lerpStartTime.current = Date.now();

    const animate = () => {
      if (!lerpStartTime.current || !previousCameraState.current || !targetState) return;

      const elapsed = (Date.now() - lerpStartTime.current) / 1000;
      const progress = Math.min(1, elapsed / DEFAULT_CONFIG.easeTime);

      const newState = lerpCameraState(previousCameraState.current, targetState, progress);
      orthoCamera.position.copy(newState.position);
      orthoCamera.zoom = newState.zoom;
      orthoCamera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousCameraState.current = newState;
        lerpStartTime.current = null;
      }
    };

    animate();
  }, [factories, camera]);
};
