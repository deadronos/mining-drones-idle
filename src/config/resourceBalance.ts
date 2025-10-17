export interface ResourceBalanceEntry {
  cap: number;
  scale: number;
}

export type BalancedResource = 'metals' | 'crystals' | 'organics' | 'ice';

// Base values without prestige bonuses
export const RESOURCE_BALANCE: Record<BalancedResource, ResourceBalanceEntry> = {
  metals: { cap: 0.3, scale: 10 },
  crystals: { cap: 0.25, scale: 5 },
  organics: { cap: 0.4, scale: 8 },
  ice: { cap: 0.35, scale: 6 },
};

/**
 * Compute dynamic resource balance entry based on prestige cores.
 * Each core increases cap by 0.5% and decreases scale by 1% (tighter saturation).
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

export const ORGANICS_ENERGY_REGEN_FACTOR = 0.6;
export const ORGANICS_DRONE_OUTPUT_FACTOR = 1.2;
export const ICE_DRAIN_REDUCTION_FACTOR = 0.5;
