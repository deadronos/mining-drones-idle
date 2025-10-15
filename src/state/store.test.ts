import { describe, expect, it } from 'vitest';
import {
  costForLevel,
  computePrestigeBonus,
  computePrestigeGain,
  createStoreInstance,
  moduleDefinitions,
} from '@/state/store';

describe('state/store', () => {
  it('converts ore into bars using refinery and prestige multipliers', () => {
    const store = createStoreInstance();
    const base = store.getState();
    store.setState({
      resources: { ...base.resources, ore: 100, bars: 0 },
      modules: { ...base.modules, refinery: 2 },
      prestige: { cores: 4 },
    });
    store.getState().tick(1);
    const result = store.getState();
    const refineMult = Math.pow(1.1, 2);
    const prestigeMult = computePrestigeBonus(4);
    const expectedBars = (Math.min(100, 10) / 10) * refineMult * prestigeMult;
    expect(result.resources.bars).toBeCloseTo(expectedBars, 5);
    expect(result.resources.ore).toBeCloseTo(90);
  });

  it('grows upgrade cost exponentially', () => {
    const droneBase = moduleDefinitions.droneBay.baseCost;
    expect(costForLevel(droneBase, 0)).toBe(droneBase);
    expect(costForLevel(droneBase, 2)).toBeGreaterThan(costForLevel(droneBase, 1));
  });

  it('previews and grants prestige cores based on bars', () => {
    const store = createStoreInstance();
    const base = store.getState();
    const bars = 5_500;
    const preview = computePrestigeGain(bars);
    store.setState({
      resources: { ...base.resources, bars },
      prestige: { cores: 3 },
    });
    expect(store.getState().preview()).toBe(preview);
    store.getState().doPrestige();
    const after = store.getState();
    expect(after.prestige.cores).toBe(3 + preview);
    expect(after.resources.bars).toBe(0);
    expect(after.modules.droneBay).toBe(1);
  });
});
