/**
 * RNG Parity Test Suite
 *
 * Validates that the TypeScript and Rust implementations of the Mulberry32
 * PRNG produce identical sequences for the same seed. This is critical for
 * deterministic simulation replay and cross-platform consistency.
 *
 * The expected values are from the Rust implementation's unit tests
 * (rust-engine/src/rng.rs), ensuring that TS produces identical output.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';

describe('RNG Parity', () => {
  describe('Mulberry32 sequence parity with Rust', () => {
    it('matches Rust sequence for seed 1', () => {
      const rng = createRng(1);

      // Expected values from Rust unit test: matches_typescript_sequence_for_seed_one
      const expected = [
        0.627_073_94, 0.002_735_721_2, 0.527_447_04, 0.981_050_97, 0.968_377_9,
        0.281_103_5, 0.612_838_86, 0.720_743_16, 0.425_796_96, 0.994_822_9,
      ];

      for (const expectedValue of expected) {
        const sample = rng.next();
        expect(sample).toBeCloseTo(expectedValue, 5);
      }
    });

    it('matches Rust sequence for seed 123456789', () => {
      const rng = createRng(123_456_789);

      // Expected values from Rust unit test: matches_typescript_sequence_for_large_seed
      const expected = [
        0.257_790_74, 0.970_772_1, 0.785_328, 0.206_164_58, 0.303_071_9,
        0.747_066_1, 0.778_733_7, 0.284_509_63, 0.016_536_935, 0.161_464_69,
      ];

      for (const expectedValue of expected) {
        const sample = rng.next();
        expect(sample).toBeCloseTo(expectedValue, 5);
      }
    });

    it('matches Rust integer range behavior for seed 99', () => {
      const rng = createRng(99);

      // Expected values from Rust unit test: supports_integer_ranges
      // Range: [-2, 3] in Rust maps to nextInt(-2, 3) in TS
      const expected = [-1, 2, 1, 2, -2, 2, -2, -2];

      for (const expectedValue of expected) {
        const sample = rng.nextInt(-2, 3);
        expect(sample).toBe(expectedValue);
      }
    });
  });

  describe('Edge cases and seed normalization', () => {
    it('normalizes seed 0 to 1', () => {
      const rng0 = createRng(0);
      const rng1 = createRng(1);

      // Both should produce identical sequences
      for (let i = 0; i < 10; i++) {
        expect(rng0.next()).toBe(rng1.next());
      }
    });

    it('handles negative seeds by converting to unsigned', () => {
      // Negative numbers in JavaScript become large unsigned when >>> 0
      const rng = createRng(-1);
      // -1 >>> 0 = 0xFFFFFFFF = 4294967295

      // Should produce deterministic output
      const first = rng.next();
      const rngRepeat = createRng(-1);
      expect(rngRepeat.next()).toBe(first);
    });

    it('produces values in [0, 1) range', () => {
      const rng = createRng(42);

      for (let i = 0; i < 1000; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('Range helpers parity', () => {
    it('nextRange produces values within bounds', () => {
      const rng = createRng(42);

      for (let i = 0; i < 100; i++) {
        const value = rng.nextRange(-10, 10);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('nextRange swaps min/max when reversed', () => {
      const rng1 = createRng(42);
      const rng2 = createRng(42);

      // Should produce same results regardless of order
      const v1 = rng1.nextRange(0, 10);
      const v2 = rng2.nextRange(10, 0);

      expect(v1).toBe(v2);
    });

    it('nextInt produces integers within inclusive bounds', () => {
      const rng = createRng(42);

      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(1, 6);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('Determinism verification', () => {
    it('same seed produces identical 1000-sample sequence', () => {
      const seed = 0xdeadbeef;
      const rng1 = createRng(seed);
      const rng2 = createRng(seed);

      for (let i = 0; i < 1000; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('different seeds diverge immediately', () => {
      const rng1 = createRng(1);
      const rng2 = createRng(2);

      // First values should differ
      expect(rng1.next()).not.toBe(rng2.next());
    });
  });
});
