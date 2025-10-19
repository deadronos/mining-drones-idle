import type { DroneFlightState } from '../types';
import { normalizeTravelSnapshot, cloneTravelSnapshot } from './vectors';
import { coerceNumber } from '../utils';

export const normalizeDroneFlight = (value: unknown): DroneFlightState | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<DroneFlightState> & {
    travel?: unknown;
    pathSeed?: unknown;
    targetAsteroidId?: unknown;
    targetFactoryId?: unknown;
  };
  if (typeof raw.droneId !== 'string' || raw.droneId.length === 0) {
    return null;
  }
  if (raw.state !== 'toAsteroid' && raw.state !== 'returning') {
    return null;
  }
  const travel = normalizeTravelSnapshot(raw.travel);
  if (!travel) {
    return null;
  }
  const pathSeed = coerceNumber(raw.pathSeed, 0);
  const targetAsteroidId = typeof raw.targetAsteroidId === 'string' ? raw.targetAsteroidId : null;
  const targetRegionId = typeof raw.targetRegionId === 'string' ? raw.targetRegionId : null;
  const targetFactoryId = typeof raw.targetFactoryId === 'string' ? raw.targetFactoryId : null;
  return {
    droneId: raw.droneId,
    state: raw.state,
    targetAsteroidId,
    targetRegionId,
    targetFactoryId,
    pathSeed,
    travel,
  };
};

export const normalizeDroneFlights = (value: unknown): DroneFlightState[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const flights: DroneFlightState[] = [];
  for (const entry of value) {
    const normalized = normalizeDroneFlight(entry);
    if (normalized) {
      flights.push(normalized);
    }
  }
  return flights;
};

export const cloneDroneFlight = (flight: DroneFlightState): DroneFlightState => ({
  droneId: flight.droneId,
  state: flight.state,
  targetAsteroidId: flight.targetAsteroidId,
  targetRegionId: flight.targetRegionId,
  targetFactoryId: flight.targetFactoryId,
  pathSeed: flight.pathSeed,
  travel: cloneTravelSnapshot(flight.travel),
});
