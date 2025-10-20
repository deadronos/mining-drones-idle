import { Vector3 } from 'three';
import type { TravelData } from '@/ecs/world';
import type { TravelSnapshot, VectorTuple } from '@/state/store';

export const vectorToTuple = (vector: Vector3): VectorTuple => [vector.x, vector.y, vector.z];

export const tupleToVector = (tuple: VectorTuple): Vector3 =>
  new Vector3(tuple[0], tuple[1], tuple[2]);

export const travelToSnapshot = (travel: TravelData): TravelSnapshot => ({
  from: vectorToTuple(travel.from),
  to: vectorToTuple(travel.to),
  elapsed: travel.elapsed,
  duration: travel.duration,
  control: travel.control ? vectorToTuple(travel.control) : undefined,
});

export const isFiniteVector = (vector: Vector3) =>
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

export const isFiniteTravel = (travel: TravelData) =>
  Number.isFinite(travel.elapsed) &&
  Number.isFinite(travel.duration) &&
  isFiniteVector(travel.from) &&
  isFiniteVector(travel.to) &&
  (travel.control ? isFiniteVector(travel.control) : true);

export const snapshotToTravel = (snapshot: TravelSnapshot): TravelData => ({
  from: tupleToVector(snapshot.from),
  to: tupleToVector(snapshot.to),
  elapsed: snapshot.elapsed,
  duration: snapshot.duration,
  control: snapshot.control ? tupleToVector(snapshot.control) : undefined,
});

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
