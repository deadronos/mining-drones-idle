import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  computeEnergyThrottle,
  computeRefineryProduction,
  costForLevel,
  computePrestigeBonus,
  computePrestigeGain,
  createStoreInstance,
  getEnergyCapacity,
  getEnergyGeneration,
  moduleDefinitions,
  parseSnapshot,
  saveVersion,
  serializeStore,
  PRESTIGE_THRESHOLD,
} from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import { createFactory } from '@/ecs/factories';

describe('state/store', () => {
  it('purchases specialization tech only when unlocked and affordable', () => {
    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, metals: 9_000 },
      specTechSpent: { ...state.specTechSpent, metals: 0 },
    }));
    expect(store.getState().purchaseSpecTech('oreMagnet')).toBe(false);

    store.setState((state) => ({
      resources: { ...state.resources, metals: 12_000 },
      specTechSpent: { ...state.specTechSpent, metals: 50_000 },
    }));

    expect(store.getState().purchaseSpecTech('oreMagnet')).toBe(true);
    const after = store.getState();
    expect(after.specTechs.oreMagnet).toBe(1);
    expect(after.specTechSpent.metals).toBeGreaterThan(50_000);
    expect(after.resources.metals).toBeLessThan(12_000);
  });

  it('tracks highlighted factories for hauler interactions', () => {
    const store = createStoreInstance();
    expect(store.getState().highlightedFactories).toEqual({ sourceId: null, destId: null });

    store.getState().setHighlightedFactories({ sourceId: 'factory-a', destId: 'factory-b' });
    expect(store.getState().highlightedFactories).toEqual({
      sourceId: 'factory-a',
      destId: 'factory-b',
    });

    // No change when setting the same highlight
    store.getState().setHighlightedFactories({ sourceId: 'factory-a', destId: 'factory-b' });
    expect(store.getState().highlightedFactories).toEqual({
      sourceId: 'factory-a',
      destId: 'factory-b',
    });

    store.getState().setHighlightedFactories({ sourceId: null, destId: null });
    expect(store.getState().highlightedFactories).toEqual({ sourceId: null, destId: null });
  });

  it('persists prestige investments across prestige resets', () => {
    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, metals: 5_000, bars: PRESTIGE_THRESHOLD },
      specTechs: { ...state.specTechs, oreMagnet: 2 },
      specTechSpent: { ...state.specTechSpent, metals: 60_000 },
    }));

    expect(store.getState().investPrestige('droneVelocity')).toBe(true);
    store.getState().doPrestige();
    const afterPrestige = store.getState();
    expect(afterPrestige.prestigeInvestments.droneVelocity).toBe(1);
    expect(afterPrestige.specTechs.oreMagnet).toBe(0);
    expect(afterPrestige.specTechSpent.metals).toBe(0);
  });

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

  it('boosts refinery output when crystals are stockpiled', () => {
    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, ore: 40, crystals: 0 },
    }));
    const baseline = computeRefineryProduction(store.getState(), 1);
    store.setState((state) => ({
      resources: { ...state.resources, ore: 40, crystals: 20 },
    }));
    const boosted = computeRefineryProduction(store.getState(), 1);
    const modifiers = getResourceModifiers(store.getState().resources);
    expect(boosted.barsProduced).toBeGreaterThan(baseline.barsProduced);
    expect(boosted.barsProduced).toBeCloseTo(
      baseline.barsProduced * modifiers.refineryYieldMultiplier,
      5,
    );
  });

  it('applies specialization and prestige refinery bonuses multiplicatively', () => {
    const baseStore = createStoreInstance();
    baseStore.setState((state) => ({
      resources: { ...state.resources, ore: 40 },
    }));
    const baseline = computeRefineryProduction(baseStore.getState(), 1);

    const enhancedStore = createStoreInstance();
    enhancedStore.setState((state) => ({
      resources: { ...state.resources, ore: 40 },
      specTechs: { ...state.specTechs, biotechFarming: 2 },
      prestigeInvestments: { ...state.prestigeInvestments, refineryMastery: 1 },
    }));
    const enhanced = computeRefineryProduction(enhancedStore.getState(), 1);
    const expectedMultiplier = (1 + 2 * 0.03) * (1 + 0.01);
    expect(enhanced.barsProduced).toBeCloseTo(
      baseline.barsProduced * expectedMultiplier,
      5,
    );
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
    const factoryA = createFactory('factory-a', new Vector3(0, 0, 0));
    factoryA.resources.ore = 250;
    factoryA.haulersAssigned = 3;
    const factoryB = createFactory('factory-b', new Vector3(10, 0, 0));
    factoryB.haulersAssigned = 1;
    store.setState({
      resources: { ...base.resources, bars },
      prestige: { cores: 3 },
      factories: [factoryA, factoryB],
      selectedFactoryId: factoryB.id,
      logisticsQueues: {
        pendingTransfers: [
          {
            id: 'transfer-test',
            fromFactoryId: factoryA.id,
            toFactoryId: factoryB.id,
            resource: 'ore',
            amount: 25,
            status: 'scheduled',
            eta: base.gameTime + 5,
            departedAt: base.gameTime,
          },
        ],
      },
      droneFlights: {
        'drone-1': {
          droneId: 'drone-1',
          state: 'toAsteroid',
          targetAsteroidId: 'asteroid-1',
          targetRegionId: null,
          targetFactoryId: factoryA.id,
          pathSeed: 42,
          travel: {
            from: [0, 0, 0],
            to: [10, 0, 0],
            control: [4, 1, 0],
            elapsed: 0.25,
            duration: 1,
          },
        },
      },
      droneOwners: { 'drone-1': factoryA.id },
      gameTime: 42,
      logisticsTick: 1.5,
    });
    expect(store.getState().preview()).toBe(preview);
    store.getState().doPrestige();
    const after = store.getState();
    expect(after.prestige.cores).toBe(3 + preview);
    expect(after.resources.bars).toBe(0);
    expect(after.modules.droneBay).toBe(1);
    expect(after.factories).toHaveLength(1);
    expect(after.factories[0]?.id).toBe('factory-0');
    expect(after.factories[0]?.haulersAssigned ?? 0).toBe(1);
    expect(after.logisticsQueues.pendingTransfers).toHaveLength(0);
    expect(Object.keys(after.droneFlights)).toHaveLength(0);
    expect(Object.keys(after.droneOwners)).toHaveLength(0);
    expect(after.selectedFactoryId).toBe(after.factories[0]?.id ?? null);
    expect(after.selectedAsteroidId).toBeNull();
    expect(after.gameTime).toBe(0);
    expect(after.logisticsTick).toBe(0);
  });

  it('updates settings with normalization and export/import roundtrips', () => {
    const store = createStoreInstance();
    const api = store.getState();
    api.updateSettings({
      autosaveInterval: 33.7,
      notation: 'engineering',
      offlineCapHours: -4,
      showTrails: false,
      showHaulerShips: false,
      performanceProfile: 'high',
    });
    const afterUpdate = store.getState();
    expect(afterUpdate.settings.autosaveInterval).toBe(33);
    expect(afterUpdate.settings.notation).toBe('engineering');
    expect(afterUpdate.settings.offlineCapHours).toBe(0);
    expect(afterUpdate.settings.showTrails).toBe(false);
    expect(afterUpdate.settings.showHaulerShips).toBe(false);
    expect(afterUpdate.settings.performanceProfile).toBe('high');

    const snapshot = serializeStore(store.getState());
    expect(snapshot.settings.autosaveInterval).toBe(33);
    expect(snapshot.save.version).toBe(saveVersion);
    expect(snapshot.settings.showTrails).toBe(false);
    expect(snapshot.settings.showHaulerShips).toBe(false);

    const payload = JSON.stringify(snapshot);
    const parsed = parseSnapshot(payload);
    expect(parsed?.settings.notation).toBe('engineering');

    const fresh = createStoreInstance();
    const success = fresh.getState().importState(payload);
    expect(success).toBe(true);
    const imported = fresh.getState();
    expect(imported.settings.autosaveInterval).toBe(33);
    expect(imported.settings.showTrails).toBe(false);
    expect(imported.settings.showHaulerShips).toBe(false);
    expect(imported.settings.performanceProfile).toBe('high');
    expect(imported.resources.ore).toBe(snapshot.resources.ore);
  });

  it('rejects invalid import payloads gracefully', () => {
    const store = createStoreInstance();
    const success = store.getState().importState('not-json');
    expect(success).toBe(false);
  });

  it('computes throttle using energy fraction with configured floor', () => {
    const store = createStoreInstance();
    store.setState((state) => ({
      resources: { ...state.resources, energy: 30 },
      modules: { ...state.modules, solar: 0 },
      settings: { ...state.settings, throttleFloor: 0.25 },
    }));
    const throttle = computeEnergyThrottle(store.getState());
    expect(throttle).toBeCloseTo(0.3, 5);

    store.setState((state) => ({
      resources: { ...state.resources, energy: 1 },
      settings: { ...state.settings, throttleFloor: 0.4 },
    }));
    const floored = computeEnergyThrottle(store.getState());
    expect(floored).toBeCloseTo(0.4, 5);
  });

  it('expands energy capacity and generation with resource modifiers', () => {
    const store = createStoreInstance();
    const baseModules = store.getState().modules;
    const baseCapacity = getEnergyCapacity(baseModules);
    const baseGeneration = getEnergyGeneration(baseModules);

    store.setState((state) => ({
      modules: { ...state.modules, solar: 0 },
      resources: { ...state.resources, ice: 30, organics: 18 },
    }));
    const state = store.getState();
    const modifiers = getResourceModifiers(state.resources);
    const boostedCapacity = getEnergyCapacity(state.modules, modifiers);
    const boostedGeneration = getEnergyGeneration(state.modules, modifiers);

    expect(boostedCapacity).toBeGreaterThan(baseCapacity);
    expect(boostedGeneration).toBeGreaterThan(baseGeneration);
  });

  it('persists rng seed across export and import operations', () => {
    const store = createStoreInstance();
    const initialSeed = store.getState().rngSeed;
    expect(Number.isFinite(initialSeed)).toBe(true);

    const exported = store.getState().exportState();
    const snapshot = JSON.parse(exported) as { rngSeed?: number };
    expect(snapshot.rngSeed).toBe(initialSeed);

    const importedStore = createStoreInstance();
    const success = importedStore.getState().importState(exported);
    expect(success).toBe(true);
    expect(importedStore.getState().rngSeed).toBe(initialSeed);

    snapshot.rngSeed = 987654321;
    const payloadWithSeed = JSON.stringify(snapshot);
    const seededStore = createStoreInstance();
    const seededSuccess = seededStore.getState().importState(payloadWithSeed);
    expect(seededSuccess).toBe(true);
    expect(seededStore.getState().rngSeed).toBe(987654321);
  });

  it('records and clears drone flight snapshots', () => {
    const store = createStoreInstance();
    const api = store.getState();
    api.recordDroneFlight({
      droneId: 'drone-1',
      state: 'toAsteroid',
      targetAsteroidId: 'asteroid-1',
      targetRegionId: 'region-1',
      targetFactoryId: null,
      pathSeed: 42,
      travel: {
        from: [0, 0, 0],
        to: [10, 0, 0],
        control: [4, 1, 0],
        elapsed: 0.25,
        duration: 1,
      },
    });
    // serializeStore returns snapshot which has array
    const snapshot = serializeStore(store.getState());
    expect(snapshot.droneFlights).toHaveLength(1);
    expect(snapshot.droneFlights?.[0].pathSeed).toBe(42);
    expect(snapshot.droneFlights?.[0].targetRegionId).toBe('region-1');
    expect(snapshot.droneFlights?.[0].travel.elapsed).toBeCloseTo(0.25, 5);

    // Store itself has Record
    expect(store.getState().droneFlights['drone-1']).toBeDefined();

    api.clearDroneFlight('drone-1');
    expect(Object.keys(store.getState().droneFlights)).toHaveLength(0);
  });
});
