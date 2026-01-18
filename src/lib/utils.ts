import { Vector3 } from 'three';

/** Array representing a 3D vector [x, y, z]. */
export type VectorTuple = [number, number, number];

export const vector3ToTuple = (vector: Vector3): VectorTuple => [vector.x, vector.y, vector.z];

export const tupleToVector3 = (tuple: VectorTuple): Vector3 =>
  new Vector3(tuple[0], tuple[1], tuple[2]);

/**
 * Generate a unique ID using timestamp and random component.
 * Uses a 6-character random suffix for better collision resistance.
 * @param prefix Optional prefix for the ID (e.g., 'factory-', 'toast-')
 * @returns A unique ID string in format: prefix + timestamp-random
 */
export const generateUniqueId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8); // 6 characters
  return `${prefix}${timestamp}-${random}`;
};

export const coerceNumber = (value: unknown, fallback: number) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};
