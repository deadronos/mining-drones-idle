import { describe, it, expect } from 'vitest';
import { normalizeSnapshot } from './store';
import type { StoreSnapshot } from '@/state/types';

// DeepPartial helper for strongly-typed partial snapshots in tests
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

describe('Snapshot normalization', () => {
  it('fills missing top-level resource fields (bars) with defaults', () => {
    const partial: DeepPartial<StoreSnapshot> = {
      resources: { ore: 123, energy: 50 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } },
    };

    const normalized = normalizeSnapshot(partial as Partial<StoreSnapshot>);
    expect(normalized.resources.bars).toBeDefined();
    expect(typeof normalized.resources.bars).toBe('number');
  });

  it('fills missing factory resource fields (bars) with defaults', () => {
    const partial: DeepPartial<StoreSnapshot> = {
      resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
      modules: { droneBay: 1, refinery: 1, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } },
      factories: [
        {
          id: 'f1',
          position: [0, 0, 0],
          dockingCapacity: 1,
          refineSlots: 1,
          energy: 50,
          energyCapacity: 100,
          resources: { ore: 10 }, // missing bars intentionally
        },
      ],
    };

    const normalized = normalizeSnapshot(partial as Partial<StoreSnapshot>);
    expect(normalized.factories).toBeDefined();
    expect(normalized.factories![0].resources.bars).toBeDefined();
    expect(typeof normalized.factories![0].resources.bars).toBe('number');
  });
});
