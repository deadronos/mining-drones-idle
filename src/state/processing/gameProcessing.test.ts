import { describe, expect, it } from 'vitest';
import { processFactories } from '@/state/processing/gameProcessing';
import { createStoreInstance } from '@/state/store';

describe('gameProcessing/processFactories', () => {
  it('factories consume local energy for idle drain (no proactive global pull)', () => {
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected factory');

    store.setState((current) => ({
      resources: { ...current.resources, energy: 100 },
      factories: current.factories.map((item, index) =>
        index === 0
          ? {
              ...item,
              energy: 50,
              idleEnergyPerSec: 1,
              upgrades: { ...item.upgrades, solar: 0 },
            }
          : item,
      ),
    }));

    const result = processFactories(store.getState(), 1);

    // Global energy should be unchanged (no proactive pull)
    expect(result.resources.energy).toBeCloseTo(100, 5);

    // Factory should have consumed idle drain from local energy (50 - 1 = 49)
    const updatedFactory = result.factories[0];
    if (!updatedFactory) throw new Error('expected factory in result');
    expect(updatedFactory.energy).toBeLessThan(50);
  });

  it('factories sit at zero when local energy is exhausted (no emergency pull)', () => {
    const store = createStoreInstance();

    store.setState((current) => ({
      resources: { ...current.resources, energy: 100 },
      factories: current.factories.map((item, index) =>
        index === 0
          ? {
              ...item,
              energy: 0.5,
              idleEnergyPerSec: 1,
              upgrades: { ...item.upgrades, solar: 0 },
            }
          : item,
      ),
    }));

    const result = processFactories(store.getState(), 1);

    // Global energy unchanged
    expect(result.resources.energy).toBeCloseTo(100, 5);

    // Factory should have gone to zero (0.5 - 1 = -0.5 clamped to 0)
    const updatedFactory = result.factories[0];
    if (!updatedFactory) throw new Error('expected factory in result');
    expect(updatedFactory.energy).toBeCloseTo(0, 5);
  });

  it('factories consume local energy for hauler maintenance', () => {
    const store = createStoreInstance();

    store.setState((current) => ({
      resources: { ...current.resources, energy: 100 },
      factories: current.factories.map((item, index) =>
        index === 0
          ? {
              ...item,
              energy: 50,
              haulersAssigned: 2,
              idleEnergyPerSec: 0,
              upgrades: { ...item.upgrades, solar: 0 },
            }
          : item,
      ),
    }));

    const result = processFactories(store.getState(), 1);

    // Global energy unchanged
    expect(result.resources.energy).toBeCloseTo(100, 5);

    // Factory should have consumed hauler maintenance (50 - 1 = 49)
    const updatedFactory = result.factories[0];
    if (!updatedFactory) throw new Error('expected factory in result');
    expect(updatedFactory.energy).toBeLessThan(50);
  });

  it('factories consume local energy for refining', () => {
    const store = createStoreInstance();
    const [factory] = store.getState().factories;
    if (!factory) throw new Error('expected factory');

    store.setState((current) => ({
      resources: { ...current.resources, energy: 100 },
      factories: current.factories.map((item, index) => {
        if (index !== 0) return item;
        const refine = {
          id: 'test-refine',
          oreType: 'ore',
          amount: 10,
          progress: 0,
          timeTotal: 10,
          energyRequired: 2,
          speedMultiplier: 1,
        };
        return {
          ...item,
          energy: 50,
          resources: { ...item.resources, ore: 20 },
          activeRefines: [refine],
          idleEnergyPerSec: 0,
          upgrades: { ...item.upgrades, solar: 0 },
        };
      }),
    }));

    const result = processFactories(store.getState(), 1);

    // Global energy unchanged (no pull)
    expect(result.resources.energy).toBeCloseTo(100, 5);

    // Factory should have consumed energy for refining (50 - 5 = 45)
    const updatedFactory = result.factories[0];
    if (!updatedFactory) throw new Error('expected factory in result');
    expect(updatedFactory.energy).toBeLessThan(50);
  });

  it('does not pull from global when factory has energy', () => {
    const store = createStoreInstance();

    store.setState((current) => ({
      resources: { ...current.resources, energy: 100 },
      factories: current.factories.map((item, index) =>
        index === 0
          ? {
              ...item,
              energy: 40,
              energyCapacity: 80,
              upgrades: { ...item.upgrades, solar: 0 },
            }
          : item,
      ),
    }));

    const result = processFactories(store.getState(), 0.1);

    // Global energy should remain unchanged (no upfront pull)
    expect(result.resources.energy).toBeCloseTo(100, 5);
  });

  it('returns factories with applied idle drain and hauler costs', () => {
    const store = createStoreInstance();

    store.setState((current) => ({
      resources: { ...current.resources, energy: 50 },
      factories: current.factories.map((item, index) =>
        index === 0
          ? {
              ...item,
              energy: 30,
              idleEnergyPerSec: 1,
              haulersAssigned: 1,
              upgrades: { ...item.upgrades, solar: 0 },
            }
          : item,
      ),
    }));

    const result = processFactories(store.getState(), 1);

    // Global energy stays at 50
    expect(result.resources.energy).toBeCloseTo(50, 5);

    // Factory energy should have both idle (1) and hauler (0.5) drain
    const updatedFactory = result.factories[0];
    if (!updatedFactory) throw new Error('expected factory in result');
    // 30 - 1 (idle) - 0.5 (hauler) = 28.5
    expect(updatedFactory.energy).toBeLessThan(30);
  });
});
