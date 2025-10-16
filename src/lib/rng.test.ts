import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';

describe('lib/rng', () => {
  it('produces deterministic sequences for the same seed', () => {
    const first = createRng(123456789);
    const second = createRng(123456789);
    const sequenceLength = 5;
    const a = Array.from({ length: sequenceLength }, () => first.next());
    const b = Array.from({ length: sequenceLength }, () => second.next());
    expect(b).toEqual(a);
  });

  it('diverges when seeds differ', () => {
    const first = createRng(123456789);
    const second = createRng(987654321);
    expect(second.next()).not.toBeCloseTo(first.next());
  });

  it('supports ranged helpers', () => {
    const rng = createRng(42);
    const int = rng.nextInt(1, 3);
    expect(int).toBeGreaterThanOrEqual(1);
    expect(int).toBeLessThanOrEqual(3);
    const value = rng.nextRange(-2, 2);
    expect(value).toBeGreaterThanOrEqual(-2);
    expect(value).toBeLessThanOrEqual(2);
  });
});
