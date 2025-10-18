import type { Vector3 } from 'three';

/**
 * Configuration for camera autofit behavior.
 */
export interface AutofitConfig {
  margin: number; // margin around factories in world units
  maxZoom: number; // maximum allowed zoom-in value
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
 * 
 * For perspective cameras, zoom is actually the distance from the target.
 * We calculate the distance needed to fit the bounding sphere in view.
 */
export const computeAutofitCamera = (
  positions: Vector3[],
  config: AutofitConfig,
  fov = 52, // field of view in degrees (default from App.tsx)
  aspect = 1.5, // aspect ratio (width/height), default approximation
): { position: Vector3; zoom: number } | null => {
  if (positions.length === 0) return null;

  const bb = computeBoundingBox(positions);
  if (!bb) return null;

  // For perspective camera, we need to calculate the distance from center
  // to fit the bounding sphere (radius + margin) in the viewport
  const boundingSphereRadius = bb.radius + config.margin;
  
  // Convert FOV to radians and calculate vertical FOV
  const vFOV = (fov * Math.PI) / 180;
  
  // Account for aspect ratio - use the smaller FOV dimension
  const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);
  const effectiveFOV = Math.min(vFOV, hFOV);
  
  // Calculate distance needed to fit bounding sphere
  // distance = radius / tan(fov/2)
  const distance = boundingSphereRadius / Math.tan(effectiveFOV / 2);
  
  // Apply maxZoom constraint (for perspective, smaller zoom = farther away)
  // Minimum distance based on maxZoom (interpret maxZoom as minimum allowed distance multiplier)
  const minDistance = 10; // minimum distance to prevent getting too close
  const finalDistance = Math.max(distance, minDistance);
  
  // Camera position: center of bounding box + offset in viewing direction
  // Assuming camera looks down at an angle (like original setup)
  const position = bb.center.clone();
  
  // Position camera at calculated distance, maintaining the viewing angle
  // Original camera: position: [0, 9, 22] - that's roughly 40 degrees elevation
  const elevationRatio = 9 / 22; // y/z ratio from original camera
  const horizontalRatio = 0; // x/z ratio (camera centered)
  
  position.z += finalDistance;
  position.y += finalDistance * elevationRatio;
  position.x += finalDistance * horizontalRatio;

  // Return distance as 'zoom' for compatibility with existing interface
  // Lower zoom value = camera is farther away
  return { position, zoom: 1 / finalDistance };
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
