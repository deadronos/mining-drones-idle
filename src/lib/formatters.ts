/**
 * Centralized number and percentage formatting utilities.
 * This module provides consistent formatting functions used across the UI.
 */

/**
 * Formatter for integer values (no decimal places).
 */
export const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/**
 * Formatter for decimal values (up to 2 decimal places, with grouping).
 */
export const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formatter for decimal values with exactly 1 decimal place (e.g., "1,234.5").
 */
export const decimalOneFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Format a number as an integer with thousand separators.
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,234")
 */
export const formatInteger = (value: number): string => integerFormatter.format(value);

/**
 * Format a number with up to 2 decimal places and thousand separators.
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,234.56")
 */
export const formatDecimal = (value: number): string => decimalFormatter.format(value);

/**
 * Format a number with exactly 1 decimal place and thousand separators.
 * @param value - The number to format
 * @returns Formatted string (e.g., "1,234.5")
 */
export const formatDecimalOne = (value: number): string => decimalOneFormatter.format(value);

/**
 * Format a decimal value as a percentage string with 1 decimal place.
 * @param value - The decimal value (e.g., 0.15 for 15%)
 * @returns Formatted percentage string (e.g., "15.0%")
 */
export const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

/**
 * Format a decimal value as a percentage string with 0 decimal places.
 * @param value - The decimal value (e.g., 0.15 for 15%)
 * @returns Formatted percentage string (e.g., "15%")
 */
export const formatPercentInteger = (value: number): string => `${(value * 100).toFixed(0)}%`;
