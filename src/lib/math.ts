import { Vector3 } from 'three';
import type { RandomSource } from '@/lib/rng';

/** Two times PI. */
export const TAU = Math.PI * 2;

/**
 * Clamps a value between a minimum and maximum.
 *
 * @param value - The value to clamp.
 * @param min - The lower bound.
 * @param max - The upper bound.
 * @returns The clamped value.
 */
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Generates a random floating-point number within a range.
 *
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (exclusive).
 * @param rng - Optional random number source (defaults to Math.random).
 * @returns Random number between min and max.
 */
export const randomRange = (min: number, max: number, rng?: RandomSource) =>
  min + (rng?.next() ?? Math.random()) * (max - min);

/**
 * Generates a random integer within a range.
 *
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (inclusive).
 * @param rng - Optional random number source.
 * @returns Random integer between min and max.
 */
export const randomInt = (min: number, max: number, rng?: RandomSource) =>
  Math.floor(randomRange(min, max + 1, rng));

/**
 * Generates a random 3D position on a ring in the XZ plane.
 *
 * @param minRadius - Inner radius of the ring.
 * @param maxRadius - Outer radius of the ring.
 * @param yRange - Maximum deviation in Y axis (+/-).
 * @param rng - Optional random number source.
 * @returns A Vector3 position.
 */
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

/**
 * Linearly interpolates between two values.
 *
 * @param a - Start value.
 * @param b - End value.
 * @param t - Interpolation factor (0-1).
 * @returns Interpolated value.
 */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Frame-rate independent damping (exponential decay).
 *
 * @param current - Current value.
 * @param target - Target value.
 * @param lambda - Smoothing factor (higher is faster).
 * @param dt - Delta time in seconds.
 * @returns New damped value.
 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/**
 * Calculate exponential cost growth.
 *
 * @param baseCost - Base cost at level 0.
 * @param growthRate - Exponential growth rate (e.g., 1.5).
 * @param level - Current level (0-based).
 * @returns Calculated cost rounded up to nearest integer.
 */
export const calculateExponentialCost = (
  baseCost: number,
  growthRate: number,
  level: number,
): number => Math.ceil(baseCost * Math.pow(growthRate, level));
