import { FACTORY_CONFIG } from '@/ecs/factories';
import type { RefineProcess } from '@/ecs/factories';
import type {
  RefineProcessSnapshot,
  FactoryResourceSnapshot,
  FactoryUpgradeSnapshot,
} from '../types';
import { coerceNumber } from '../utils';

export const normalizeFactoryResources = (value: unknown): FactoryResourceSnapshot => {
  if (typeof value !== 'object' || value === null) {
    return {
      ore: 0,
      bars: 0,
      metals: 0,
      crystals: 0,
      organics: 0,
      ice: 0,
      credits: 0,
    };
  }
  const raw = value as Partial<FactoryResourceSnapshot>;
  return {
    ore: Math.max(0, coerceNumber(raw.ore, 0)),
    bars: Math.max(0, coerceNumber(raw.bars, 0)),
    metals: Math.max(0, coerceNumber(raw.metals, 0)),
    crystals: Math.max(0, coerceNumber(raw.crystals, 0)),
    organics: Math.max(0, coerceNumber(raw.organics, 0)),
    ice: Math.max(0, coerceNumber(raw.ice, 0)),
    credits: Math.max(0, coerceNumber(raw.credits, 0)),
  };
};

export const normalizeFactoryUpgrades = (value: unknown): FactoryUpgradeSnapshot => {
  if (typeof value !== 'object' || value === null) {
    return { docking: 0, refine: 0, storage: 0, energy: 0, solar: 0 };
  }
  const raw = value as Partial<FactoryUpgradeSnapshot>;
  return {
    docking: Math.max(0, Math.floor(coerceNumber(raw.docking, 0))),
    refine: Math.max(0, Math.floor(coerceNumber(raw.refine, 0))),
    storage: Math.max(0, Math.floor(coerceNumber(raw.storage, 0))),
    energy: Math.max(0, Math.floor(coerceNumber(raw.energy, 0))),
    solar: Math.max(0, Math.floor(coerceNumber(raw.solar, 0))),
  };
};

export const normalizeDroneOwners = (value: unknown): Record<string, string | null> => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const result: Record<string, string | null> = {};
  for (const [key, owner] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string') {
      continue;
    }
    result[key] = typeof owner === 'string' && owner.length > 0 ? owner : null;
  }
  return result;
};

export const normalizeRefineSnapshot = (value: unknown): RefineProcessSnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<RefineProcessSnapshot>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    return null;
  }
  if (typeof raw.oreType !== 'string' || raw.oreType.length === 0) {
    return null;
  }
  const amount = Math.max(0, coerceNumber(raw.amount, 0));
  const timeTotal = Math.max(0.01, coerceNumber(raw.timeTotal, FACTORY_CONFIG.refineTime));
  const progress = Math.min(1, Math.max(0, coerceNumber(raw.progress, 0)));
  const energyRequired = Math.max(
    0,
    coerceNumber(raw.energyRequired, FACTORY_CONFIG.energyPerRefine),
  );
  const speedMultiplier = Math.max(0, coerceNumber(raw.speedMultiplier, 1));
  return {
    id: raw.id,
    oreType: raw.oreType,
    amount,
    progress,
    timeTotal,
    energyRequired,
    speedMultiplier,
  };
};

/**
 * Internal helper: creates a shallow copy of an object with RefineProcess shape.
 * Used by all three public functions since RefineProcess and RefineProcessSnapshot
 * have identical structure.
 */
const copyRefineProcessShape = <T extends RefineProcess | RefineProcessSnapshot>(source: T): T =>
  ({
    id: source.id,
    oreType: source.oreType,
    amount: source.amount,
    progress: source.progress,
    timeTotal: source.timeTotal,
    energyRequired: source.energyRequired,
    speedMultiplier: source.speedMultiplier,
  }) as T;

export const refineProcessToSnapshot = (process: RefineProcess): RefineProcessSnapshot =>
  copyRefineProcessShape(process);

/**
 * Creates a shallow copy of a refine process.
 */
export const cloneRefineProcess = (process: RefineProcess): RefineProcess =>
  copyRefineProcessShape(process);

/**
 * Converts snapshot to RefineProcess.
 * Since RefineProcess and RefineProcessSnapshot have identical structure,
 * this is effectively a shallow copy operation.
 */
export const snapshotToRefineProcess = (snapshot: RefineProcessSnapshot): RefineProcess =>
  copyRefineProcessShape(snapshot);
