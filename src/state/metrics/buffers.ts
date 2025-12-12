import type {
  FactoryMetricSeries,
  FactoryMetricSeriesId,
  MetricSample,
} from '../types';

export const METRIC_SERIES_IDS: FactoryMetricSeriesId[] = [
  'oreIn',
  'barsOut',
  'energyUse',
  'haulerThroughput',
];

export const createEmptySeries = (): FactoryMetricSeries => ({
  oreIn: [],
  barsOut: [],
  energyUse: [],
  haulerThroughput: [],
});

export const cloneSeries = (series: FactoryMetricSeries): FactoryMetricSeries => ({
  oreIn: [...series.oreIn],
  barsOut: [...series.barsOut],
  energyUse: [...series.energyUse],
  haulerThroughput: [...series.haulerThroughput],
});

export const appendSample = (
  existing: MetricSample[],
  sample: MetricSample,
  maxSamples: number,
): MetricSample[] => {
  if (maxSamples <= 0) {
    return [];
  }
  const next = [...existing, sample];
  if (next.length <= maxSamples) {
    return next;
  }
  return next.slice(next.length - maxSamples);
};
