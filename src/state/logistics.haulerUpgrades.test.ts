import { describe, it, expect, beforeEach } from 'vitest';
import { storeApi } from '@/state/store';

describe('state/logistics hauler upgrades', () => {
  beforeEach(() => {
    storeApi.setState((state) => ({
      ...state,
      resources: {
        ...state.resources,
        metals: 500,
        crystals: 300,
        bars: 200,
      },
      modules: {
        ...state.modules,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
    }));
    storeApi.setState((state) => ({
      ...state,
      factories: state.factories.map((factory, index) =>
        index === 0
          ? {
              ...factory,
              resources: {
                ...factory.resources,
                metals: 250,
                crystals: 120,
                bars: 80,
              },
              haulerUpgrades: undefined,
            }
          : factory,
      ),
    }));
  });

  it('purchases a global hauler module when affordable', () => {
    const result = storeApi.getState().purchaseHaulerModule('haulerDepot');
    expect(result).toBe(true);
    const { modules, resources } = storeApi.getState();
    expect(modules.haulerDepot).toBe(1);
    expect(resources.metals).toBeLessThan(500);
  });

  it('rejects global module purchase when insufficient resources', () => {
    storeApi.setState((state) => ({
      ...state,
      resources: { ...state.resources, metals: 0 },
    }));
    const result = storeApi.getState().purchaseHaulerModule('haulerDepot');
    expect(result).toBe(false);
    expect(storeApi.getState().modules.haulerDepot).toBe(0);
  });

  it('purchases factory hauler override and deducts resources', () => {
    const factoryId = storeApi.getState().factories[0].id;
    const result = storeApi.getState().purchaseFactoryHaulerUpgrade(factoryId, 'capacityBoost');
    expect(result).toBe(true);
    const factory = storeApi.getState().factories[0];
    expect(factory.haulerUpgrades?.capacityBoost).toBe(1);
    expect(factory.resources.metals).toBeLessThan(250);
  });

  it('prevents factory upgrade when resources are lacking', () => {
    const factoryId = storeApi.getState().factories[0].id;
    storeApi.setState((state) => ({
      ...state,
      factories: state.factories.map((factory, index) =>
        index === 0
          ? {
              ...factory,
              resources: { ...factory.resources, metals: 0, bars: 0 },
            }
          : factory,
      ),
    }));
    const result = storeApi.getState().purchaseFactoryHaulerUpgrade(factoryId, 'speedBoost');
    expect(result).toBe(false);
    const factory = storeApi.getState().factories[0];
    expect(factory.haulerUpgrades?.speedBoost ?? 0).toBe(0);
  });
});
