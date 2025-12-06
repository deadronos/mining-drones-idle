/**
 * Configuration for resource balance and prestige scaling.
 * Defines caps and scaling factors for different resource types.
 */

export interface ResourceBalanceEntry {
  /** The base capacity multiplier for the resource. */
  cap: number;
  /** The scaling factor for resource generation/accumulation. */
  scale: number;
}

/**
 * Supported resource types that have balance configurations.
 */
export type BalancedResource = 'metals' | 'crystals' | 'organics' | 'ice';

/**
 * Base values for resource balance without any prestige bonuses applied.
 * Contains default cap and scale values for each balanced resource type.
 */
export const RESOURCE_BALANCE: Record<BalancedResource, ResourceBalanceEntry> = {
  metals: { cap: 0.3, scale: 1000 },
  crystals: { cap: 0.25, scale: 5000 },
  organics: { cap: 0.4, scale: 8000 },
  ice: { cap: 0.35, scale: 6000 },
};

/**
 * Compute dynamic resource balance entry based on prestige cores.
 * Each core increases cap by 0.5% and decreases scale by 1% (tighter saturation).
 *
 * @param base - The base resource balance entry.
 * @param cores - The number of prestige cores (defaults to 0).
 * @returns A new ResourceBalanceEntry with applied bonuses.
 */
export const getBalanceWithPrestige = (
  base: ResourceBalanceEntry,
  cores = 0,
): ResourceBalanceEntry => {
  const capBonus = Math.pow(1.005, cores);
  const scaleReduction = Math.pow(0.99, cores);
  return {
    cap: base.cap * capBonus,
    scale: base.scale * scaleReduction,
  };
};

/** Factor reducing energy regeneration when using organic fuel. */
export const ORGANICS_ENERGY_REGEN_FACTOR = 0.6;
/** Factor increasing drone output when boosted by organics. */
export const ORGANICS_DRONE_OUTPUT_FACTOR = 1.2;
/** Factor reducing drain rate for ice-based cooling. */
export const ICE_DRAIN_REDUCTION_FACTOR = 0.5;
