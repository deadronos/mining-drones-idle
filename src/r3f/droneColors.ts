import { Color } from 'three';
import type { DroneState } from '@/ecs/world';

const idleColor = new Color('#94a3b8');
const miningColor = new Color('#f97316');
const returningColor = new Color('#22d3ee');
const unloadingColor = new Color('#cbd5f5');

export const colorForState = (state: DroneState) => {
  switch (state) {
    case 'mining':
      return miningColor;
    case 'returning':
      return returningColor;
    case 'unloading':
      return unloadingColor;
    default:
      return idleColor;
  }
};

export { idleColor, miningColor, returningColor, unloadingColor };
