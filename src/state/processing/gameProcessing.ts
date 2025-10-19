import type { StoreState, Resources } from '../types';
import type { BuildableFactory } from '@/ecs/factories';
import {
  enforceMinOneRefining,
  startRefineProcess,
  tickRefineProcess,
} from '@/ecs/factories';
import { computeHaulerMaintenanceCost } from '@/ecs/logistics';
import { computeRefineryProduction, applyRefineryProduction } from '../utils';
import { cloneFactory } from '../serialization';

/**
 * Pure function to process refinery production.
 * Returns the new state slice containing updated resources and refinery stats.
 */
export function processRefinery(
  state: StoreState,
  dt: number,
): { resources: Resources; refineryStats: { oreConsumed: number; barsProduced: number } } {
  if (dt <= 0) {
    return { resources: state.resources, refineryStats: { oreConsumed: 0, barsProduced: 0 } };
  }

  const stats = computeRefineryProduction(state, dt);
  if (stats.oreConsumed <= 0 && stats.barsProduced <= 0) {
    return { resources: state.resources, refineryStats: stats };
  }

  const updatedState = applyRefineryProduction(state, stats);
  return {
    resources: updatedState.resources,
    refineryStats: stats,
  };
}

/**
 * Pure function to process all factories in the game loop.
 * Handles energy distribution, drains, refining processes, and bar production.
 * Returns the new state slice with updated factories and resources.
 */
export function processFactories(
  state: StoreState,
  dt: number,
): { factories: BuildableFactory[]; resources: Resources; factoryProcessSequence: number } {
  if (dt <= 0 || state.factories.length === 0) {
    return {
      factories: state.factories,
      resources: state.resources,
      factoryProcessSequence: state.factoryProcessSequence,
    };
  }

  let processesStarted = 0;
  let remainingEnergy = Math.max(0, state.resources.energy);
  let totalBarsProduced = 0;

  const updatedFactories = state.factories.map((factory) => {
    const working = cloneFactory(factory);

    // Pull energy from global pool
    const energyNeeded = Math.max(0, working.energyCapacity - working.energy);
    if (energyNeeded > 0 && remainingEnergy > 0) {
      const pulled = Math.min(energyNeeded, remainingEnergy);
      working.energy += pulled;
      remainingEnergy -= pulled;
    }

    // Apply idle energy drain
    const idleDrain = working.idleEnergyPerSec * dt;
    if (idleDrain > 0) {
      working.energy = Math.max(0, working.energy - idleDrain);
    }

    // Import computeHaulerMaintenanceCost if needed
    // Apply hauler maintenance drain
    const haulerDrain =
      (working.haulersAssigned ?? 0) > 0
        ? computeHaulerMaintenanceCost(working.haulersAssigned ?? 0) * dt
        : 0;
    if (haulerDrain > 0) {
      working.energy = Math.max(0, working.energy - haulerDrain);
    }

    // Start new refining processes if possible
    while (
      working.resources.ore > 0 &&
      working.activeRefines.length < working.refineSlots &&
      working.energy > 0
    ) {
      const slotTarget = Math.max(1, working.refineSlots);
      const batchSize = Math.min(
        working.resources.ore,
        Math.max(10, working.storageCapacity / slotTarget),
      );
      const processId = `${working.id}-p${state.factoryProcessSequence + processesStarted + 1}`;
      const started = startRefineProcess(working, 'ore', batchSize, processId);
      if (!started) {
        break;
      }
      processesStarted += 1;
    }

    // Enforce at least one refining if possible
    if (working.activeRefines.length > 0) {
      enforceMinOneRefining(working, working.energy, working.energyCapacity);
    }

    // Progress refining processes
    for (let i = working.activeRefines.length - 1; i >= 0; i -= 1) {
      const process = working.activeRefines[i];
      const drain = working.energyPerRefine * dt * process.speedMultiplier;
      const consumed = Math.min(drain, working.energy);
      working.energy = Math.max(0, working.energy - consumed);
      const refined = tickRefineProcess(working, process, dt);
      if (refined > 0) {
        working.resources.bars += refined;
        totalBarsProduced += refined;
      }
    }

    // Update storage tracking
    working.currentStorage = working.resources.ore;

    return working;
  });

  const resources = {
    ...state.resources,
    energy: remainingEnergy,
    bars: state.resources.bars + totalBarsProduced,
  };

  return {
    factories: updatedFactories,
    resources,
    factoryProcessSequence: state.factoryProcessSequence + processesStarted,
  };
}

/**
 * Orchestrates the game loop tick: refinery → logistics → factories
 */
export function tick(state: StoreState, dt: number) {
  if (dt <= 0) return;

  const refineryResult = processRefinery(state, dt);
  const stateAfterRefinery = { ...state, resources: refineryResult.resources };

  const factoryResult = processFactories(stateAfterRefinery, dt);

  return {
    gameTime: state.gameTime + dt,
    resources: factoryResult.resources,
    factories: factoryResult.factories,
    factoryProcessSequence: factoryResult.factoryProcessSequence,
  };
}
