export interface ResourceBalanceEntry {
  cap: number;
  scale: number;
}

export type BalancedResource = 'metals' | 'crystals' | 'organics' | 'ice';

export const RESOURCE_BALANCE: Record<BalancedResource, ResourceBalanceEntry> = {
  metals: { cap: 0.3, scale: 10 },
  crystals: { cap: 0.25, scale: 5 },
  organics: { cap: 0.4, scale: 8 },
  ice: { cap: 0.35, scale: 6 },
};

export const ORGANICS_ENERGY_REGEN_FACTOR = 0.6;
export const ORGANICS_DRONE_OUTPUT_FACTOR = 1.2;
export const ICE_DRAIN_REDUCTION_FACTOR = 0.5;
