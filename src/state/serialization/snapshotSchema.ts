import { z } from 'zod';

export const ResourcesSchema = z.object({
  ore: z.number(),
  ice: z.number(),
  metals: z.number(),
  crystals: z.number(),
  organics: z.number(),
  bars: z.number(),
  energy: z.number(),
  credits: z.number(),
});

export const ModulesSchema = z.object({
  droneBay: z.number(),
  refinery: z.number(),
  storage: z.number(),
  solar: z.number(),
  scanner: z.number(),
  haulerDepot: z.number(),
  logisticsHub: z.number(),
  routingProtocol: z.number(),
});

export const SaveSchema = z.object({
  lastSave: z.number(),
  version: z.string().min(1),
});

export const MetricsSchema = z.object({
  enabled: z.boolean(),
  intervalSeconds: z.number().min(1),
  retentionSeconds: z.number().min(1),
});

export const SettingsSchema = z
  .object({
    autosaveEnabled: z.boolean(),
    autosaveInterval: z.number().min(1),
    offlineCapHours: z.number().min(0),
    notation: z.string(),
    throttleFloor: z.number(),
    showTrails: z.boolean(),
    showHaulerShips: z.boolean(),
    showDebugPanel: z.boolean(),
    performanceProfile: z.string(),
    inspectorCollapsed: z.boolean(),
    metrics: MetricsSchema,
    useRustSim: z.boolean().optional(),
    shadowMode: z.boolean().optional(),
  })
  .passthrough();

// Top-level snapshot schema used for runtime validation before handing
// snapshots to the Rust/WASM engine. We keep .passthrough() so callers
// may include engine-specific extra keys (like asteroids) without failing.
export const StoreSnapshotSchema = z
  .object({
    resources: ResourcesSchema,
    modules: ModulesSchema,
    save: SaveSchema,
    settings: SettingsSchema,
  })
  .passthrough();

export type StoreSnapshotSchemaType = z.infer<typeof StoreSnapshotSchema>;
