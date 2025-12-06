import { Vector3 } from 'three';
import type { TravelData } from '@/ecs/world';
import type { TravelSnapshot, VectorTuple } from '@/state/store';

/**
 * Converts a Three.js Vector3 to a tuple [x, y, z].
 *
 * @param vector - The Vector3 object.
 * @returns A tuple containing the x, y, and z components.
 */
export const vectorToTuple = (vector: Vector3): VectorTuple => [vector.x, vector.y, vector.z];

/**
 * Converts a tuple [x, y, z] to a Three.js Vector3.
 *
 * @param tuple - The tuple containing x, y, and z components.
 * @returns A new Vector3 object.
 */
export const tupleToVector = (tuple: VectorTuple): Vector3 =>
  new Vector3(tuple[0], tuple[1], tuple[2]);

/**
 * Converts a TravelData object (runtime) to a TravelSnapshot (serializable).
 *
 * @param travel - The active travel data.
 * @returns A snapshot of the travel state.
 */
export const travelToSnapshot = (travel: TravelData): TravelSnapshot => ({
  from: vectorToTuple(travel.from),
  to: vectorToTuple(travel.to),
  elapsed: travel.elapsed,
  duration: travel.duration,
  control: travel.control ? vectorToTuple(travel.control) : undefined,
});

/**
 * Checks if a Vector3 contains only finite numbers.
 *
 * @param vector - The vector to check.
 * @returns True if x, y, and z are finite.
 */
export const isFiniteVector = (vector: Vector3) =>
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

/**
 * Checks if a TravelData object contains valid finite values.
 *
 * @param travel - The travel data to validate.
 * @returns True if all travel parameters are finite.
 */
export const isFiniteTravel = (travel: TravelData) =>
  Number.isFinite(travel.elapsed) &&
  Number.isFinite(travel.duration) &&
  isFiniteVector(travel.from) &&
  isFiniteVector(travel.to) &&
  (travel.control ? isFiniteVector(travel.control) : true);

/**
 * Restores TravelData from a snapshot.
 *
 * @param snapshot - The serialized travel snapshot.
 * @returns The restored runtime TravelData.
 */
export const snapshotToTravel = (snapshot: TravelSnapshot): TravelData => ({
  from: tupleToVector(snapshot.from),
  to: tupleToVector(snapshot.to),
  elapsed: snapshot.elapsed,
  duration: snapshot.duration,
  control: snapshot.control ? tupleToVector(snapshot.control) : undefined,
});

/**
 * Computes the current position of an entity along its travel path.
 * Supports linear interpolation and quadratic Bézier curves (if a control point is present).
 *
 * @param travel - The travel data describing the path and progress.
 * @param out - Optional vector to store the result in (avoids allocation).
 * @returns The calculated position vector.
 */
export const computeTravelPosition = (
  travel: TravelData,
  out: Vector3 = new Vector3(),
): Vector3 => {
  const duration = travel.duration > 0 ? travel.duration : 1;
  const t = Math.max(0, Math.min(1, travel.elapsed / duration));
  if (travel.control) {
    const oneMinusT = 1 - t;
    const a = oneMinusT * oneMinusT;
    const b = 2 * oneMinusT * t;
    const c = t * t;
    return out
      .copy(travel.from)
      .multiplyScalar(a)
      .addScaledVector(travel.control, b)
      .addScaledVector(travel.to, c);
  }
  return out.lerpVectors(travel.from, travel.to, t);
};
