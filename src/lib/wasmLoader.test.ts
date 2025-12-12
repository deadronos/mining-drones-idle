import { describe, it, expect, vi } from 'vitest';
import type { StoreSnapshot } from '@/state/types';

// Mock the generated WASM module so tests don't require actual WASM build
vi.mock('../gen/rust_engine', () => {
  class WasmGameStateMock {
    private _snapshot: Record<string, unknown> | null;
    constructor(json: string) {
      const parsed = JSON.parse(json);
      // Simulate Rust serde requiring `resources.bars` to be present
      if (!parsed?.resources || typeof parsed.resources.bars !== 'number') {
        throw new Error('missing field bars');
      }
      this._snapshot = parsed;
    }
    free(): void {
      this._snapshot = null;
    }
    load_snapshot(s: string): void {
      this._snapshot = JSON.parse(s);
    }
    export_snapshot(): string {
      return JSON.stringify(this._snapshot);
    }
    step(_dt: number): number {
      return 0.0;
    }
    apply_command(_command_json: string): void {
      // record command string for debugging in tests
      void _command_json;
    }
    layout_json(): string {
      return JSON.stringify({
        drones: {
          positions: { offset_bytes: 0, length: 3 },
          velocities: { offset_bytes: 12, length: 3 },
          states: { offset_bytes: 24, length: 1 },
          cargo: { offset_bytes: 28, length: 1 },
          battery: { offset_bytes: 32, length: 1 },
          max_battery: { offset_bytes: 36, length: 1 },
          capacity: { offset_bytes: 40, length: 1 },
          mining_rate: { offset_bytes: 44, length: 1 },
          cargo_profile: { offset_bytes: 48, length: 5 },
          target_factory_index: { offset_bytes: 68, length: 1 },
          owner_factory_index: { offset_bytes: 72, length: 1 },
          target_asteroid_index: { offset_bytes: 76, length: 1 },
          target_region_index: { offset_bytes: 80, length: 1 },
          charging: { offset_bytes: 84, length: 1 },
        },
        asteroids: {
          positions: { offset_bytes: 88, length: 3 },
          ore_remaining: { offset_bytes: 100, length: 1 },
          max_ore: { offset_bytes: 104, length: 1 },
          resource_profile: { offset_bytes: 108, length: 5 },
        },
        factories: {
          positions: { offset_bytes: 128, length: 3 },
          orientations: { offset_bytes: 140, length: 3 },
          activity: { offset_bytes: 152, length: 1 },
          resources: { offset_bytes: 156, length: 7 },
          energy: { offset_bytes: 184, length: 1 },
          max_energy: { offset_bytes: 188, length: 1 },
          upgrades: { offset_bytes: 192, length: 5 },
          refinery_state: { offset_bytes: 212, length: 1 },
          haulers_assigned: { offset_bytes: 216, length: 1 },
        },
        total_size_bytes: 220,
      });
    }
    data_ptr(): number {
      return 0;
    }
  }

  return {
    default: async () => ({ memory: { buffer: new ArrayBuffer(1024) } }),
    WasmGameState: WasmGameStateMock,
  };
});

import { loadWasmBridge } from './wasmLoader';

describe('WASM Loader normalization', () => {
  it('accepts a partially-populated snapshot by normalizing missing fields', async () => {
    const partial: Partial<StoreSnapshot> = {
      resources: { ore: 123, energy: 50 } as unknown as StoreSnapshot['resources'],
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      save: { lastSave: 0, version: '0.0.0' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 30,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.2,
        showTrails: true,
        showHaulerShips: true,
        showDebugPanel: false,
        performanceProfile: 'medium',
        inspectorCollapsed: false,
        useRustSim: false,
        shadowMode: false,
        metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 },
      } as unknown as StoreSnapshot['settings'],
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const res = await loadWasmBridge(partial as StoreSnapshot);
    expect(res.bridge).not.toBeNull();
    expect(res.error).toBeNull();
    expect(res.fallbackReason).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    // At least one warning should reference the resources issue (e.g. missing bars)
    expect(warnSpy.mock.calls.some((args) => args.join(' ').includes('resources'))).toBeTruthy();
    warnSpy.mockRestore();
  });

  it('returns a helpful fallbackReason when WASM init throws a serde missing-field error', async () => {
    const partial: Partial<StoreSnapshot> = {
      resources: { ore: 5, bars: 5, energy: 10 } as unknown as StoreSnapshot['resources'],
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, useRustSim: false, shadowMode: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } } as unknown as StoreSnapshot['settings'],
    };

    // Make the module initializer throw a serde-like message
    const wasm = (await import('../gen/rust_engine')) as unknown as {
      default: (...args: unknown[]) => unknown;
    };

    vi.spyOn(wasm, 'default').mockImplementationOnce(() => {
      throw new Error('missing field `bars` at line 1 column 1429');
    });

    const res = await loadWasmBridge(partial as StoreSnapshot);
    expect(res.bridge).toBeNull();
    expect(res.fallbackReason).toBeDefined();
    expect(res.fallbackReason).toContain('WASM deserialization failed');
    expect(res.fallbackReason).toContain('bars');
  });

  it('handles missing-field errors using single quotes', async () => {
    const partial: Partial<StoreSnapshot> = {
      resources: { ore: 5, bars: 5, energy: 10 } as unknown as StoreSnapshot['resources'],
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, useRustSim: false, shadowMode: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } } as unknown as StoreSnapshot['settings'],
    };

    const wasm = (await import('../gen/rust_engine')) as unknown as {
      default: (...args: unknown[]) => unknown;
    };

    vi.spyOn(wasm, 'default').mockImplementationOnce(() => {
      throw new Error("missing field 'bars' at line 1 column 1429");
    });

    const res = await loadWasmBridge(partial as StoreSnapshot);
    expect(res.bridge).toBeNull();
    expect(res.fallbackReason).toBeDefined();
    expect(res.fallbackReason).toContain('WASM deserialization failed');
    expect(res.fallbackReason).toContain('bars');
  });

  it('handles missing-field errors without any quotes', async () => {
    const partial: Partial<StoreSnapshot> = {
      resources: { ore: 5, bars: 5, energy: 10 } as unknown as StoreSnapshot['resources'],
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, useRustSim: false, shadowMode: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } } as unknown as StoreSnapshot['settings'],
    };

    const wasm = (await import('../gen/rust_engine')) as unknown as {
      default: (...args: unknown[]) => unknown;
    };

    vi.spyOn(wasm, 'default').mockImplementationOnce(() => {
      throw new Error('missing field bars at line 1 column 1429');
    });

    const res = await loadWasmBridge(partial as StoreSnapshot);
    expect(res.bridge).toBeNull();
    expect(res.fallbackReason).toBeDefined();
    expect(res.fallbackReason).toContain('WASM deserialization failed');
    expect(res.fallbackReason).toContain('bars');
  });

  it('handles missing-field errors with a colon separator', async () => {
    const partial: Partial<StoreSnapshot> = {
      resources: { ore: 5, bars: 5, energy: 10 } as unknown as StoreSnapshot['resources'],
      modules: {
        droneBay: 1,
        refinery: 0,
        storage: 0,
        solar: 0,
        scanner: 0,
        haulerDepot: 0,
        logisticsHub: 0,
        routingProtocol: 0,
      },
      save: { lastSave: 0, version: '0.0.0' },
      settings: { autosaveEnabled: true, autosaveInterval: 30, offlineCapHours: 8, notation: 'standard', throttleFloor: 0.2, showTrails: true, showHaulerShips: true, showDebugPanel: false, performanceProfile: 'medium', inspectorCollapsed: false, useRustSim: false, shadowMode: false, metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 300 } } as unknown as StoreSnapshot['settings'],
    };

    const wasm = (await import('../gen/rust_engine')) as unknown as {
      default: (...args: unknown[]) => unknown;
    };

    vi.spyOn(wasm, 'default').mockImplementationOnce(() => {
      throw new Error('missing field: bars at line 1 column 1429');
    });

    const res = await loadWasmBridge(partial as StoreSnapshot);
    expect(res.bridge).toBeNull();
    expect(res.fallbackReason).toBeDefined();
    expect(res.fallbackReason).toContain('WASM deserialization failed');
    expect(res.fallbackReason).toContain('bars');
  });
});
