/**
 * Factory module barrel export.
 * Re-exports all factory types and utilities for convenient importing.
 */

// Types
export type {
  RefineProcess,
  FactoryUpgradeRequest,
  FactoryResources,
  FactoryUpgrades,
  BuildableFactory,
} from './models';

// Models and factory creation
export { createFactory } from './models';
export type { DockingResult } from './docking';

// Configuration and costs
export {
  FACTORY_CONFIG,
  computeFactoryCost,
  computeFactoryEnergyUpkeep,
  computeUpgradeCost,
} from './config';

// Docking operations
export {
  attemptDockDrone,
  removeDroneFromFactory,
  getDockedDroneCount,
  getAvailableDockingSlots,
} from './docking';

// Refining operations
export {
  getAvailableRefineSlots,
  transferOreToFactory,
  startRefineProcess,
  tickRefineProcess,
  enforceMinOneRefining,
} from './refining';

// Energy management
export { computeFactoryEnergyDemand } from './energy';

// Routing and placement
export { findNearestAvailableFactory, computeDistance } from './routing';

// Upgrade management
export { detectUpgradeShortfall } from './upgrades';
