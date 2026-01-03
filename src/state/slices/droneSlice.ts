import type { StateCreator } from 'zustand';
import type { StoreState, DroneFlightState } from '../types';
import { cloneDroneFlight } from '../serialization';

export interface DroneSliceState {
  droneFlights: Record<string, DroneFlightState>;
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
  droneFlights: {},
  droneOwners: {},

  recordDroneFlight: (flight) => {
    set((state) => {
      const snapshot = cloneDroneFlight(flight);
      return {
        droneFlights: {
          ...state.droneFlights,
          [snapshot.droneId]: snapshot,
        },
      };
    });
  },

  clearDroneFlight: (droneId) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [droneId]: _removed, ...remaining } = state.droneFlights;
      return { droneFlights: remaining };
    });
  },
});
