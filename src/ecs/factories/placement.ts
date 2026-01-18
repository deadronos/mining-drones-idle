import { Vector3 } from 'three';
import type { BuildableFactory } from './models';
import { FACTORY_MIN_DISTANCE, FACTORY_MAX_DISTANCE, FACTORY_PLACEMENT_ATTEMPTS } from './config';

export const computeFactoryPlacement = (factories: BuildableFactory[]): Vector3 => {
  if (factories.length === 0) {
    return new Vector3(0, 0, 0);
  }

  const centroid = factories
    .reduce((acc, factory) => acc.add(factory.position), new Vector3())
    .divideScalar(factories.length);

  for (let attempt = 0; attempt < FACTORY_PLACEMENT_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      FACTORY_MIN_DISTANCE + Math.random() * (FACTORY_MAX_DISTANCE - FACTORY_MIN_DISTANCE);

    const candidate = new Vector3(
      centroid.x + Math.cos(angle) * distance,
      centroid.y,
      centroid.z + Math.sin(angle) * distance,
    );

    const distances = factories
      .map((factory) => candidate.distanceTo(factory.position))
      .sort((a, b) => a - b);

    const nearest = distances[0] ?? Number.POSITIVE_INFINITY;
    const secondNearest = distances[1] ?? nearest;

    if (nearest < FACTORY_MIN_DISTANCE) {
      continue;
    }
    if (nearest > FACTORY_MAX_DISTANCE) {
      continue;
    }
    if (factories.length > 1 && secondNearest > FACTORY_MAX_DISTANCE) {
      continue;
    }

    return candidate;
  }

  const index = factories.length;
  const ring = Math.floor(index / 6);
  const angle = (index % 6) * (Math.PI / 3);
  const radius = Math.min(
    FACTORY_MAX_DISTANCE,
    FACTORY_MIN_DISTANCE + ring * ((FACTORY_MAX_DISTANCE - FACTORY_MIN_DISTANCE) * 0.5),
  );

  return new Vector3(
    centroid.x + Math.cos(angle) * radius,
    centroid.y,
    centroid.z + Math.sin(angle) * radius,
  );
};
