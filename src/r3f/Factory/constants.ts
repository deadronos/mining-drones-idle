import { Color, Vector3 } from 'three';
import type { PerformanceProfile } from '@/state/store';

// Factory color palette
export const FACTORY_COLORS = {
  BASE: '#1f2937',
  CORE: '#1e293b',
  RING: '#38bdf8',
  ACCENT: '#0ea5e9',
  STRUT: '#1a1a2e',
  PANEL: '#111827',
  GLOW: '#0f172a',
} as const;

export const HIGHLIGHT_SOURCE = new Color('#f97316');
export const HIGHLIGHT_DEST = new Color('#22d3ee');
export const BASE_RING_COLOR = new Color(FACTORY_COLORS.RING);
export const BASE_RING_EMISSIVE = new Color(FACTORY_COLORS.ACCENT);
export const BASE_CORE_EMISSIVE = new Color(FACTORY_COLORS.RING);
export const BASE_BASE_EMISSIVE = new Color(FACTORY_COLORS.GLOW);
export const BASE_BELT_EMISSIVE = new Color('#155e75');
export const BASE_LIGHT_COLOR = new Color(FACTORY_COLORS.RING);

// Belt definitions
export interface BeltDefinition {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  direction: number;
  pathFrom: Vector3;
  pathTo: Vector3;
}

export const BELTS: BeltDefinition[] = [
  {
    position: [0, 0.32, 1.6],
    scale: [3.4, 0.18, 1],
    direction: 1,
    pathFrom: new Vector3(-1.7, 0.55, 1.4),
    pathTo: new Vector3(0.4, 0.55, 0.5),
  },
  {
    position: [0, 0.32, -1.6],
    scale: [3.4, 0.18, 1],
    direction: -1,
    pathFrom: new Vector3(1.7, 0.55, -1.4),
    pathTo: new Vector3(-0.4, 0.55, -0.5),
  },
];

// Performance profiles
export const PROFILE_CONFIG: Record<
  PerformanceProfile,
  {
    itemCount: number;
    transferLimit: number;
    beltSpeed: number;
    effectMultiplier: number;
  }
> = {
  low: { itemCount: 0, transferLimit: 0, beltSpeed: 0.55, effectMultiplier: 0.6 },
  medium: { itemCount: 12, transferLimit: 12, beltSpeed: 0.85, effectMultiplier: 1 },
  high: { itemCount: 24, transferLimit: 20, beltSpeed: 1.25, effectMultiplier: 1.3 },
};

// Pool sizes
export const ITEM_POOL_SIZE = 36;
export const TRANSFER_POOL_SIZE = 28;
