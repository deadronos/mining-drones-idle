/**
 * Logistics module: resource distribution and hauler scheduling.
 * Exports configuration, math utilities, matching algorithm, and reservation/execution functions.
 */

// Configuration and types
export { LOGISTICS_CONFIG, RESOURCE_TYPES, WAREHOUSE_NODE_ID, generateTransferId } from './config';
export type { TransportableResource } from './config';

// Pure utility functions
export {
  computeBufferTarget,
  computeMinReserve,
  computeTravelTime,
  computeHaulerCost,
  computeHaulerMaintenanceCost,
} from './math';

// Matching algorithm
export { matchSurplusToNeed } from './matcher';

// Reservation and execution functions
export {
  validateTransfer,
  reserveOutbound,
  releaseReservation,
  executeArrival,
} from './reservations';
