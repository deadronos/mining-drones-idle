const UINT32_MAX = 0xffffffff;

export interface RandomSource {
  next(): number;
}

export interface RandomGenerator extends RandomSource {
  readonly seed: number;
  nextInt(min: number, max: number): number;
  nextRange(min: number, max: number): number;
}

const normalizeSeed = (seed: number) => {
  if (!Number.isFinite(seed)) {
    return 1;
  }
  const normalized = seed >>> 0;
  return normalized === 0 ? 1 : normalized;
};

export const createRng = (seed: number): RandomGenerator => {
  let state = normalizeSeed(seed);

  const next = () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / (UINT32_MAX + 1);
  };

  const nextInRange = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('min and max must be finite numbers');
    }
    if (max < min) {
      [min, max] = [max, min];
    }
    return min + next() * (max - min);
  };

  return {
    get seed() {
      return state;
    },
    next,
    nextRange: nextInRange,
    nextInt: (min: number, max: number) => {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('min and max must be finite numbers');
      }
      const floorMin = Math.ceil(Math.min(min, max));
      const floorMax = Math.floor(Math.max(min, max));
      if (floorMax < floorMin) {
        return floorMin;
      }
      return floorMin + Math.floor((floorMax - floorMin + 1) * next());
    },
  };
};
