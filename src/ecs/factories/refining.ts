/**
 * Factory refining process management.
 */

import type { BuildableFactory, RefineProcess } from './models';
import { FACTORY_CONFIG } from './config';

/**
 * Returns the number of available refine slots.
 */
export const getAvailableRefineSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.refineSlots - factory.activeRefines.length);

/**
 * Transfers ore from drone to factory storage.
 * Returns amount actually stored (capped by storage remaining).
 */
export const transferOreToFactory = (factory: BuildableFactory, amount: number): number => {
  const available = factory.storageCapacity - factory.resources.ore;
  const transferred = Math.min(amount, available);
  if (transferred <= 0) {
    return 0;
  }
  factory.resources.ore += transferred;
  factory.currentStorage = factory.resources.ore;
  return transferred;
};

/**
 * Starts a refine process if conditions are met.
 * Returns the created RefineProcess or null if unable to start.
 */
export const startRefineProcess = (
  factory: BuildableFactory,
  oreType: string,
  amount: number,
  processId: string,
): RefineProcess | null => {
  if (factory.activeRefines.length >= factory.refineSlots) {
    return null; // All slots occupied
  }
  if (factory.resources.ore <= 0 || amount <= 0) {
    return null; // No ore to refine
  }

  const toRefine = Math.min(amount, factory.resources.ore);
  const process: RefineProcess = {
    id: processId,
    oreType,
    amount: toRefine,
    progress: 0,
    timeTotal: FACTORY_CONFIG.refineTime,
    energyRequired: FACTORY_CONFIG.energyPerRefine,
    speedMultiplier: 1,
  };

  factory.activeRefines.push(process);
  factory.resources.ore = Math.max(0, factory.resources.ore - toRefine);
  factory.currentStorage = factory.resources.ore;
  return process;
};

/**
 * Advances a refine process by dt seconds.
 * Returns the amount of refined output if completed (and removes from active).
 * Applies speedMultiplier to the time increment.
 */
export const tickRefineProcess = (
  factory: BuildableFactory,
  process: RefineProcess,
  dt: number,
): number => {
  const adjustedDt = dt * process.speedMultiplier;
  process.progress = Math.min(1, process.progress + adjustedDt / process.timeTotal);

  if (process.progress >= 1) {
    // Refine completed
    factory.activeRefines = factory.activeRefines.filter((p) => p.id !== process.id);
    return process.amount; // Return refined amount
  }

  return 0;
};

/**
 * Ensures at least one refine slot is allowed to run.
 * Under low energy, reduces speedMultiplier of active refines.
 * Returns true if at least one refine is active.
 */
export const enforceMinOneRefining = (
  factory: BuildableFactory,
  energyAvailable: number,
  energyCapacity: number,
): boolean => {
  if (factory.activeRefines.length === 0) {
    return false;
  }

  // Compute energy fraction (0..1)
  const energyFraction = energyCapacity > 0 ? Math.max(0, energyAvailable / energyCapacity) : 0;

  // Under low energy, reduce speed; but ensure at least one runs
  if (energyFraction < 0.2 && factory.activeRefines.length > 0) {
    // Low energy: run one at reduced speed, pause others
    factory.activeRefines[0].speedMultiplier = Math.max(0.1, energyFraction * 2); // 0.1x..0.4x
    for (let i = 1; i < factory.activeRefines.length; i += 1) {
      factory.activeRefines[i].speedMultiplier = 0; // Paused
    }
  } else {
    // Normal energy: all can run at normal speed
    factory.activeRefines.forEach((p) => {
      p.speedMultiplier = 1;
    });
  }

  return true;
};
