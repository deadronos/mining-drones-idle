import { describe, it, expect } from 'vitest';
import { computeWarehouseCapacity } from '@/state/utils';
import { initialModules, BASE_STORAGE, STORAGE_PER_LEVEL, WAREHOUSE_CONFIG } from '@/state/constants';

describe('computeWarehouseCapacity', () => {
  it('scales with storage module level', () => {
    const baseCapacity = computeWarehouseCapacity(initialModules);
    const upgradedModules = { ...initialModules, storage: initialModules.storage + 2 };
    const upgradedCapacity = computeWarehouseCapacity(upgradedModules);

    expect(baseCapacity).toBeCloseTo(BASE_STORAGE * WAREHOUSE_CONFIG.storageMultiplier, 5);
    expect(upgradedCapacity).toBeCloseTo(
      (BASE_STORAGE + 2 * STORAGE_PER_LEVEL) * WAREHOUSE_CONFIG.storageMultiplier,
      5,
    );
    expect(upgradedCapacity).toBeGreaterThan(baseCapacity);
  });
});
