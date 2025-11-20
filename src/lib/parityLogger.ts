import type { StoreState } from '@/state/types';
import type { RustSimBridge } from './wasmSimBridge';

const EPSILON = 0.001;

interface ParityReport {
  frame: number;
  divergences: string[];
}

export function checkParity(
  tsState: StoreState,
  rustBridge: RustSimBridge,
  frame: number,
  tsDroneCount: number
): ParityReport | null {
  const divergences: string[] = [];

  const tsDrones = tsState.droneFlights;
  const rustDronePositions = rustBridge.getDronePositions();

  // Check count
  if (tsDroneCount !== rustDronePositions.length / 3) {
    divergences.push(
      `Drone count mismatch: TS=${tsDroneCount}, Rust=${rustDronePositions.length / 3}`,
    );
  }

  const tsFactories = tsState.factories;
  const rustFactoryResources = rustBridge.getFactoryResources();

  // 7 resources per factory: ore, bars, metals, crystals, organics, ice, credits
  if (tsFactories.length * 7 !== rustFactoryResources.length) {
     divergences.push(`Factory count mismatch (resources buffer size)`);
  } else {
    // Compare first factory ore
    if (tsFactories.length > 0) {
       const f = tsFactories[0];
       const tsOre = f.resources.ore;
       const rustOre = rustFactoryResources[0]; // ore is first float

       if (Math.abs(tsOre - rustOre) > EPSILON) {
         divergences.push(`Factory 0 Ore mismatch: TS=${tsOre.toFixed(3)}, Rust=${rustOre.toFixed(3)}`);
       }
    }
  }

  if (divergences.length > 0) {
    return { frame, divergences };
  }
  return null;
}
