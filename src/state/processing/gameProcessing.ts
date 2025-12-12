import type { StoreState, Resources } from '../types';
import type { BuildableFactory } from '@/ecs/factories';
import { enforceMinOneRefining, startRefineProcess, tickRefineProcess } from '@/ecs/factories';
import { getResourceModifiers } from '@/lib/resourceModifiers';
import { getFactoryEffectiveEnergyCapacity } from '@/state/utils';
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
interface FactoryTickTelemetry {
  barsProduced: number;
  oreConsumed: number;
  energySpent: number;
}

export function processFactories(
  state: StoreState,
  dt: number,
): {
  factories: BuildableFactory[];
  resources: Resources;
  factoryProcessSequence: number;
  metrics: Record<string, FactoryTickTelemetry>;
} {
  if (dt <= 0 || state.factories.length === 0) {
    return {
      factories: state.factories,
      resources: state.resources,
      factoryProcessSequence: state.factoryProcessSequence,
      metrics: {},
    };
  }

  let processesStarted = 0;
  let remainingEnergy = Math.max(0, state.resources.energy);
  // Global modifiers (based on warehouse/global resources)
  const modifiers = getResourceModifiers(state.resources, state.prestige.cores);
  const solarArrayLevel = state.modules?.solar ?? 0;
  const metrics: Record<string, FactoryTickTelemetry> = {};

  const updatedFactories = state.factories.map((factory) => {
    const working = cloneFactory(factory);
    let barsProduced = 0;
    let oreConsumed = 0;
    let energySpent = 0;

    // Local-first: Factories consume their local energy for idle, haulers, and refining.
    // No proactive pull from global; factories sit at zero if depleted.
    // (Drones fall back to global charging via power system if factory is empty.)

    // Apply idle energy drain (local) adjusted by energy drain modifier
    const idleDrain = working.idleEnergyPerSec * dt * (modifiers?.energyDrainMultiplier ?? 1);
    if (idleDrain > 0) {
      const before = working.energy;
      working.energy = Math.max(0, working.energy - idleDrain);
      energySpent += before - working.energy;
    }

    // Apply hauler maintenance drain (local)
    const haulerDrain =
      (working.haulersAssigned ?? 0) > 0
        ? computeHaulerMaintenanceCost(working.haulersAssigned ?? 0) * dt * (modifiers?.energyDrainMultiplier ?? 1)
        : 0;
    if (haulerDrain > 0) {
      const before = working.energy;
      working.energy = Math.max(0, working.energy - haulerDrain);
      energySpent += before - working.energy;
    }

    // Start new refining processes if possible
    // Determine effective storage capacity (mods can boost storage)
    const effectiveStorageCapacity =
      working.storageCapacity * (modifiers?.storageCapacityMultiplier ?? 1);

    while (
      working.resources.ore > 0 &&
      working.activeRefines.length < working.refineSlots &&
      working.energy > 0
    ) {
      const slotTarget = Math.max(1, working.refineSlots);
      const batchSize = Math.min(
        working.resources.ore,
        Math.max(10, effectiveStorageCapacity / slotTarget),
      );
      const processId = `${working.id}-p${state.factoryProcessSequence + processesStarted + 1}`;
      const started = startRefineProcess(working, 'ore', batchSize, processId);
      if (!started) {
        break;
      }
      // Apply factory-local production speed modifier (organics -> production speed)
      started.speedMultiplier = (started.speedMultiplier ?? 1) * (modifiers?.droneProductionSpeedMultiplier ?? 1);
      processesStarted += 1;
      oreConsumed += started.amount;
    }

    // Enforce at least one refining if possible (use effective energy capacity with modifiers)
    if (working.activeRefines.length > 0) {
      const effectiveEnergyCapacity = getFactoryEffectiveEnergyCapacity(
        working,
        solarArrayLevel,
        modifiers,
      );
      enforceMinOneRefining(working, working.energy, effectiveEnergyCapacity);
    }

    // Progress refining processes (consume local energy)
    for (let i = working.activeRefines.length - 1; i >= 0; i -= 1) {
      const process = working.activeRefines[i];
      // Apply energy drain modifier to per-refine energy consumption
      const drain = working.energyPerRefine * dt * (process.speedMultiplier ?? 1) * (modifiers?.energyDrainMultiplier ?? 1);
      const consumed = Math.min(drain, working.energy);
      working.energy = Math.max(0, working.energy - consumed);
      energySpent += consumed;
      // Tick; refinedThisTick is fraction of process.amount
      const refined = tickRefineProcess(working, process, dt);
      if (refined > 0) {
        // Apply refinery yield modifier (crystals -> yield)
        const finalRefined = refined * (modifiers?.refineryYieldMultiplier ?? 1);
        working.resources.bars += finalRefined;
        barsProduced += finalRefined;
      }
    }

    // Update storage tracking
    working.currentStorage = working.resources.ore;

    metrics[working.id] = {
      barsProduced,
      oreConsumed,
      energySpent,
    };

    return working;
  });

  const resources = {
    ...state.resources,
    energy: remainingEnergy,
  };

  return {
    factories: updatedFactories,
    resources,
    factoryProcessSequence: state.factoryProcessSequence + processesStarted,
    metrics,
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

export type { FactoryTickTelemetry };
