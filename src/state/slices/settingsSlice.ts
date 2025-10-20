import type { StateCreator } from 'zustand';
import type { StoreState, StoreSettings } from '../types';
import { initialSettings } from '../constants';
import { normalizeSettings } from '../serialization';

export interface SettingsSliceState {
  settings: StoreSettings;
  selectedAsteroidId: string | null;
  selectedFactoryId: string | null;
}

export interface SettingsSliceMethods {
  updateSettings: (patch: Partial<StoreSettings>) => void;
  setSelectedAsteroid: (asteroidId: string | null) => void;
  toggleInspector: () => void;
  setSelectedFactory: (factoryId: string | null) => void;
  cycleSelectedFactory: (direction: number) => void;
}

export const createSettingsSlice: StateCreator<
  StoreState,
  [],
  [],
  SettingsSliceState & SettingsSliceMethods
> = (set) => ({
  settings: { ...initialSettings },
  selectedAsteroidId: null,
  selectedFactoryId: null,

  updateSettings: (patch) => {
    set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) }));
  },

  setSelectedAsteroid: (asteroidId) => {
    set(() => ({ selectedAsteroidId: asteroidId }));
  },

  toggleInspector: () => {
    set((state) => ({
      settings: normalizeSettings({
        ...state.settings,
        inspectorCollapsed: !state.settings.inspectorCollapsed,
      }),
    }));
  },

  setSelectedFactory: (factoryId) => {
    set(() => ({ selectedFactoryId: factoryId }));
  },

  cycleSelectedFactory: (direction) => {
    set((state) => {
      const total = state.factories.length;
      if (total === 0) {
        return { selectedFactoryId: null };
      }
      const currentIndex = state.factories.findIndex(
        (factory) => factory.id === state.selectedFactoryId,
      );
      const baseIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (baseIndex + direction + total) % total;
      return { selectedFactoryId: state.factories[nextIndex]?.id ?? null };
    });
  },
});
