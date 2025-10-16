import { describe, expect, it } from 'vitest';
import { createStoreInstance } from '@/state/store';
import { clampOfflineSeconds, simulateOfflineProgress } from '@/lib/offline';

const cloneStore = () => {
  const store = createStoreInstance();
  const state = store.getState();
  store.setState({
    resources: { ...state.resources, ore: 200, bars: 0 },
    modules: { ...state.modules, refinery: 2 },
    prestige: { ...state.prestige, cores: 4 },
  });
  return store;
};

describe('lib/offline', () => {
  it('matches manual refinement loop', () => {
    const offlineStore = cloneStore();
    const manualStore = cloneStore();
    simulateOfflineProgress(offlineStore, 6, { step: 0.2 });
    const manualStep = 0.2;
    const iterations = Math.floor(6 / manualStep);
    const remainder = 6 - iterations * manualStep;
    for (let i = 0; i < iterations; i += 1) {
      manualStore.getState().processRefinery(manualStep);
    }
    if (remainder > 0) {
      manualStore.getState().processRefinery(remainder);
    }
    const offlineResources = offlineStore.getState().resources;
    const manualResources = manualStore.getState().resources;
    expect(offlineResources.bars).toBeCloseTo(manualResources.bars, 5);
    expect(offlineResources.ore).toBeCloseTo(manualResources.ore, 5);
  });

  it('honors provided offline cap hours', () => {
    const baseStore = createStoreInstance();
    const state = baseStore.getState();
    const update = {
      resources: { ...state.resources, ore: 10_000, bars: 0 },
      modules: { ...state.modules, refinery: 3 },
      prestige: { ...state.prestige, cores: 6 },
    };
    baseStore.setState(update);
    const manualStore = createStoreInstance();
    manualStore.setState(update);

    const seconds = 10 * 3600; // 10 hours
    const capHours = 12;
    const step = 600; // 10 minutes per step
    simulateOfflineProgress(baseStore, seconds, { step, capHours });

    const clamped = clampOfflineSeconds(seconds, capHours);
    const iterations = Math.floor(clamped / step);
    const remainder = clamped - iterations * step;
    for (let i = 0; i < iterations; i += 1) {
      manualStore.getState().processRefinery(step);
    }
    if (remainder > 0) {
      manualStore.getState().processRefinery(remainder);
    }

    const offline = baseStore.getState().resources;
    const manual = manualStore.getState().resources;
    expect(offline.bars).toBeCloseTo(manual.bars, 5);
    expect(offline.ore).toBeCloseTo(manual.ore, 5);
  });
});
