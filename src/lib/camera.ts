import type { Vector3 } from 'three';

/**
 * Configuration for camera autofit behavior.
 */
export interface AutofitConfig {
  margin: number; // margin around factories in world units
  maxZoomOut: number; // maximum allowed zoom-out factor
  easeTime: number; // smoothing duration in seconds
}

/**
 * Compute bounding box for a set of positions.
 * Returns { min, max, center, radius }.
 */
export const computeBoundingBox = (
  positions: Vector3[],
): {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  radius: number;
} | null => {
  if (positions.length === 0) return null;

  const min = positions[0].clone();
  const max = positions[0].clone();

  for (let i = 1; i < positions.length; i += 1) {
    const pos = positions[i];
    if (pos.x < min.x) min.x = pos.x;
    if (pos.x > max.x) max.x = pos.x;
    if (pos.y < min.y) min.y = pos.y;
    if (pos.y > max.y) max.y = pos.y;
    if (pos.z < min.z) min.z = pos.z;
    if (pos.z > max.z) max.z = pos.z;
  }

  const center = min.clone().add(max).multiplyScalar(0.5);
  const extents = max.clone().sub(min).multiplyScalar(0.5);
  const radius = extents.length();

  return { min, max, center, radius };
};

/**
 * Compute camera position and zoom to fit all factories with margin.
 * Returns { position, zoom } target for camera.
 */
export const computeAutofitCamera = (
  positions: Vector3[],
  config: AutofitConfig,
): { position: Vector3; zoom: number } | null => {
  if (positions.length === 0) return null;

  const bb = computeBoundingBox(positions);
  if (!bb) return null;

  // Compute required zoom based on radius + margin
  const requiredRadius = bb.radius + config.margin;
  // Assuming orthogonal camera with zoom: visible radius = 10 / zoom
  // zoom = 10 / requiredRadius, but cap to maxZoomOut
  const baseZoom = Math.max(1, 10 / requiredRadius);
  const zoom = Math.min(baseZoom, config.maxZoomOut);

  // Camera position: center of bounding box, slightly elevated
  const position = bb.center.clone();
  position.z = position.z + 5; // Elevated for isometric view

  return { position, zoom };
};

/**
 * Lerp between two camera states with easing.
 */
export const lerpCameraState = (
  from: { position: Vector3; zoom: number },
  to: { position: Vector3; zoom: number },
  t: number,
): { position: Vector3; zoom: number } => ({
  position: from.position.clone().lerp(to.position, t),
  zoom: from.zoom + (to.zoom - from.zoom) * t,
});
