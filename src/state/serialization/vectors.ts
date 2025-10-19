import type { VectorTuple, TravelSnapshot } from '../types';
import { coerceNumber } from '../utils';

export const normalizeVectorTuple = (value: unknown): VectorTuple | null => {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const parsed = value.map((component) => Number(component));
  if (parsed.some((component) => !Number.isFinite(component))) {
    return null;
  }
  return [parsed[0], parsed[1], parsed[2]] as VectorTuple;
};

export const cloneVectorTuple = (value: VectorTuple): VectorTuple => [
  value[0],
  value[1],
  value[2],
];

export const normalizeTravelSnapshot = (value: unknown): TravelSnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<TravelSnapshot> & {
    from?: unknown;
    to?: unknown;
    control?: unknown;
    elapsed?: unknown;
    duration?: unknown;
  };
  const from = normalizeVectorTuple(raw.from);
  const to = normalizeVectorTuple(raw.to);
  if (!from || !to) {
    return null;
  }
  const duration = Math.max(0, coerceNumber(raw.duration, 0));
  const elapsed = Math.max(0, Math.min(duration, coerceNumber(raw.elapsed, 0)));
  const control = normalizeVectorTuple(raw.control ?? null) ?? undefined;
  return {
    from,
    to,
    elapsed,
    duration,
    control,
  };
};

export const cloneTravelSnapshot = (travel: TravelSnapshot): TravelSnapshot => ({
  from: cloneVectorTuple(travel.from),
  to: cloneVectorTuple(travel.to),
  elapsed: travel.elapsed,
  duration: travel.duration,
  control: travel.control ? cloneVectorTuple(travel.control) : undefined,
});
