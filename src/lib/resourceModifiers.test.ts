import { describe, expect, it } from 'vitest';
import { getResourceModifiers } from '@/lib/resourceModifiers';

type ResourcePatch = Partial<{ metals: number; crystals: number; organics: number; ice: number }>;

const buildResources = (patch: ResourcePatch) => ({
  ore: 0,
  ice: patch.ice ?? 0,
  metals: patch.metals ?? 0,
  crystals: patch.crystals ?? 0,
  organics: patch.organics ?? 0,
  bars: 0,
  energy: 0,
  credits: 0,
});

describe('lib/resourceModifiers', () => {
  it('applies diminishing returns with configured caps', () => {
    const low = getResourceModifiers(buildResources({ metals: 5, ice: 3, crystals: 2, organics: 4 }));
    const high = getResourceModifiers(buildResources({ metals: 80, ice: 80, crystals: 80, organics: 80 }));

    expect(low.metalsBonus).toBeGreaterThan(0);
    expect(low.metalsBonus).toBeLessThan(0.3);
    expect(high.metalsBonus).toBeCloseTo(0.3, 3);
    expect(high.crystalsBonus).toBeCloseTo(0.25, 3);
    expect(high.iceBonus).toBeCloseTo(0.35, 3);
    expect(high.organicsBonus).toBeCloseTo(0.4, 3);
  });

  it('derives multipliers from raw bonuses', () => {
    const modifiers = getResourceModifiers(
      buildResources({ metals: 12, crystals: 10, organics: 9, ice: 11 }),
    );

    expect(modifiers.droneCapacityMultiplier).toBeCloseTo(1 + modifiers.metalsBonus, 5);
    expect(modifiers.droneBatteryMultiplier).toBeCloseTo(1 + modifiers.metalsBonus, 5);
    expect(modifiers.storageCapacityMultiplier).toBeCloseTo(1 + modifiers.metalsBonus, 5);
    expect(modifiers.refineryYieldMultiplier).toBeCloseTo(1 + modifiers.crystalsBonus, 5);
    expect(modifiers.energyStorageMultiplier).toBeCloseTo(1 + modifiers.iceBonus, 5);
    expect(modifiers.energyDrainMultiplier).toBeLessThan(1);
    expect(modifiers.energyDrainMultiplier).toBeGreaterThan(0.5);
    expect(modifiers.droneProductionSpeedMultiplier).toBeGreaterThan(1);
    expect(modifiers.energyGenerationMultiplier).toBeGreaterThan(1);
  });
});
