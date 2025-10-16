import { describe, expect, it } from 'vitest';
import {
  costForLevel,
  computePrestigeBonus,
  computePrestigeGain,
  createStoreInstance,
  moduleDefinitions,
  parseSnapshot,
  saveVersion,
  serializeStore,
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

  it('updates settings with normalization and export/import roundtrips', () => {
    const store = createStoreInstance();
    const api = store.getState();
    api.updateSettings({ autosaveInterval: 33.7, notation: 'engineering', offlineCapHours: -4 });
    const afterUpdate = store.getState();
    expect(afterUpdate.settings.autosaveInterval).toBe(33);
    expect(afterUpdate.settings.notation).toBe('engineering');
    expect(afterUpdate.settings.offlineCapHours).toBe(0);

    const snapshot = serializeStore(store.getState());
    expect(snapshot.settings.autosaveInterval).toBe(33);
    expect(snapshot.save.version).toBe(saveVersion);

    const payload = JSON.stringify(snapshot);
    const parsed = parseSnapshot(payload);
    expect(parsed?.settings.notation).toBe('engineering');

    const fresh = createStoreInstance();
    const success = fresh.getState().importState(payload);
    expect(success).toBe(true);
    const imported = fresh.getState();
    expect(imported.settings.autosaveInterval).toBe(33);
    expect(imported.resources.ore).toBe(snapshot.resources.ore);
  });

  it('rejects invalid import payloads gracefully', () => {
    const store = createStoreInstance();
    const success = store.getState().importState('not-json');
    expect(success).toBe(false);
  });
});
