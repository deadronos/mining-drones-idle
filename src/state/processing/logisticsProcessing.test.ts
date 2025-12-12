import { describe, it, expect, beforeEach } from 'vitest';
import { processLogistics } from './logisticsProcessing';
import { createStoreInstance } from '@/state/store';
import type { StoreState } from '../types';
import { WAREHOUSE_NODE_ID } from '@/ecs/logistics';

describe('processLogistics warehouse integration', () => {
  let state: StoreState;

  beforeEach(() => {
    state = createStoreInstance().getState();
    state.logisticsQueues.pendingTransfers = [];
    state.gameTime = 0;
  });

  it('exports surplus ore to the warehouse and updates global stock on arrival', () => {
    const factory = state.factories[0];
    factory.resources.ore = 200;
    factory.currentStorage = 200;

    const firstPass = processLogistics(state);
    const exportTransfer = firstPass.logisticsQueues.pendingTransfers.find(
      (transfer) => transfer.toFactoryId === WAREHOUSE_NODE_ID,
    );

    expect(exportTransfer).toBeDefined();
    expect(exportTransfer?.resource).toBe('ore');

    const initialFactoryOre = factory.resources.ore;
    const initialWarehouseOre = state.resources.ore;

    state.logisticsQueues = firstPass.logisticsQueues;
    state.gameTime = exportTransfer!.eta + 0.01;

    const secondPass = processLogistics(state);

    expect(secondPass.logisticsQueues.pendingTransfers).not.toContainEqual(
      expect.objectContaining({ id: exportTransfer!.id }),
    );
    expect(factory.resources.ore).toBeLessThan(initialFactoryOre);
    expect(state.resources.ore).toBeGreaterThan(initialWarehouseOre);
  });

  it('imports ore from the warehouse when a factory is below its buffer', () => {
    const factory = state.factories[0];
    factory.resources.ore = 0;
    factory.currentStorage = 0;
    state.resources.ore = 150;

    const firstPass = processLogistics(state);
    const importTransfer = firstPass.logisticsQueues.pendingTransfers.find(
      (transfer) => transfer.fromFactoryId === WAREHOUSE_NODE_ID,
    );

    expect(importTransfer).toBeDefined();
    expect(importTransfer?.resource).toBe('ore');
    expect(factory.logisticsState?.inboundSchedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromFactoryId: WAREHOUSE_NODE_ID, resource: 'ore' }),
      ]),
    );

    const initialWarehouseOre = state.resources.ore;
    const initialFactoryOre = factory.resources.ore;

    state.logisticsQueues = firstPass.logisticsQueues;
    state.gameTime = importTransfer!.eta + 0.01;

    const secondPass = processLogistics(state);

    expect(secondPass.logisticsQueues.pendingTransfers).not.toContainEqual(
      expect.objectContaining({ id: importTransfer!.id }),
    );
    expect(state.resources.ore).toBeLessThan(initialWarehouseOre);
    expect(factory.resources.ore).toBeGreaterThan(initialFactoryOre);
  });

  it('exports surplus bars to the warehouse with resource-specific buffer', () => {
    const factory = state.factories[0];
    factory.resources.bars = 74;
    factory.haulersAssigned = 1;

    const firstPass = processLogistics(state);
    const exportTransfer = firstPass.logisticsQueues.pendingTransfers.find(
      (transfer) => transfer.toFactoryId === WAREHOUSE_NODE_ID && transfer.resource === 'bars',
    );

    expect(exportTransfer).toBeDefined();
    expect(exportTransfer?.resource).toBe('bars');
    // With bars target = 5, minReserve = 25, available should be ~44
    expect(exportTransfer?.amount).toBeGreaterThan(0);

    const initialFactoryBars = factory.resources.bars;
    const initialWarehouseBars = state.resources.bars;

    state.logisticsQueues = firstPass.logisticsQueues;
    state.gameTime = exportTransfer!.eta + 0.01;

    const secondPass = processLogistics(state);

    expect(secondPass.logisticsQueues.pendingTransfers).not.toContainEqual(
      expect.objectContaining({ id: exportTransfer!.id }),
    );
    expect(factory.resources.bars).toBeLessThan(initialFactoryBars);
    expect(state.resources.bars).toBeGreaterThan(initialWarehouseBars);
    expect(secondPass.throughputByFactory[factory.id]).toBeGreaterThan(0);
  });

  it('records throughput for warehouse imports', () => {
    const factory = state.factories[0];
    factory.resources.ore = 0;
    factory.currentStorage = 0;
    state.resources.ore = 200;

    const firstPass = processLogistics(state);
    const importTransfer = firstPass.logisticsQueues.pendingTransfers.find(
      (transfer) => transfer.fromFactoryId === WAREHOUSE_NODE_ID,
    );

    expect(importTransfer).toBeDefined();

    state.logisticsQueues = firstPass.logisticsQueues;
    state.gameTime = importTransfer!.eta + 0.01;

    const secondPass = processLogistics(state);

    expect(secondPass.throughputByFactory[factory.id]).toBeGreaterThan(0);
  });
});
