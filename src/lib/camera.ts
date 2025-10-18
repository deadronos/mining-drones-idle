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
 * Compute camera position to fit all factories with margin.
 * Returns { position, zoom } target for camera.
 * 
 * For perspective cameras, we calculate the distance needed to fit all
 * factories in the viewport, considering FOV and aspect ratio.
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

  // Calculate the required distance to fit the bounding sphere
  const boundingSphereRadius = bb.radius + config.margin;
  
  // Convert vertical FOV to radians
  const vFOV = (fov * Math.PI) / 180;
  
  // Calculate distance needed to fit sphere vertically
  const distanceVertical = boundingSphereRadius / Math.tan(vFOV / 2);
  
  // Calculate horizontal FOV based on aspect ratio
  const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);
  
  // Calculate distance needed to fit sphere horizontally
  const distanceHorizontal = boundingSphereRadius / Math.tan(hFOV / 2);
  
  // Use the larger distance to ensure everything fits
  const distance = Math.max(distanceVertical, distanceHorizontal);
  
  // Camera position: center of bounding box + offset based on viewing angle
  // Original camera setup: position: [0, 9, 22] gives an elevation angle
  // We maintain this angle but scale the distance
  const position = bb.center.clone();
  
  // Original camera ratios from [0, 9, 22]
  const originalDistance = Math.sqrt(0*0 + 9*9 + 22*22); // ≈ 23.77
  const yRatio = 9 / originalDistance; // ≈ 0.378
  const zRatio = 22 / originalDistance; // ≈ 0.925
  
  // Apply the calculated distance while maintaining the viewing angle
  position.y += distance * yRatio;
  position.z += distance * zRatio;

  // Return distance as inverse 'zoom' for compatibility (not actually used for perspective camera)
  return { position, zoom: 1 / distance };
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
