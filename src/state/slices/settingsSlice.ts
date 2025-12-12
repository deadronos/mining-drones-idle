import type { StateCreator } from 'zustand';
import type { StoreState, StoreSettings } from '../types';
import { initialSettings } from '../constants';
import { normalizeSettings } from '../serialization';
import { getBridge, isBridgeReady } from '@/lib/rustBridgeRegistry';
import { handoffRustToTs, handoffTsToRust } from '@/lib/simHandoff';

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
> = (set, get) => ({
  settings: { ...initialSettings },
  selectedAsteroidId: null,
  selectedFactoryId: null,

  updateSettings: (patch) => {
    const prev = get().settings;
    const next = normalizeSettings({ ...prev, ...patch });
    set(() => ({ settings: next }));

    if (prev.useRustSim === next.useRustSim || !isBridgeReady()) {
      return;
    }

    const bridge = getBridge();
    if (!bridge) {
      return;
    }

    if (next.useRustSim) {
      handoffTsToRust(bridge);
      return;
    }

    handoffRustToTs(bridge, get().applySnapshot, next);
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
