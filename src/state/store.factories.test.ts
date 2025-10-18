import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FACTORY_MAX_DISTANCE, FACTORY_MIN_DISTANCE, createStoreInstance } from '@/state/store';
import { FACTORY_CONFIG, computeFactoryCost } from '@/ecs/factories';

describe('store factory integration', () => {
  let store = createStoreInstance();

  beforeEach(() => {
    store = createStoreInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('triggers an autofit sequence when a factory is purchased', () => {
    const state = store.getState();
    store.setState({
      resources: {
        ...state.resources,
        metals: 1_000,
        crystals: 1_000,
      },
    });

    expect(store.getState().factoryAutofitSequence).toBe(0);
    store.getState().purchaseFactory();
    expect(store.getState().factoryAutofitSequence).toBe(1);
  });

  it('reserves docking slots when docking a drone', () => {
    const state = store.getState();
    const factoryId = state.factories[0].id;
    const success = state.dockDroneAtFactory(factoryId, 'drone-test');
    expect(success).toBe('docking');
    const afterDock = store.getState().factories[0];
    expect(afterDock.queuedDrones).toContain('drone-test');
    // docking the same drone again should not duplicate entries
    const repeat = store.getState().dockDroneAtFactory(factoryId, 'drone-test');
    expect(repeat).toBe('docking');
    expect(
      store.getState().factories[0].queuedDrones.filter((id) => id === 'drone-test'),
    ).toHaveLength(1);
  });

  it('queues drones when docking capacity is saturated', () => {
    const factoryId = store.getState().factories[0].id;
    store.setState((state) => ({
      factories: state.factories.map((factory, idx) =>
        idx === 0 ? { ...factory, dockingCapacity: 1 } : factory,
      ),
    }));

    expect(store.getState().dockDroneAtFactory(factoryId, 'drone-a')).toBe('docking');
    expect(store.getState().dockDroneAtFactory(factoryId, 'drone-b')).toBe('queued');
    const queued = store.getState().factories[0].queuedDrones;
    expect(queued).toEqual(['drone-a', 'drone-b']);
  });

  it('processes factory storage into bars and drains global energy into factories', () => {
    const state = store.getState();
    const factoryId = state.factories[0].id;
    store.getState().transferOreToFactory(factoryId, 60);
    const energyBefore = store.getState().resources.energy;
    store.getState().processFactories(FACTORY_CONFIG.refineTime);
    const resources = store.getState().resources;
    const factory = store.getState().factories[0];
    expect(factory.resources.bars).toBeGreaterThan(0);
    expect(resources.bars).toBeGreaterThan(0);
    const expectedTransfer = Math.min(
      energyBefore,
      FACTORY_CONFIG.energyCapacity - FACTORY_CONFIG.initialEnergy,
    );
    expect(resources.energy).toBeCloseTo(energyBefore - expectedTransfer, 5);
  });

  it('adds resources to a factory ledger and mirrors to global totals', () => {
    const factoryId = store.getState().factories[0].id;
    store.getState().addResourcesToFactory(factoryId, { metals: 25, bars: 10 });
    const { factories, resources } = store.getState();
    expect(factories[0].resources.metals).toBeCloseTo(25);
    expect(factories[0].resources.bars).toBeCloseTo(10);
    expect(resources.metals).toBeCloseTo(25);
    expect(resources.bars).toBeCloseTo(10);
  });

  it('upgrades factories using local resources', () => {
    const factoryId = store.getState().factories[0].id;
    store.setState((state) => ({
      factories: state.factories.map((factory, idx) =>
        idx === 0
          ? {
              ...factory,
              resources: {
                ...factory.resources,
                metals: 100,
                crystals: 100,
                bars: 50,
                organics: 50,
                ice: 50,
              },
            }
          : factory,
      ),
      resources: {
        ...state.resources,
        metals: 100,
        crystals: 100,
        bars: 50,
        organics: 50,
        ice: 50,
      },
    }));

    const before = store.getState().factories[0];
    const upgraded = store.getState().upgradeFactory(factoryId, 'docking');
    expect(upgraded).toBe(true);
    const after = store.getState().factories[0];
    expect(after.dockingCapacity).toBe(before.dockingCapacity + 1);
    expect(after.resources.metals).toBeLessThan(before.resources.metals);
    expect(after.resources.crystals).toBeLessThan(before.resources.crystals);
    expect(store.getState().resources.metals).toBeLessThan(100);
  });

  it('places purchased factories with randomized spacing within bounds', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy
      .mockReturnValueOnce(0) // angle for second factory
      .mockReturnValueOnce(0) // distance factor for second factory
      .mockReturnValueOnce(0.1) // id entropy
      .mockReturnValueOnce(0.25) // angle for third factory
      .mockReturnValueOnce(0.5) // distance factor for third factory
      .mockReturnValueOnce(0.2); // id entropy

    const state = store.getState();
    store.setState({
      resources: { ...state.resources, metals: 10_000, crystals: 10_000 },
    });

    expect(store.getState().purchaseFactory()).toBe(true);
    expect(store.getState().purchaseFactory()).toBe(true);

    const factories = store.getState().factories;
    expect(factories).toHaveLength(3);

    const [origin, second, third] = factories;

    const distanceToOrigin = second.position.distanceTo(origin.position);
    expect(distanceToOrigin).toBeGreaterThanOrEqual(FACTORY_MIN_DISTANCE);
    expect(distanceToOrigin).toBeLessThanOrEqual(FACTORY_MAX_DISTANCE);

    const distancesForThird = factories
      .slice(0, 2)
      .map((factory) => third.position.distanceTo(factory.position))
      .sort((a, b) => a - b);

    expect(distancesForThird[0]).toBeGreaterThanOrEqual(FACTORY_MIN_DISTANCE);
    expect(distancesForThird[0]).toBeLessThanOrEqual(FACTORY_MAX_DISTANCE);
    expect(distancesForThird[1]).toBeLessThanOrEqual(FACTORY_MAX_DISTANCE);
  });
});
