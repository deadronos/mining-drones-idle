import type { StoreApi } from 'zustand';
import { computeRefineryProduction } from '@/state/store';
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
  let remainder = clampedSeconds - iterations * step;
  const baseState = store.getState();
  const snapshot: Pick<StoreState, 'resources' | 'modules' | 'prestige'> = {
    resources: { ...baseState.resources },
    modules: baseState.modules,
    prestige: baseState.prestige,
  };

  const applyStep = (delta: number) => {
    const stats = computeRefineryProduction(snapshot, delta);
    if (stats.oreConsumed <= 0 && stats.barsProduced <= 0) {
      return false;
    }
    snapshot.resources = {
      ...snapshot.resources,
      ore: Math.max(0, snapshot.resources.ore - stats.oreConsumed),
      bars: snapshot.resources.bars + stats.barsProduced,
    };
    return true;
  };

  let progressed = false;
  for (let i = 0; i < iterations; i += 1) {
    if (!applyStep(step)) {
      remainder = 0;
      break;
    }
    progressed = true;
  }
  if (remainder > 0 && applyStep(remainder)) {
    progressed = true;
  }

  if (!progressed) return;

  store.setState((state) => ({
    resources: {
      ...state.resources,
      ore: snapshot.resources.ore,
      bars: snapshot.resources.bars,
    },
  }));
};
