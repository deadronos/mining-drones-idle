import { describe, it, expect } from 'vitest';
import {
  formatInteger,
  formatDecimal,
  formatDecimalOne,
  formatPercent,
  formatPercentInteger,
  integerFormatter,
  decimalFormatter,
  decimalOneFormatter,
} from './formatters';

describe('formatters', () => {
  describe('formatInteger', () => {
    it('formats integers with thousand separators', () => {
      expect(formatInteger(1234)).toBe('1,234');
      expect(formatInteger(1234567)).toBe('1,234,567');
    });

    it('formats zero', () => {
      expect(formatInteger(0)).toBe('0');
    });

    it('rounds decimal values', () => {
      expect(formatInteger(1234.56)).toBe('1,235');
      expect(formatInteger(1234.4)).toBe('1,234');
    });
  });

  describe('formatDecimal', () => {
    it('formats decimals with up to 2 decimal places', () => {
      expect(formatDecimal(1234.56)).toBe('1,234.56');
      expect(formatDecimal(1234.5)).toBe('1,234.5');
    });

    it('formats integers without decimal places', () => {
      expect(formatDecimal(1234)).toBe('1,234');
    });

    it('formats small decimals', () => {
      expect(formatDecimal(0.5)).toBe('0.5');
      expect(formatDecimal(0.12)).toBe('0.12');
    });
  });

  describe('formatDecimalOne', () => {
    it('formats decimals with exactly 1 decimal place', () => {
      expect(formatDecimalOne(1234.56)).toBe('1,234.6');
      expect(formatDecimalOne(1234.5)).toBe('1,234.5');
    });

    it('formats integers with .0', () => {
      expect(formatDecimalOne(1234)).toBe('1,234.0');
    });

    it('rounds to 1 decimal place', () => {
      expect(formatDecimalOne(1234.99)).toBe('1,235.0');
      expect(formatDecimalOne(1234.94)).toBe('1,234.9');
    });
  });

  describe('formatPercent', () => {
    it('formats decimal values as percentages with 1 decimal place', () => {
      expect(formatPercent(0.15)).toBe('15.0%');
      expect(formatPercent(0.156)).toBe('15.6%');
      expect(formatPercent(1.0)).toBe('100.0%');
    });

    it('formats zero', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });

    it('formats negative percentages', () => {
      expect(formatPercent(-0.1)).toBe('-10.0%');
    });
  });

  describe('formatPercentInteger', () => {
    it('formats decimal values as percentages with 0 decimal places', () => {
      expect(formatPercentInteger(0.15)).toBe('15%');
      expect(formatPercentInteger(0.156)).toBe('16%');
      expect(formatPercentInteger(1.0)).toBe('100%');
    });

    it('formats zero', () => {
      expect(formatPercentInteger(0)).toBe('0%');
    });

    it('rounds to nearest integer', () => {
      expect(formatPercentInteger(0.154)).toBe('15%');
      expect(formatPercentInteger(0.155)).toBe('16%');
    });
  });

  describe('Intl.NumberFormat instances', () => {
    it('integerFormatter is configured correctly', () => {
      expect(integerFormatter.format(1234.56)).toBe('1,235');
    });

    it('decimalFormatter is configured correctly', () => {
      expect(decimalFormatter.format(1234.56)).toBe('1,234.56');
    });

    it('decimalOneFormatter is configured correctly', () => {
      expect(decimalOneFormatter.format(1234.56)).toBe('1,234.6');
    });
  });
});
