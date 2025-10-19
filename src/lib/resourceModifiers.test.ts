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
  it('applies diminishing returns with soft caps', () => {
    const low = getResourceModifiers(
      buildResources({ metals: 5, ice: 3, crystals: 2, organics: 4 }),
    );
    const high = getResourceModifiers(
      buildResources({
        metals: 6000,
        ice: 40000,
        crystals: 30000,
        organics: 50000,
      }),
    );
    const veryHigh = getResourceModifiers(
      buildResources({
        metals: 12000,
        ice: 80000,
        crystals: 60000,
        organics: 100000,
      }),
    );

    expect(low.metalsBonus).toBeGreaterThan(0);
    expect(low.metalsBonus).toBeLessThan(0.3);
    // High amounts should exceed hard caps due to soft cap overflow bonus
    expect(high.metalsBonus).toBeGreaterThan(0.3);
    expect(high.crystalsBonus).toBeGreaterThan(0.25);
    expect(high.iceBonus).toBeGreaterThan(0.35);
    expect(high.organicsBonus).toBeGreaterThan(0.4);
    // Very high amounts should continue to increase (soft cap, no hard ceiling)
    expect(veryHigh.metalsBonus).toBeGreaterThan(high.metalsBonus);
    expect(veryHigh.crystalsBonus).toBeGreaterThan(high.crystalsBonus);
    expect(veryHigh.iceBonus).toBeGreaterThan(high.iceBonus);
    expect(veryHigh.organicsBonus).toBeGreaterThan(high.organicsBonus);
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

  it('increases bonuses with prestige cores', () => {
    const resources = buildResources({ metals: 20, crystals: 10, organics: 15, ice: 18 });
    const baseModifiers = getResourceModifiers(resources, 0);
    const prestigeModifiers = getResourceModifiers(resources, 50);

    expect(prestigeModifiers.metalsBonus).toBeGreaterThan(baseModifiers.metalsBonus);
    expect(prestigeModifiers.crystalsBonus).toBeGreaterThan(baseModifiers.crystalsBonus);
    expect(prestigeModifiers.organicsBonus).toBeGreaterThan(baseModifiers.organicsBonus);
    expect(prestigeModifiers.iceBonus).toBeGreaterThan(baseModifiers.iceBonus);
  });
});
