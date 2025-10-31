import { Vector3 } from 'three';
import type { RandomSource } from '@/lib/rng';

export const TAU = Math.PI * 2;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const randomRange = (min: number, max: number, rng?: RandomSource) =>
  min + (rng?.next() ?? Math.random()) * (max - min);

export const randomInt = (min: number, max: number, rng?: RandomSource) =>
  Math.floor(randomRange(min, max + 1, rng));

export const randomOnRing = (
  minRadius: number,
  maxRadius: number,
  yRange = 2,
  rng?: RandomSource,
) => {
  const radius = randomRange(minRadius, maxRadius, rng);
  const angle = randomRange(0, TAU, rng);
  const y = randomRange(-yRange, yRange, rng);
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/**
 * Calculate exponential cost growth.
 * @param baseCost Base cost at level 0
 * @param growthRate Exponential growth rate (e.g., 1.5)
 * @param level Current level (0-based)
 * @returns Calculated cost rounded up to nearest integer
 */
export const calculateExponentialCost = (
  baseCost: number,
  growthRate: number,
  level: number,
): number => Math.ceil(baseCost * Math.pow(growthRate, level));
