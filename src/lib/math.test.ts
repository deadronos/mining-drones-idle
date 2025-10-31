import { describe, it, expect } from 'vitest';
import { calculateExponentialCost } from './math';

describe('calculateExponentialCost', () => {
  it('calculates cost for level 0', () => {
    const cost = calculateExponentialCost(10, 1.5, 0);
    expect(cost).toBe(10);
  });

  it('calculates cost for level 1', () => {
    const cost = calculateExponentialCost(10, 1.5, 1);
    expect(cost).toBe(15);
  });

  it('calculates cost for level 2', () => {
    const cost = calculateExponentialCost(10, 1.5, 2);
    expect(cost).toBe(23); // Math.ceil(10 * 1.5^2) = Math.ceil(22.5) = 23
  });

  it('rounds up fractional costs', () => {
    const cost = calculateExponentialCost(100, 1.15, 3);
    expect(cost).toBe(153); // Math.ceil(100 * 1.15^3) = Math.ceil(152.0875) = 153
  });

  it('handles zero base cost', () => {
    const cost = calculateExponentialCost(0, 1.5, 5);
    expect(cost).toBe(0);
  });

  it('handles growth rate of 1 (no growth)', () => {
    const cost = calculateExponentialCost(100, 1.0, 10);
    expect(cost).toBe(100);
  });
});
