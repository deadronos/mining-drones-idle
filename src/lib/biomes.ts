import type { RandomSource } from '@/lib/rng';

/** Unique identifier for a biome type. */
export type BiomeId = 'ice' | 'metalRich' | 'crystal' | 'organic';

/** Unique identifier for a hazard type. */
export type HazardId = 'ionStorm' | 'solarFlare' | 'sporeBurst' | 'microQuakes';
/** Severity level of a hazard. */
export type HazardSeverity = 'low' | 'medium' | 'high';

/**
 * Defines a hazard that can occur within a biome.
 */
export interface HazardDefinition {
  /** Unique ID of the hazard. */
  id: HazardId;
  /** Probability weight of this hazard occurring. */
  weight: number;
  /** Severity of the hazard event. */
  severity: HazardSeverity;
}

/**
 * Defines the distribution of resources within a biome.
 * Values are relative weights, normalized during generation.
 */
export interface ResourceWeights {
  ore: number;
  metals: number;
  crystals: number;
  organics: number;
  ice: number;
}

/**
 * Configuration for a specific biome type.
 */
export interface BiomeDefinition {
  /** Unique ID. */
  id: BiomeId;
  /** Display name. */
  name: string;
  /** Color palette for UI/visuals. */
  palette: { primary: string; secondary: string };
  /** Tint color for particle effects. */
  particleTint: string;
  /** Gravity multiplier applied to entities in this biome. */
  gravityMultiplier: number;
  /** Resource distribution profile. */
  resourceWeights: ResourceWeights;
  /** List of potential hazards. */
  hazardProfile: HazardDefinition[];
  /** Flavour text description. */
  description: string;
}

/** List of valid resource keys. */
export const RESOURCE_KEYS = ['ore', 'metals', 'crystals', 'organics', 'ice'] as const;
/** Union type of resource keys. */
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

const BIOME_DEFINITIONS: Record<BiomeId, BiomeDefinition> = {
  ice: {
    id: 'ice',
    name: 'Ice Fracture',
    palette: { primary: '#7dd3fc', secondary: '#bae6fd' },
    particleTint: '#dbeafe',
    gravityMultiplier: 0.9,
    resourceWeights: { ore: 0.6, metals: 0.2, crystals: 0.1, organics: 0.05, ice: 1 },
    hazardProfile: [
      { id: 'ionStorm', weight: 2, severity: 'medium' },
      { id: 'microQuakes', weight: 1, severity: 'low' },
    ],
    description: 'Frozen crust with volatile ice pockets and low gravity.',
  },
  metalRich: {
    id: 'metalRich',
    name: 'Ferric Mantle',
    palette: { primary: '#f97316', secondary: '#fb923c' },
    particleTint: '#fed7aa',
    gravityMultiplier: 1.25,
    resourceWeights: { ore: 1, metals: 1.2, crystals: 0.15, organics: 0.05, ice: 0.1 },
    hazardProfile: [
      { id: 'solarFlare', weight: 3, severity: 'medium' },
      { id: 'microQuakes', weight: 2, severity: 'high' },
    ],
    description: 'Dense metallic deposits with increased gravity pull and thermal surges.',
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Bloom',
    palette: { primary: '#a855f7', secondary: '#d8b4fe' },
    particleTint: '#f5d0fe',
    gravityMultiplier: 1.05,
    resourceWeights: { ore: 0.7, metals: 0.3, crystals: 1.3, organics: 0.05, ice: 0.15 },
    hazardProfile: [
      { id: 'solarFlare', weight: 1, severity: 'low' },
      { id: 'ionStorm', weight: 2, severity: 'high' },
    ],
    description: 'Iridescent crystal veins with resonant energy surges.',
  },
  organic: {
    id: 'organic',
    name: 'Bio-Lattice',
    palette: { primary: '#4ade80', secondary: '#bbf7d0' },
    particleTint: '#bef264',
    gravityMultiplier: 0.82,
    resourceWeights: { ore: 0.5, metals: 0.15, crystals: 0.1, organics: 1.2, ice: 0.35 },
    hazardProfile: [
      { id: 'sporeBurst', weight: 3, severity: 'medium' },
      { id: 'ionStorm', weight: 1, severity: 'low' },
    ],
    description: 'Biological growths with flexible structure and low gravity pockets.',
  },
};

/** Default biome ID used as fallback. */
export const DEFAULT_BIOME_ID: BiomeId = 'metalRich';
/** List of all available biome IDs. */
export const BIOME_IDS: BiomeId[] = Object.keys(BIOME_DEFINITIONS) as BiomeId[];

const clampGravity = (value: number) => Math.min(1.5, Math.max(0.5, value));

/**
 * Retrieves the definition for a given biome ID.
 * Clamps gravity values to safe ranges.
 *
 * @param id - The biome ID to look up.
 * @returns The biome definition.
 */
export const getBiomeDefinition = (id: BiomeId): BiomeDefinition => {
  const biome = BIOME_DEFINITIONS[id] ?? BIOME_DEFINITIONS[DEFAULT_BIOME_ID];
  return { ...biome, gravityMultiplier: clampGravity(biome.gravityMultiplier) };
};

/**
 * Returns a list of all biome definitions.
 *
 * @returns Array of BiomeDefinition.
 */
export const listBiomes = (): BiomeDefinition[] => BIOME_IDS.map((id) => getBiomeDefinition(id));

/**
 * Normalizes a resource weight object so values sum to 1.
 *
 * @param weights - The resource weights to normalize.
 * @returns A new ResourceWeights object with normalized values.
 */
export const normalizeResourceWeights = (weights: ResourceWeights): ResourceWeights => {
  const entries = Object.entries(weights) as [ResourceKey, number][];
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  if (!isFinite(total) || total <= 0) {
    return { ore: 1, metals: 0, crystals: 0, organics: 0, ice: 0 };
  }
  const normalized = entries.reduce((acc, [key, value]) => {
    acc[key] = Math.max(0, value) / total;
    return acc;
  }, {} as ResourceWeights);
  return normalized;
};

/**
 * Determines the dominant resource in a weight profile.
 *
 * @param weights - The resource weights to analyze.
 * @returns The key of the resource with the highest weight.
 */
export const getDominantResource = (weights: ResourceWeights): ResourceKey => {
  let dominant: ResourceKey = 'ore';
  let highest = -Infinity;
  for (const key of Object.keys(weights) as ResourceKey[]) {
    const value = weights[key];
    if (value > highest) {
      dominant = key;
      highest = value;
    }
  }
  return dominant;
};

/**
 * Options for selecting a biome.
 */
export interface BiomeSelectionOptions {
  /** Optional bias to increase/decrease likelihood of specific biomes. */
  bias?: Partial<Record<BiomeId, number>>;
}

/**
 * Randomly selects a biome based on weighted probability.
 *
 * @param rng - Random number source.
 * @param options - Selection options (bias).
 * @returns The selected BiomeDefinition.
 */
export const chooseBiome = (
  rng: RandomSource,
  options: BiomeSelectionOptions = {},
): BiomeDefinition => {
  const definitions = listBiomes();
  let total = 0;
  const weighted = definitions.map((biome) => {
    const bias = Math.max(0, options.bias?.[biome.id] ?? 1);
    const weight = bias;
    total += weight;
    return { biome, weight };
  });
  if (total <= 0) {
    return getBiomeDefinition(DEFAULT_BIOME_ID);
  }
  const roll = rng.next() * total;
  let acc = 0;
  for (const entry of weighted) {
    acc += entry.weight;
    if (roll <= acc) {
      return entry.biome;
    }
  }
  return weighted.at(-1)?.biome ?? getBiomeDefinition(DEFAULT_BIOME_ID);
};

/**
 * Rolls for a random hazard event based on the biome's hazard profile.
 *
 * @param rng - Random number source.
 * @param biome - The biome definition.
 * @returns A selected HazardDefinition or null if none occur.
 */
export const rollHazard = (rng: RandomSource, biome: BiomeDefinition): HazardDefinition | null => {
  const { hazardProfile } = biome;
  if (!hazardProfile.length) return null;
  let total = 0;
  const normalized = hazardProfile.map((hazard) => {
    const weight = Math.max(0, hazard.weight);
    total += weight;
    return { hazard, weight };
  });
  if (total <= 0) return null;
  const roll = rng.next() * total;
  let acc = 0;
  for (const { hazard, weight } of normalized) {
    acc += weight;
    if (roll <= acc) {
      return hazard;
    }
  }
  return normalized.at(-1)?.hazard ?? null;
};

/**
 * Applies the biome's gravity multiplier to a base gravity value.
 *
 * @param base - Base gravity value.
 * @param biome - The biome definition.
 * @returns Adjusted gravity value.
 */
export const applyGravityModifier = (base: number, biome: BiomeDefinition) =>
  base * biome.gravityMultiplier;
