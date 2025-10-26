/**
 * Factory energy management and demand calculations.
 */

import type { BuildableFactory } from './models';

/**
 * Computes the total energy demand for a factory in its current state.
 * Includes idle drain and per-active-refine costs.
 */
export const computeFactoryEnergyDemand = (factory: BuildableFactory): number => {
  const idleDrain = factory.idleEnergyPerSec;
  const activeRefineCost = factory.activeRefines.length * factory.energyPerRefine;
  return idleDrain + activeRefineCost;
};
