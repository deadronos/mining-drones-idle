import { beforeEach, describe, expect, it } from 'vitest';
import { createStoreInstance } from '@/state/store';
import { LOGISTICS_CONFIG, WAREHOUSE_NODE_ID } from '@/ecs/logistics';
import { WAREHOUSE_CONFIG, initialResources, PRESTIGE_THRESHOLD } from '@/state/constants';

describe('store warehouse integration flows', () => {
  let store = createStoreInstance();

  beforeEach(() => {
    store = createStoreInstance();
  });

  const advanceTick = (dt: number) => {
    store.getState().tick(dt);
  };

  it('exports surplus bars from a factory to the warehouse', () => {
    const barsSurplus = 150;
    store.setState((state) => {
      const factories = state.factories.map((factory, idx) =>
        idx === 0
          ? {
              ...factory,
              resources: {
                ...factory.resources,
                ore: 0,
                bars: barsSurplus,
                metals: 0,
                crystals: 0,
                organics: 0,
                ice: 0,
                credits: 0,
              },
              currentStorage: 0,
              haulersAssigned: factory.haulersAssigned ?? 1,
            }
          : factory,
      );
      return {
        factories,
        resources: { ...state.resources, bars: 0 },
        logisticsQueues: { pendingTransfers: [] },
        logisticsTick: 0,
        gameTime: 0,
      };
    });

    advanceTick(LOGISTICS_CONFIG.scheduling_interval);
    let transfers = store.getState().logisticsQueues.pendingTransfers;
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers[0].toFactoryId).toBe(WAREHOUSE_NODE_ID);

    advanceTick(LOGISTICS_CONFIG.scheduling_interval);
    transfers = store.getState().logisticsQueues.pendingTransfers;
    expect(transfers).toHaveLength(0);

    const warehouseBars = store.getState().resources.bars;
    const factoryBars = store.getState().factories[0].resources.bars;
    expect(warehouseBars).toBeGreaterThan(0);
    expect(factoryBars).toBeLessThan(barsSurplus);
  });

  it('imports ore from the warehouse when a factory is starving', () => {
    const warehouseOre = 200;
    store.setState((state) => {
      const factories = state.factories.map((factory, idx) =>
        idx === 0
          ? {
              ...factory,
              resources: {
                ...factory.resources,
                ore: 0,
              },
              currentStorage: 0,
              energy: 0,
            }
          : factory,
      );
      return {
        factories,
        resources: { ...state.resources, ore: warehouseOre, energy: 0 },
        logisticsQueues: { pendingTransfers: [] },
        logisticsTick: 0,
        gameTime: 0,
      };
    });

    advanceTick(LOGISTICS_CONFIG.scheduling_interval);
    let transfers = store.getState().logisticsQueues.pendingTransfers;
    expect(Array.isArray(transfers)).toBe(true);
    expect(
      transfers.some((transfer) => transfer.fromFactoryId === WAREHOUSE_NODE_ID),
    ).toBe(true);

    const transferToFactory = transfers.find(
      (transfer) => transfer.fromFactoryId === WAREHOUSE_NODE_ID,
    );
    expect(transferToFactory).toBeDefined();
    store.setState(() => ({
      gameTime: transferToFactory!.eta,
      logisticsTick: 0,
    }));

    advanceTick(LOGISTICS_CONFIG.scheduling_interval);
    transfers = store.getState().logisticsQueues.pendingTransfers;
    const factoryOre = store.getState().factories[0].resources.ore;
    const remainingWarehouseOre = store.getState().resources.ore;
    expect(factoryOre).toBeGreaterThan(0);
    expect(remainingWarehouseOre).toBeLessThan(warehouseOre);
  });

  it('resets warehouse and factories on prestige while preserving starter hauler', () => {
    store.setState((state) => ({
      resources: { ...state.resources, bars: PRESTIGE_THRESHOLD },
      factories: state.factories.map((factory, idx) =>
        idx === 0
          ? {
              ...factory,
              resources: { ...factory.resources, bars: 40 },
            }
          : factory,
      ),
    }));

    store.getState().doPrestige();
    const after = store.getState();
    expect(after.resources).toMatchObject(initialResources);
    expect(after.factories).toHaveLength(1);
    expect(after.factories[0].haulersAssigned).toBe(WAREHOUSE_CONFIG.starterFactoryHaulers);
    expect(after.factories[0].resources.bars).toBe(WAREHOUSE_CONFIG.starterFactoryStock.bars);
  });

  it('round-trips warehouse state through export and import', () => {
    store.setState((state) => {
      const factories = state.factories.map((factory, idx) =>
        idx === 0
          ? {
              ...factory,
              resources: { ...factory.resources, bars: 80 },
              currentStorage: factory.resources.ore,
            }
          : factory,
      );
      return {
        factories,
        resources: { ...state.resources, bars: 40 },
        logisticsQueues: { pendingTransfers: [] },
        logisticsTick: 0,
        gameTime: 0,
      };
    });

    advanceTick(LOGISTICS_CONFIG.scheduling_interval);
    advanceTick(LOGISTICS_CONFIG.scheduling_interval);

    const exported = store.getState().exportState();
    const secondStore = createStoreInstance();
    const imported = secondStore.getState().importState(exported);
    expect(imported).toBe(true);

    const originalState = store.getState();
    const restoredState = secondStore.getState();

    expect(restoredState.resources.bars).toBeCloseTo(originalState.resources.bars);
    expect(restoredState.factories[0].resources.bars).toBeCloseTo(
      originalState.factories[0].resources.bars,
    );
    expect(restoredState.factories[0].haulersAssigned).toBe(
      originalState.factories[0].haulersAssigned,
    );
  });
});
