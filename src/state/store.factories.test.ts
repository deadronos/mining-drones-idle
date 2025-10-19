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
    const dockUpgrade = store.getState().upgradeFactory(factoryId, 'docking');
    expect(dockUpgrade).toBe(true);
    const afterDock = store.getState().factories[0];
    expect(afterDock.dockingCapacity).toBe(before.dockingCapacity + 1);
    expect(afterDock.resources.metals).toBeLessThan(before.resources.metals);
    expect(afterDock.resources.crystals).toBeLessThan(before.resources.crystals);
    expect(store.getState().resources.metals).toBeLessThan(100);

    const solarUpgrade = store.getState().upgradeFactory(factoryId, 'solar');
    expect(solarUpgrade).toBe(true);
    const afterSolar = store.getState().factories[0];
    expect(afterSolar.upgrades.solar).toBe((before.upgrades.solar ?? 0) + 1);
    expect(afterSolar.resources.metals).toBeLessThan(afterDock.resources.metals);
    expect(afterSolar.resources.crystals).toBeLessThan(afterDock.resources.crystals);
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

  it('transfers drone ownership correctly between factories', () => {
    const state = store.getState();
    let factories = state.factories;

    // Ensure we have at least 2 factories
    if (factories.length < 2) {
      store.setState({
        resources: { ...state.resources, metals: 1000, crystals: 1000 },
      });
      store.getState().purchaseFactory();
      factories = store.getState().factories;
    }

    const factoryA = factories[0];
    const factoryB = factories[1];

    // Dock drone at Factory A
    store.getState().dockDroneAtFactory(factoryA.id, 'drone-1');
    expect(store.getState().factories[0].queuedDrones).toContain('drone-1');
    expect(store.getState().factories[0].ownedDrones).not.toContain('drone-1');

    // Transfer ownership to Factory A (simulate unload)
    store.getState().undockDroneFromFactory(factoryA.id, 'drone-1', { transferOwnership: true });
    const afterFirst = store.getState();
    expect(afterFirst.factories[0].ownedDrones).toContain('drone-1');
    expect(afterFirst.droneOwners['drone-1']).toBe(factoryA.id);

    // Dock same drone at Factory B
    store.getState().dockDroneAtFactory(factoryB.id, 'drone-1');
    expect(store.getState().factories[1].queuedDrones).toContain('drone-1');

    // Transfer ownership to Factory B
    store.getState().undockDroneFromFactory(factoryB.id, 'drone-1', { transferOwnership: true });
    const afterSecond = store.getState();

    // Verify: Drone should be in Factory B's ownedDrones but NOT Factory A's
    expect(afterSecond.factories[0].ownedDrones).not.toContain('drone-1');
    expect(afterSecond.factories[1].ownedDrones).toContain('drone-1');
    expect(afterSecond.droneOwners['drone-1']).toBe(factoryB.id);
  });

  it('prevents duplicate drone ownership when undocking multiple times at same factory', () => {
    const state = store.getState();
    const factoryA = state.factories[0];

    // First cycle: dock and transfer ownership
    store.getState().dockDroneAtFactory(factoryA.id, 'drone-2');
    store.getState().undockDroneFromFactory(factoryA.id, 'drone-2', { transferOwnership: true });

    let owned = store.getState().factories[0].ownedDrones;
    const firstOwnershipCount = owned.filter((id) => id === 'drone-2').length;

    // Second cycle: dock and transfer ownership again
    store.getState().dockDroneAtFactory(factoryA.id, 'drone-2');
    store.getState().undockDroneFromFactory(factoryA.id, 'drone-2', { transferOwnership: true });

    owned = store.getState().factories[0].ownedDrones;
    const secondOwnershipCount = owned.filter((id) => id === 'drone-2').length;

    // Should have exactly 1 entry, not accumulated duplicates
    expect(firstOwnershipCount).toBe(1);
    expect(secondOwnershipCount).toBe(1);
    expect(owned).toContain('drone-2');
  });

  it('ensures single ownership across all factories', () => {
    const state = store.getState();
    // Verify factories exist before purchase
    void state.factories;

    // Add more factories for testing
    store.setState({
      resources: { ...state.resources, metals: 1000, crystals: 1000 },
    });
    store.getState().purchaseFactory();
    store.getState().purchaseFactory();

    const updatedFactories = store.getState().factories;
    const [fA, fB, fC, _fD] = updatedFactories;

    // Simulate drone visiting multiple factories
    store.getState().dockDroneAtFactory(fA.id, 'drone-3');
    store.getState().undockDroneFromFactory(fA.id, 'drone-3', { transferOwnership: true });

    store.getState().dockDroneAtFactory(fB.id, 'drone-3');
    store.getState().undockDroneFromFactory(fB.id, 'drone-3', { transferOwnership: true });

    store.getState().dockDroneAtFactory(fC.id, 'drone-3');
    store.getState().undockDroneFromFactory(fC.id, 'drone-3', { transferOwnership: true });

    // Count total occurrences across all factories
    const finalState = store.getState();
    const totalOwnerships = finalState.factories.reduce(
      (sum, factory) => sum + factory.ownedDrones.filter((id) => id === 'drone-3').length,
      0,
    );

    // Should have exactly 1 ownership (in factory C)
    expect(totalOwnerships).toBe(1);
    expect(finalState.factories[2].ownedDrones).toContain('drone-3');
    expect(finalState.factories[0].ownedDrones).not.toContain('drone-3');
    expect(finalState.factories[1].ownedDrones).not.toContain('drone-3');
  });
});
