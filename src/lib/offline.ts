import type { StoreApi } from 'zustand';
import type { StoreState } from '@/state/store';

const HOURS_TO_SECONDS = 3600;

export const clampOfflineSeconds = (seconds: number, capHours = 8) =>
  Math.max(0, Math.min(seconds, capHours * HOURS_TO_SECONDS));

export const computeOfflineSeconds = (lastSave: number, now: number, capHours = 8) => {
  const ms = Math.max(0, now - lastSave);
  return clampOfflineSeconds(ms / 1000, capHours);
};

export interface OfflineSimulationOptions {
  step?: number;
  capHours?: number;
}

export const simulateOfflineProgress = (
  store: StoreApi<StoreState>,
  seconds: number,
  options?: OfflineSimulationOptions,
) => {
  const step = options?.step && options.step > 0 ? options.step : 0.1;
  const normalizedSeconds = Math.max(0, seconds);
  const clampedSeconds =
    options?.capHours === undefined
      ? normalizedSeconds
      : clampOfflineSeconds(normalizedSeconds, options.capHours);
  if (clampedSeconds <= 0) return;
  const iterations = Math.floor(clampedSeconds / step);
  const remainder = clampedSeconds - iterations * step;
  const runStep = (delta: number) => {
    const api = store.getState();
    if (typeof api.processRefinery === 'function') {
      api.processRefinery(delta);
    } else {
      api.tick(delta);
    }
  };
  for (let i = 0; i < iterations; i += 1) {
    runStep(step);
  }
  if (remainder > 0) {
    runStep(remainder);
  }
};
