import type { StoreApi } from 'zustand';
import type { StoreState } from '@/state/store';
import { getSinkBonuses } from '@/state/sinks';

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

export interface OfflineSimulationReport {
  simulatedSeconds: number;
  stepSize: number;
  steps: number;
  progressedSteps: number;
  oreConsumed: number;
  barsProduced: number;
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
  const report: OfflineSimulationReport = {
    simulatedSeconds: clampedSeconds,
    stepSize: step,
    steps: 0,
    progressedSteps: 0,
    oreConsumed: 0,
    barsProduced: 0,
  };
  if (clampedSeconds <= 0) {
    return report;
  }

  const runStep = (delta: number) => {
    if (delta <= 0) return;
    report.steps += 1;
    const stats = store.getState().processRefinery(delta);
    if (stats.oreConsumed <= 0 && stats.barsProduced <= 0) {
      return;
    }
    report.progressedSteps += 1;
    report.oreConsumed += stats.oreConsumed;
    report.barsProduced += stats.barsProduced;
    const offlineMultiplier = getSinkBonuses(store.getState()).offlineProgressMultiplier;
    if (offlineMultiplier > 1 && stats.barsProduced > 0) {
      const extraBars = stats.barsProduced * (offlineMultiplier - 1);
      if (extraBars > 0) {
        store.getState().addResources({ bars: extraBars });
        report.barsProduced += extraBars;
      }
    }
  };

  const iterations = Math.floor(clampedSeconds / step);
  for (let i = 0; i < iterations; i += 1) {
    runStep(step);
  }
  const remainder = clampedSeconds - iterations * step;
  if (remainder > 0) {
    runStep(remainder);
  }

  return report;
};
