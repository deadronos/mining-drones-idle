// Vector and travel snapshot serialization
export {
  normalizeVectorTuple,
  cloneVectorTuple,
  normalizeTravelSnapshot,
  cloneTravelSnapshot,
} from './vectors';

// Drone flight serialization
export { normalizeDroneFlight, normalizeDroneFlights, cloneDroneFlight } from './drones';

// Factory and resource serialization
export {
  normalizeFactoryResources,
  normalizeFactoryUpgrades,
  normalizeDroneOwners,
  normalizeRefineSnapshot,
  refineProcessToSnapshot,
  cloneRefineProcess,
  snapshotToRefineProcess,
} from './resources';

// Factory snapshot transformation
export {
  normalizeFactorySnapshot,
  cloneFactory,
  snapshotToFactory,
  factoryToSnapshot,
} from './factory';

// Store-level serialization
export {
  normalizeResources,
  normalizeModules,
  normalizePrestige,
  normalizeSave,
  normalizeNotation,
  normalizePerformanceProfile,
  normalizeSettings,
  normalizeSnapshot,
  serializeStore,
  stringifySnapshot,
  parseSnapshot,
} from './store';

// Utility types and functions
export { coerceNumber, vector3ToTuple, tupleToVector3 } from './types';
