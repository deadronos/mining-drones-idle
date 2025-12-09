import { describe, it, expect } from 'vitest';
import { StoreSnapshotSchema, ResourcesSchema } from './snapshotSchema';

describe('snapshot schema (zod) validations', () => {
  it('validates a complete resources object', () => {
    const res = ResourcesSchema.safeParse({
      ore: 1,
      ice: 0,
      metals: 0,
      crystals: 0,
      organics: 0,
      bars: 0,
      energy: 100,
      credits: 0,
    });
    expect(res.success).toBe(true);
  });

  it('rejects when a numeric field like bars is missing', () => {
    const snapshot = {
      resources: { ore: 1, energy: 50 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } },
    } as any;

    const res = StoreSnapshotSchema.safeParse(snapshot);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.join('.') === 'resources.bars')).toBeTruthy();
    }
  });
});
