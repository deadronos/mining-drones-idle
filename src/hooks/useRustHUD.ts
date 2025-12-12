import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { getBridge } from '../lib/rustBridgeRegistry';
import type { Resources, FactoryResourceSnapshot } from '../state/types';

export interface RustHUDState {
  resources: Resources;
  isRustActive: boolean;
  getFactory: (index: number) => {
    resources: FactoryResourceSnapshot;
    energy: number;
    haulersAssigned: number;
  } | null;
}

export function useRustHUD(): RustHUDState {
  const useRustSim = useStore((state) => state.settings.useRustSim);
  const storeResources = useStore((state) => state.resources);

  const [hudResources, setHudResources] = useState<Resources>(storeResources);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!useRustSim) {
      return;
    }

    let frameId: number;
    let lastUpdate = 0;

    const loop = (now: number) => {
        frameId = requestAnimationFrame(loop);
        if (now - lastUpdate < 32) return; // ~30fps
        lastUpdate = now;

        const bridge = getBridge();
        if (bridge?.isReady()) {
            try {
                // Check if buffer is valid
                const raw = bridge.getGlobalResources();
                // raw: ore, ice, metals, crystals, organics, bars, energy, credits
                if (raw.length === 8) {
                  setHudResources({
                      ore: raw[0],
                      ice: raw[1],
                      metals: raw[2],
                      crystals: raw[3],
                      organics: raw[4],
                      bars: raw[5],
                      energy: raw[6],
                      credits: raw[7],
                  });
                  setIsActive(true);
                } else {
                  setIsActive(false);
                }
            } catch {
                // If memory access fails (e.g. resized/detached), fallback
                setIsActive(false);
            }
        } else {
            setIsActive(false);
        }
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      setIsActive(false);
    };
  }, [useRustSim]);

  const getFactory = (index: number) => {
      const bridge = getBridge();
      if (!isActive || !bridge?.isReady()) return null;

      try {
          const res = bridge.getFactoryResources(index);
          const energy = bridge.getFactoryEnergy(index)[0];
          const haulers = bridge.getFactoryHaulersAssigned(index)[0];

          return {
              resources: {
                  ore: res[0],
                  ice: res[1],
                  metals: res[2],
                  crystals: res[3],
                  organics: res[4],
                  bars: res[5],
                  credits: res[6],
              },
              energy,
              haulersAssigned: haulers
          };
      } catch {
          return null;
      }
  };

  if (isActive && useRustSim) {
      return { resources: hudResources, isRustActive: true, getFactory };
  }

  return { resources: storeResources, isRustActive: false, getFactory: () => null };
}
