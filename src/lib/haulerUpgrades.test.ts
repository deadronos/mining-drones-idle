import { describe, it, expect } from 'vitest';
import {
  getHaulerModuleBonuses,
  resolveFactoryHaulerConfig,
  getHaulerModuleCost,
  getFactoryHaulerUpgradeCost,
} from './haulerUpgrades';

import type { Modules, FactoryHaulerUpgrades, HaulerConfig } from '@/state/store';

const baseModules: Modules = {
  droneBay: 1,
  refinery: 0,
  storage: 0,
  solar: 0,
  scanner: 0,
  haulerDepot: 0,
  logisticsHub: 0,
  routingProtocol: 0,
};

const baseConfig: HaulerConfig = {
  capacity: 50,
  speed: 1,
  pickupOverhead: 1,
  dropoffOverhead: 1,
  resourceFilters: [],
  mode: 'auto',
  priority: 5,
};

describe('lib/haulerUpgrades', () => {
  it('computes module bonuses with scaling', () => {
    const modules = { ...baseModules, haulerDepot: 2, logisticsHub: 1, routingProtocol: 3 };
    const bonuses = getHaulerModuleBonuses(modules);
    expect(bonuses.capacityBonus).toBe(20);
    expect(bonuses.speedMultiplier).toBeCloseTo(1.1);
    expect(bonuses.pickupOverheadMultiplier).toBeCloseTo(0.9);
    expect(bonuses.routingEfficiencyBonus).toBeCloseTo(0.06);
  });

  it('resolves factory config with module and per-factory upgrades', () => {
    const modules = { ...baseModules, haulerDepot: 1, logisticsHub: 2 };
    const upgrades: FactoryHaulerUpgrades = { capacityBoost: 2, speedBoost: 1, efficiencyBoost: 1 };
    const resolved = resolveFactoryHaulerConfig({ baseConfig, modules, upgrades });
    expect(resolved.capacity).toBeCloseTo(50 + 10 + 10); // base + depot + capacity boost
    expect(resolved.speed).toBeCloseTo(1 * 1.05 + 0.1);
    expect(resolved.pickupOverhead).toBeLessThan(1);
    expect(resolved.dropoffOverhead).toBeLessThan(1);
  });

  it('computes next costs for global and factory upgrades', () => {
    const depotCost = getHaulerModuleCost('haulerDepot', 1);
    expect(depotCost.metals).toBeGreaterThan(0);
    const factoryCost = getFactoryHaulerUpgradeCost('capacityBoost', 1);
    expect(factoryCost.metals).toBeGreaterThan(0);
  });
});
