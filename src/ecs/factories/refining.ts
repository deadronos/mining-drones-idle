/**
 * Factory refining process management.
 */

import type { BuildableFactory, RefineProcess } from './models';
import { FACTORY_CONFIG } from './config';

/**
 * Returns the number of available refine slots.
 *
 * @param factory - The factory.
 * @returns Number of free slots.
 */
export const getAvailableRefineSlots = (factory: BuildableFactory): number =>
  Math.max(0, factory.refineSlots - factory.activeRefines.length);

/**
 * Transfers ore from drone to factory storage.
 * Returns amount actually stored (capped by storage remaining).
 *
 * @param factory - The factory receiving the ore.
 * @param amount - The amount of ore to transfer.
 * @returns The actual amount accepted.
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
 *
 * @param factory - The factory to start refining in.
 * @param oreType - The type of ore (e.g., 'ore').
 * @param amount - The amount to refine.
 * @param processId - Unique ID for the new process.
 * @returns The new RefineProcess or null.
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
 *
 * @param factory - The factory owning the process.
 * @param process - The refine process to tick.
 * @param dt - Delta time in seconds.
 * @returns The amount of refined product produced in this tick.
 */
export const tickRefineProcess = (
  factory: BuildableFactory,
  process: RefineProcess,
  dt: number,
): number => {
  // Advance progress according to speed multiplier and return the amount of
  // refined output produced during this tick. Previously this function only
  // returned the full process.amount when the process completed which made
  // per-tick throughput appear as zero until completion. To provide a smooth
  // throughput metric (and more accurate accounting) we return the fraction of
  // the process.amount that finished during this tick (delta progress * amount).
  const adjustedDt = dt * process.speedMultiplier;
  const prevProgress = process.progress;
  const newProgress = Math.min(1, prevProgress + adjustedDt / process.timeTotal);
  const delta = Math.max(0, newProgress - prevProgress);
  process.progress = newProgress;

  const refinedThisTick = process.amount * delta;

  if (process.progress >= 1) {
    // Process completed: remove it from active list
    factory.activeRefines = factory.activeRefines.filter((p) => p.id !== process.id);
  }

  return refinedThisTick;
};

/**
 * Ensures at least one refine slot is allowed to run.
 * Under low energy, reduces speedMultiplier of active refines.
 * Returns true if at least one refine is active.
 *
 * @param factory - The factory.
 * @param energyAvailable - Current available energy.
 * @param energyCapacity - Maximum energy capacity.
 * @returns True if any refining is active.
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

/**
 * Derives the highest process sequence number from existing factories.
 * Used to resume ID generation after load.
 *
 * @param factories - List of factories to scan.
 * @returns Max sequence number found.
 */
export const deriveProcessSequence = (factories: BuildableFactory[]): number => {
  let maxSequence = 0;
  for (const factory of factories) {
    for (const process of factory.activeRefines) {
      const match = /-p(\d+)$/.exec(process.id);
      if (match) {
        const value = Number.parseInt(match[1] ?? '0', 10);
        if (Number.isFinite(value)) {
          maxSequence = Math.max(maxSequence, value);
        }
      }
    }
  }
  return maxSequence;
};
