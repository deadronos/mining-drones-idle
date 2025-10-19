import type { StateCreator } from 'zustand';
import type { StoreState, DroneFlightState } from '../types';
import { cloneDroneFlight } from '../serialization';

export interface DroneSliceState {
  droneFlights: DroneFlightState[];
  droneOwners: Record<string, string | null>;
}

export interface DroneSliceMethods {
  recordDroneFlight: (flight: DroneFlightState) => void;
  clearDroneFlight: (droneId: string) => void;
}

export const createDroneSlice: StateCreator<
  StoreState,
  [],
  [],
  DroneSliceState & DroneSliceMethods
> = (set) => ({
  droneFlights: [],
  droneOwners: {},

  recordDroneFlight: (flight) => {
    set((state) => {
      const snapshot = cloneDroneFlight(flight);
      const remaining = state.droneFlights.filter((entry) => entry.droneId !== snapshot.droneId);
      return { droneFlights: [...remaining, snapshot] };
    });
  },

  clearDroneFlight: (droneId) => {
    set((state) => ({
      droneFlights: state.droneFlights.filter((entry) => entry.droneId !== droneId),
    }));
  },
});
