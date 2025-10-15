import type { StoreApi } from 'zustand';
import type { StoreState } from '@/state/store';

const HOURS_TO_SECONDS = 3600;

export const clampOfflineSeconds = (seconds: number, capHours = 8) =>
  Math.max(0, Math.min(seconds, capHours * HOURS_TO_SECONDS));

export const computeOfflineSeconds = (lastSave: number, now: number, capHours = 8) => {
  const ms = Math.max(0, now - lastSave);
  return clampOfflineSeconds(ms / 1000, capHours);
};

export const simulateOfflineProgress = (store: StoreApi<StoreState>, seconds: number) => {
  const clamped = clampOfflineSeconds(seconds);
  if (clamped <= 0) return;
  const step = 0.1;
  const iterations = Math.floor(clamped / step);
  const remainder = clamped - iterations * step;
  const api = store.getState();
  for (let i = 0; i < iterations; i += 1) {
    api.tick(step);
  }
  if (remainder > 0) {
    api.tick(remainder);
  }
};
