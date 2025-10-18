import { describe, it, expect, beforeEach } from 'vitest';
import { createStoreInstance } from '@/state/store';
import { FACTORY_CONFIG, computeFactoryCost } from '@/ecs/factories';

describe('store factory integration', () => {
  let store = createStoreInstance();

  beforeEach(() => {
    store = createStoreInstance();
  });

  it('deducts resources and adds factory when purchasing', () => {
    const state = store.getState();
    store.setState({
      resources: {
        ...state.resources,
        metals: 1000,
        crystals: 1000,
      },
    });
    const initialCount = store.getState().factories.length;
    const initialMetals = store.getState().resources.metals;
    const initialCrystals = store.getState().resources.crystals;

    const result = store.getState().purchaseFactory();

    expect(result).toBe(true);
    const updated = store.getState();
    expect(updated.factories.length).toBe(initialCount + 1);
    const cost = computeFactoryCost(Math.max(0, initialCount - 1));
    expect(updated.resources.metals).toBeCloseTo(initialMetals - cost.metals, 5);
    expect(updated.resources.crystals).toBeCloseTo(initialCrystals - cost.crystals, 5);
  });

  it('reserves docking slots when docking a drone', () => {
    const state = store.getState();
    const factoryId = state.factories[0].id;
    const success = state.dockDroneAtFactory(factoryId, 'drone-test');
    expect(success).toBe(true);
    const afterDock = store.getState().factories[0];
    expect(afterDock.queuedDrones).toContain('drone-test');
    // docking the same drone again should not duplicate entries
    const repeat = store.getState().dockDroneAtFactory(factoryId, 'drone-test');
    expect(repeat).toBe(true);
    expect(
      store.getState().factories[0].queuedDrones.filter((id) => id === 'drone-test'),
    ).toHaveLength(1);
  });

  it('processes factory storage into ore and drains energy', () => {
    const state = store.getState();
    const factoryId = state.factories[0].id;
    store.getState().transferOreToFactory(factoryId, 60);
    const energyBefore = store.getState().resources.energy;
    store.getState().processFactories(FACTORY_CONFIG.refineTime);
    const resources = store.getState().resources;
    expect(resources.ore).toBeCloseTo(60, 5);
    expect(resources.energy).toBeCloseTo(
      energyBefore -
        (FACTORY_CONFIG.idleEnergyPerSec + FACTORY_CONFIG.energyPerRefine) *
          FACTORY_CONFIG.refineTime,
      5,
    );
  });
});
