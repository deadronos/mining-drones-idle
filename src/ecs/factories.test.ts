import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from 'three';
import {
  createFactory,
  computeFactoryCost,
  computeFactoryEnergyUpkeep,
  attemptDockDrone,
  removeDroneFromFactory,
  getDockedDroneCount,
  getAvailableDockingSlots,
  getAvailableRefineSlots,
  transferOreToFactory,
  startRefineProcess,
  tickRefineProcess,
  enforceMinOneRefining,
  computeFactoryEnergyDemand,
  findNearestAvailableFactory,
  detectUpgradeShortfall,
  type BuildableFactory,
} from './factories';

describe('Factory Entity', () => {
  let factory: BuildableFactory;

  beforeEach(() => {
    factory = createFactory('factory-1', new Vector3(0, 0, 0));
  });

  it('creates a factory with default properties', () => {
    expect(factory.id).toBe('factory-1');
    expect(factory.dockingCapacity).toBe(3);
    expect(factory.refineSlots).toBe(2);
    expect(factory.currentStorage).toBe(0);
    expect(factory.queuedDrones).toHaveLength(0);
    expect(factory.activeRefines).toHaveLength(0);
  });

  describe('Pricing & Energy', () => {
    it('computes factory cost with linear scaling', () => {
      const cost0 = computeFactoryCost(0);
      const cost1 = computeFactoryCost(1);
      const cost2 = computeFactoryCost(2);

      expect(cost0.metals).toBe(100);
      expect(cost1.metals).toBe(150);
      expect(cost2.metals).toBe(200);
    });

    it('computes energy upkeep linearly with factory count', () => {
      expect(computeFactoryEnergyUpkeep(0)).toBe(0);
      expect(computeFactoryEnergyUpkeep(1)).toBe(1);
      expect(computeFactoryEnergyUpkeep(5)).toBe(5);
    });

    it('computes energy demand including idle and active refines', () => {
      const demand = computeFactoryEnergyDemand(factory);
      expect(demand).toBe(1); // idle only

      factory.activeRefines.push({
        id: 'refine-1',
        oreType: 'ore',
        amount: 10,
        progress: 0,
        timeTotal: 10,
          energyRequired: 2,
        speedMultiplier: 1,
      });

      // energyPerRefine is 2 now: idle 1 + 2 active = 3
      expect(computeFactoryEnergyDemand(factory)).toBe(3);
    });
  });

  describe('Docking', () => {
    it('docks drones up to capacity', () => {
      expect(attemptDockDrone(factory, 'drone-1')).toBe('docking');
      expect(attemptDockDrone(factory, 'drone-2')).toBe('docking');
      expect(attemptDockDrone(factory, 'drone-3')).toBe('docking');
      expect(attemptDockDrone(factory, 'drone-4')).toBe('queued');
    });

    it('tracks docked drone count', () => {
      attemptDockDrone(factory, 'drone-1');
      attemptDockDrone(factory, 'drone-2');
      expect(getDockedDroneCount(factory)).toBe(2);
    });

    it('computes available docking slots', () => {
      expect(getAvailableDockingSlots(factory)).toBe(3);
      attemptDockDrone(factory, 'drone-1');
      expect(getAvailableDockingSlots(factory)).toBe(2);
    });

    it('removes drones from factory', () => {
      attemptDockDrone(factory, 'drone-1');
      attemptDockDrone(factory, 'drone-2');
      expect(getDockedDroneCount(factory)).toBe(2);
      removeDroneFromFactory(factory, 'drone-1');
      expect(getDockedDroneCount(factory)).toBe(1);
      expect(factory.queuedDrones).toEqual(['drone-2']);
    });
  });

  describe('Storage & Refining', () => {
    it('transfers ore to factory storage', () => {
      const transferred = transferOreToFactory(factory, 100);
      expect(transferred).toBe(100);
      expect(factory.currentStorage).toBe(100);
    });

    it('respects storage capacity', () => {
      transferOreToFactory(factory, 250);
      expect(factory.currentStorage).toBe(250);
      const overflow = transferOreToFactory(factory, 100);
      expect(overflow).toBe(50);
      expect(factory.currentStorage).toBe(300);
    });

    it('starts refine processes', () => {
      transferOreToFactory(factory, 100);
      const process = startRefineProcess(factory, 'ore', 50, 'refine-1');
      expect(process).not.toBeNull();
      expect(process?.amount).toBe(50);
      expect(factory.activeRefines).toHaveLength(1);
      expect(factory.currentStorage).toBe(50);
    });

    it('does not start refine if no ore available', () => {
      const process = startRefineProcess(factory, 'ore', 50, 'refine-1');
      expect(process).toBeNull();
      expect(factory.activeRefines).toHaveLength(0);
    });

    it('does not exceed refine slot limit', () => {
      transferOreToFactory(factory, 100);
      const p1 = startRefineProcess(factory, 'ore', 30, 'refine-1');
      const p2 = startRefineProcess(factory, 'ore', 30, 'refine-2');
      const p3 = startRefineProcess(factory, 'ore', 30, 'refine-3');
      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();
      expect(p3).toBeNull();
    });
  });

  describe('Refining Progression', () => {
    it('advances refine process progress', () => {
      transferOreToFactory(factory, 100);
      const process = startRefineProcess(factory, 'ore', 50, 'refine-1');
      expect(process).not.toBeNull();

      const output1 = tickRefineProcess(factory, process!, 5);
      expect(output1).toBe(0);
      expect(process?.progress).toBeCloseTo(0.5, 1);

      const output2 = tickRefineProcess(factory, process!, 5);
      expect(output2).toBe(50); // Completed
      expect(factory.activeRefines).toHaveLength(0);
    });

    it('applies speed multiplier', () => {
      transferOreToFactory(factory, 100);
      const process = startRefineProcess(factory, 'ore', 50, 'refine-1');
      expect(process).not.toBeNull();
      process!.speedMultiplier = 0.5;

      tickRefineProcess(factory, process!, 5);
      expect(process?.progress).toBeCloseTo(0.25, 1); // 5s * 0.5x / 10s
    });
  });

  describe('Energy-based Refining Constraints', () => {
    it('enforces min-1-running refining', () => {
      transferOreToFactory(factory, 100);
      startRefineProcess(factory, 'ore', 30, 'refine-1');
      startRefineProcess(factory, 'ore', 30, 'refine-2');

      const hasActive = enforceMinOneRefining(factory, 10, 100); // 10% energy
      expect(hasActive).toBe(true);
      expect(factory.activeRefines[0].speedMultiplier).toBeGreaterThan(0);
      expect(factory.activeRefines[1].speedMultiplier).toBe(0); // Other paused
    });

    it('normal speed when energy sufficient', () => {
      transferOreToFactory(factory, 100);
      startRefineProcess(factory, 'ore', 30, 'refine-1');
      startRefineProcess(factory, 'ore', 30, 'refine-2');

      enforceMinOneRefining(factory, 80, 100); // 80% energy
      factory.activeRefines.forEach((p) => {
        expect(p.speedMultiplier).toBe(1);
      });
    });
  });

  describe('Nearest Factory Assignment', () => {
    it('finds nearest available factory', () => {
      const f1 = createFactory('factory-1', new Vector3(0, 0, 0));
      const f2 = createFactory('factory-2', new Vector3(10, 0, 0));
      const f3 = createFactory('factory-3', new Vector3(5, 0, 0));

      const dronePos = new Vector3(3, 0, 0);
      const nearest = findNearestAvailableFactory([f1, f2, f3], dronePos);

      expect(nearest?.factory.id).toBe('factory-3'); // 2 units away
      expect(nearest?.distance).toBeCloseTo(2, 1);
    });

    it('returns null if no factories have capacity', () => {
      const f1 = createFactory('factory-1', new Vector3(0, 0, 0));
      attemptDockDrone(f1, 'drone-1');
      attemptDockDrone(f1, 'drone-2');
      attemptDockDrone(f1, 'drone-3');

      const nearest = findNearestAvailableFactory([f1], new Vector3(0, 0, 0));
      expect(nearest).toBeNull();
    });

    it('uses round-robin for equidistant factories', () => {
      const f1 = createFactory('factory-1', new Vector3(-1, 0, 0));
      const f2 = createFactory('factory-2', new Vector3(1, 0, 0));
      const dronePos = new Vector3(0, 0, 0);

      const result1 = findNearestAvailableFactory([f1, f2], dronePos, 0);
      const result2 = findNearestAvailableFactory([f1, f2], dronePos, 1);

      // Should alternate based on counter
      expect(result1?.factory.id).toBe('factory-1');
      expect(result2?.factory.id).toBe('factory-2');
    });
  });

  describe('Available Slots', () => {
    it('computes available refine slots', () => {
      expect(getAvailableRefineSlots(factory)).toBe(2);
      transferOreToFactory(factory, 100);
      startRefineProcess(factory, 'ore', 50, 'refine-1');
      expect(getAvailableRefineSlots(factory)).toBe(1);
    });
  });

  describe('Upgrade Request Detection', () => {
    it('detects shortfall for unaffordable upgrade', () => {
      // Factory has 10 metals, landing bay (docking) costs 40 metals
      factory.resources.metals = 10;
      const request = detectUpgradeShortfall(factory, ['docking']);

      expect(request).not.toBeNull();
      expect(request?.upgrade).toBe('docking');
      expect(request?.resourceNeeded.metals).toBe(40);
      expect(request?.status).toBe('pending');
    });

    it('returns null if resources sufficient', () => {
      // Docking costs 40 metals + 20 crystals
      factory.resources.metals = 50;
      factory.resources.crystals = 30;
      const request = detectUpgradeShortfall(factory, ['docking']);

      expect(request).toBeNull();
    });

    it('checks multiple upgrades in order', () => {
      factory.resources.metals = 25; // Not enough for docking (40) or refine (50)
      factory.resources.crystals = 10; // Not enough for either

      const request = detectUpgradeShortfall(factory, ['docking', 'refine']);

      // Should return first shortfall (docking)
      expect(request?.upgrade).toBe('docking');
    });

    it('skips upgrades with sufficient resources', () => {
      // Docking needs 40 metals + 20 crystals
      // Refine needs 50 metals + 30 crystals
      // Factory has 50 metals + 25 crystals - enough for docking, not refine
      factory.resources.metals = 50;
      factory.resources.crystals = 25; // Enough for docking (20), not for refine (30)

      const request = detectUpgradeShortfall(factory, ['docking', 'refine']);

      // Should return refine request (docking is skipped because fully affordable)
      expect(request?.upgrade).toBe('refine');
    });

    it('respects current upgrade level in cost calculation', () => {
      // Level 0 docking costs 40 metals
      // If factory had docking level 1, cost would be higher
      factory.upgrades.docking = 1;
      factory.resources.metals = 40; // Enough for level 0, not for level 1

      const request = detectUpgradeShortfall(factory, ['docking']);

      expect(request).not.toBeNull();
      expect(request?.resourceNeeded.metals).toBeGreaterThan(40);
    });

    it('does not create request if one already pending', () => {
      factory.resources.metals = 10;
      factory.upgradeRequests.push({
        upgrade: 'docking',
        resourceNeeded: { metals: 40 },
        fulfilledAmount: {},
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      });

      const request = detectUpgradeShortfall(factory, ['docking']);

      expect(request).toBeNull();
    });

    it('creates request with 60s expiration', () => {
      factory.resources.metals = 10;
      const before = Date.now();
      const request = detectUpgradeShortfall(factory, ['docking']);
      const after = Date.now();

      expect(request?.expiresAt).toBeGreaterThanOrEqual(before + 60000);
      expect(request?.expiresAt).toBeLessThanOrEqual(after + 60000);
    });

    it('includes all required resources in request', () => {
      factory.resources.metals = 20;
      factory.resources.crystals = 5;

      const request = detectUpgradeShortfall(factory, ['docking']);

      expect(request?.resourceNeeded.metals).toBe(40);
      expect(request?.resourceNeeded.crystals).toBe(20);
      expect(request?.fulfilledAmount).toEqual({});
    });

    it('returns null for empty upgrade list', () => {
      const request = detectUpgradeShortfall(factory, []);
      expect(request).toBeNull();
    });
  });
});
