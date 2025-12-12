import type { MetricSample } from '@/state/types';

export type MetricSummary = {
  last: number;
  min: number;
  max: number;
  average: number;
  hasData: boolean;
};

const formatPoint = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

export const formatMetricValue = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 100000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (abs >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const summarizeSamples = (samples: MetricSample[]): MetricSummary => {
  if (samples.length === 0) {
    return { last: 0, min: 0, max: 0, average: 0, hasData: false };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const sample of samples) {
    const { value } = sample;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  const last = samples[samples.length - 1].value;
  const average = sum / samples.length;

  return {
    last,
    min,
    max,
    average,
    hasData: true,
  };
};

export const buildSparklinePath = (
  samples: MetricSample[],
  width: number,
  height: number,
): string => {
  if (samples.length === 0 || width <= 0 || height <= 0) {
    const mid = formatPoint(height / 2);
    return `M0 ${mid} L${formatPoint(width)} ${mid}`;
  }

  const values = samples.map((sample) => sample.value);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const mid = formatPoint(height / 2);
    return `M0 ${mid} L${formatPoint(width)} ${mid}`;
  }

  if (min === max) {
    const mid = formatPoint(height / 2);
    return `M0 ${mid} L${formatPoint(width)} ${mid}`;
  }

  const range = max - min;
  const segments = samples.length - 1;

  return samples
    .map((sample, index) => {
      const ratio = (sample.value - min) / range;
      const x = segments === 0 ? width : (index / segments) * width;
      const y = height - ratio * height;
      return `${index === 0 ? 'M' : 'L'}${formatPoint(x)} ${formatPoint(y)}`;
    })
    .join(' ');
};
