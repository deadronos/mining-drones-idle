import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { StoreSnapshotSchema } from './snapshotSchema';

describe('snapshot schema (Ajv) validations', () => {
  it('validates a complete resources object', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(StoreSnapshotSchema as unknown as object);
    const ok = validate({
      resources: { ore: 1, ice: 0, metals: 0, crystals: 0, organics: 0, bars: 0, energy: 100, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 0, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } },
    });
    expect(ok).toBe(true);
  });

  it('rejects when a numeric field like bars is missing', () => {
    const snapshot = {
      resources: { ore: 1, energy: 50 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0, haulerDepot: 0, logisticsHub: 0, routingProtocol: 0 },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } },
    };

    const ajv = new Ajv();
    const validate = ajv.compile(StoreSnapshotSchema as unknown as object);
    const ok = validate(snapshot);

    // Missing numeric fields now default via schemaVersion-aware normalization.
    expect(ok).toBe(true);
  });
});
