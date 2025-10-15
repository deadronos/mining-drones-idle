export interface TimeSystem {
  readonly step: number;
  update(dt: number, fixed: (step: number) => void): void;
  reset(): void;
}

export const createTimeSystem = (step = 0.1): TimeSystem => {
  let accumulator = 0;
  const clamp = step * 10;
  return {
    step,
    update: (dt, fixed) => {
      if (!Number.isFinite(dt) || dt <= 0) return;
      accumulator = Math.min(accumulator + dt, clamp);
      while (accumulator >= step) {
        fixed(step);
        accumulator -= step;
      }
    },
    reset: () => {
      accumulator = 0;
    },
  };
};
