import { Vector3 } from 'three';

export const TAU = Math.PI * 2;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

export const randomInt = (min: number, max: number) => Math.floor(randomRange(min, max + 1));

export const randomOnRing = (minRadius: number, maxRadius: number, yRange = 2) => {
  const radius = randomRange(minRadius, maxRadius);
  const angle = randomRange(0, TAU);
  const y = randomRange(-yRange, yRange);
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
