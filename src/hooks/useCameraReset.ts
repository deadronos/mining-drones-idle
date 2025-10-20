import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { useStore } from '../state/store';

const INITIAL_CAMERA_POSITION = new Vector3(0, 9, 22);
const ANIMATION_DURATION = 0.5; // seconds

/**
 * Hook to manage camera reset to initial position.
 * Listens to reset sequence and animates camera back to start position.
 */
export const useCameraReset = () => {
  const { camera } = useThree();
  const resetSequence = useStore((state) => state.cameraResetSequence);
  const lastResetSequence = useRef<number>(resetSequence);
  const lerpStartTime = useRef<number | null>(null);
  const initialPosition = useRef<Vector3>(INITIAL_CAMERA_POSITION.clone());
  const previousPosition = useRef<Vector3 | null>(null);

  useEffect(() => {
    if (resetSequence === lastResetSequence.current) {
      return;
    }
    lastResetSequence.current = resetSequence;

    const perspCamera = camera as PerspectiveCamera;
    previousPosition.current = perspCamera.position.clone();

    // Start lerp animation
    lerpStartTime.current = Date.now();

    const animate = () => {
      if (!lerpStartTime.current || !previousPosition.current) return;

      const elapsed = (Date.now() - lerpStartTime.current) / 1000;
      const progress = Math.min(1, elapsed / ANIMATION_DURATION);

      // Ease-in-out interpolation using quadratic easing.
      // Implements the "easeInOutQuad" curve:
      //   For progress < 0.5: t = 2 * progress^2 (accelerating)
      //   For progress >= 0.5: t = -1 + (4 - 2 * progress) * progress (decelerating)
      // Reference: https://easings.net/#easeInOutQuad
      const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      const newPosition = previousPosition.current.clone().lerp(initialPosition.current, t);

      perspCamera.position.copy(newPosition);
      perspCamera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        lerpStartTime.current = null;
      }
    };

    animate();
  }, [camera, resetSequence]);
};
