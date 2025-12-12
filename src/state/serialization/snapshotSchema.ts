// JSON Schema for snapshots (used by Ajv validator)

// JSON Schema describing the minimal shape required by the WASM engine.
// This schema is intentionally permissive (additionalProperties allowed)
// so callers can include platform-specific keys (like `asteroids`) without
// failing validation; however required fields are enforced.
export const StoreSnapshotSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    schemaVersion: { type: 'string', minLength: 1 },
    resources: {
      type: 'object',
      properties: {
        ore: { type: 'number' },
        ice: { type: 'number' },
        metals: { type: 'number' },
        crystals: { type: 'number' },
        organics: { type: 'number' },
        bars: { type: 'number' },
        energy: { type: 'number' },
        credits: { type: 'number' },
      },
      required: ['ore', 'ice', 'metals', 'crystals', 'organics', 'bars', 'energy', 'credits'],
      additionalProperties: false,
    },
    modules: {
      type: 'object',
      properties: {
        droneBay: { type: 'integer', minimum: 0 },
        refinery: { type: 'integer', minimum: 0 },
        storage: { type: 'integer', minimum: 0 },
        solar: { type: 'integer', minimum: 0 },
        scanner: { type: 'integer', minimum: 0 },
        haulerDepot: { type: 'integer', minimum: 0 },
        logisticsHub: { type: 'integer', minimum: 0 },
        routingProtocol: { type: 'integer', minimum: 0 },
      },
      required: ['droneBay', 'refinery', 'storage', 'solar', 'scanner', 'haulerDepot', 'logisticsHub', 'routingProtocol'],
      additionalProperties: true,
    },
    save: {
      type: 'object',
      properties: {
        lastSave: { type: 'number' },
        version: { type: 'string', minLength: 1 },
      },
      required: ['lastSave', 'version'],
      additionalProperties: true,
    },
    gameTime: { type: 'number', minimum: 0 },
    settings: {
      type: 'object',
      properties: {
        autosaveEnabled: { type: 'boolean' },
        autosaveInterval: { type: 'number' },
        offlineCapHours: { type: 'number' },
        notation: { type: 'string' },
        throttleFloor: { type: 'number' },
        showTrails: { type: 'boolean' },
        showHaulerShips: { type: 'boolean' },
        showDebugPanel: { type: 'boolean' },
        performanceProfile: { type: 'string' },
        inspectorCollapsed: { type: 'boolean' },
        metrics: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            intervalSeconds: { type: 'number', minimum: 1 },
            retentionSeconds: { type: 'number', minimum: 1 },
          },
          required: ['enabled', 'intervalSeconds', 'retentionSeconds'],
          additionalProperties: true,
        },
      },
      required: ['autosaveEnabled', 'autosaveInterval', 'offlineCapHours', 'notation', 'throttleFloor', 'showTrails', 'showHaulerShips', 'showDebugPanel', 'performanceProfile', 'inspectorCollapsed', 'metrics'],
      additionalProperties: true,
    },
  },
  required: ['resources', 'modules', 'save', 'settings'],
  additionalProperties: true,
};

