import type { BuildableFactory } from '@/ecs/factories';
import type { StoreSettings } from '../types';
import {
  type FactoryMetricSeries,
  type FactoryMetricSnapshot,
  type MetricsState,
} from '../types';
import { appendSample, cloneSeries, createEmptySeries } from './buffers';

type FactoryMetricTelemetry = {
  oreConsumed: number;
  barsProduced: number;
  energySpent: number;
};

type TelemetryMap = Record<string, FactoryMetricTelemetry | undefined>;

type ThroughputMap = Record<string, number | undefined>;

type MetricsMode = 'enabled' | 'throttled' | 'disabled';

type ResolvedMetricsConfig = {
  enabled: boolean;
  intervalMs: number;
  retentionMs: number;
  mode: MetricsMode;
};

const LOW_PROFILE_MIN_INTERVAL_MS = 15_000;
const LOW_PROFILE_MAX_RETENTION_MS = 60_000;

export const createMetricsState = (): MetricsState => ({
  series: {},
  snapshots: {},
  pendingHauler: {},
  accumulatorMs: 0,
});

export const resolveMetricsConfig = (settings: StoreSettings): ResolvedMetricsConfig => {
  const baseIntervalSeconds = Math.max(1, Math.floor(settings.metrics.intervalSeconds));
  const baseRetentionSeconds = Math.max(baseIntervalSeconds, Math.floor(settings.metrics.retentionSeconds));
  if (!settings.metrics.enabled) {
    return {
      enabled: false,
      intervalMs: baseIntervalSeconds * 1000,
      retentionMs: baseRetentionSeconds * 1000,
      mode: 'disabled',
    };
  }

  if (settings.performanceProfile === 'low') {
    const intervalMs = Math.max(baseIntervalSeconds * 1000, LOW_PROFILE_MIN_INTERVAL_MS);
    const retentionMs = Math.min(baseRetentionSeconds * 1000, LOW_PROFILE_MAX_RETENTION_MS);
    return {
      enabled: true,
      intervalMs,
      retentionMs,
      mode: 'throttled',
    };
  }

  return {
    enabled: true,
    intervalMs: baseIntervalSeconds * 1000,
    retentionMs: baseRetentionSeconds * 1000,
    mode: 'enabled',
  };
};

const ensureSeries = (series: Record<string, FactoryMetricSeries>, factoryId: string) => {
  if (!series[factoryId]) {
    series[factoryId] = createEmptySeries();
  }
  return series[factoryId];
};

const cloneSnapshots = (snapshots: Record<string, FactoryMetricSnapshot>): Record<string, FactoryMetricSnapshot> =>
  Object.fromEntries(
    Object.entries(snapshots).map(([key, snapshot]) => [key, { ...snapshot }]),
  );

export const clearFactoryMetrics = (state: MetricsState, factoryId: string): MetricsState => {
  if (!state.series[factoryId] && !state.snapshots[factoryId] && !state.pendingHauler[factoryId]) {
    return state;
  }
  const nextSeries = { ...state.series };
  const nextSnapshots = { ...state.snapshots };
  const nextPending = { ...state.pendingHauler };
  delete nextSeries[factoryId];
  delete nextSnapshots[factoryId];
  delete nextPending[factoryId];
  return {
    ...state,
    series: nextSeries,
    snapshots: nextSnapshots,
    pendingHauler: nextPending,
  };
};

export const resetMetricsState = (): MetricsState => ({
  series: {},
  snapshots: {},
  pendingHauler: {},
  accumulatorMs: 0,
});

export const accumulateHaulerThroughput = (
  state: MetricsState,
  deltas: ThroughputMap,
): MetricsState => {
  if (!deltas || Object.keys(deltas).length === 0) {
    return state;
  }
  let changed = false;
  const nextPending = { ...state.pendingHauler };
  for (const [factoryId, amount] of Object.entries(deltas)) {
    if (!factoryId || !Number.isFinite(amount) || amount === undefined || amount === 0) {
      continue;
    }
    nextPending[factoryId] = (nextPending[factoryId] ?? 0) + Math.max(0, amount);
    changed = true;
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    pendingHauler: nextPending,
  };
};

export const collectFactoryMetrics = (params: {
  metrics: MetricsState;
  factories: BuildableFactory[];
  telemetry: TelemetryMap;
  settings: StoreSettings;
  dt: number;
  gameTime: number;
}): MetricsState => {
  const { metrics, factories, telemetry, settings, dt, gameTime } = params;
  const config = resolveMetricsConfig(settings);
  if (!config.enabled) {
    if (Object.keys(metrics.series).length === 0 && Object.keys(metrics.snapshots).length === 0) {
      return metrics.accumulatorMs === 0 && Object.keys(metrics.pendingHauler).length === 0
        ? metrics
        : { ...metrics, accumulatorMs: 0, pendingHauler: {} };
    }
    return {
      series: {},
      snapshots: {},
      pendingHauler: {},
      accumulatorMs: 0,
    };
  }

  const nextAccumulator = metrics.accumulatorMs + dt * 1000;
  if (nextAccumulator < config.intervalMs) {
    return {
      ...metrics,
      accumulatorMs: nextAccumulator,
    };
  }

  const targetTimestamp = Math.max(0, Math.round(gameTime * 1000));
  const maxSamples = Math.max(1, Math.ceil(config.retentionMs / config.intervalMs));
  const nextSeries: Record<string, FactoryMetricSeries> = { ...metrics.series };
  const nextSnapshots = cloneSnapshots(metrics.snapshots);
  const nextPending: Record<string, number> = {};

  for (const factory of factories) {
    const factoryId = factory.id;
    const previousSnapshot = metrics.snapshots[factoryId];
    const pendingHauler = metrics.pendingHauler[factoryId] ?? 0;
    const series = cloneSeries(ensureSeries(nextSeries, factoryId));

    const currentSnapshot: FactoryMetricSnapshot = {
      ore: factory.resources.ore,
      bars: factory.resources.bars,
      energy: factory.energy,
      timestamp: targetTimestamp,
    };

    if (!previousSnapshot) {
      nextSeries[factoryId] = series;
      nextSnapshots[factoryId] = currentSnapshot;
      continue;
    }

    const elapsedMs = Math.max(config.intervalMs, targetTimestamp - previousSnapshot.timestamp);
    const elapsedMinutes = elapsedMs / 60_000;
    const elapsedSeconds = elapsedMs / 1_000;

    const sampleTelemetry = telemetry[factoryId];
    const oreDelta = factory.resources.ore - previousSnapshot.ore;
    const oreConsumed = sampleTelemetry?.oreConsumed ?? 0;
    const oreInPerMinute = elapsedMinutes > 0 ? (oreDelta + oreConsumed) / elapsedMinutes : 0;

    const barsProduced = sampleTelemetry?.barsProduced ?? 0;
    const barsPerMinute = elapsedMinutes > 0 ? barsProduced / elapsedMinutes : 0;

    const energySpent = sampleTelemetry?.energySpent ?? 0;
    const energyPerSecond = elapsedSeconds > 0 ? energySpent / elapsedSeconds : 0;

    const throughput = pendingHauler;
    const throughputPerMinute = elapsedMinutes > 0 ? throughput / elapsedMinutes : 0;

    series.oreIn = appendSample(series.oreIn, { ts: targetTimestamp, value: oreInPerMinute }, maxSamples);
    series.barsOut = appendSample(series.barsOut, { ts: targetTimestamp, value: barsPerMinute }, maxSamples);
    series.energyUse = appendSample(series.energyUse, { ts: targetTimestamp, value: energyPerSecond }, maxSamples);
    series.haulerThroughput = appendSample(
      series.haulerThroughput,
      { ts: targetTimestamp, value: throughputPerMinute },
      maxSamples,
    );

    nextSeries[factoryId] = series;
    nextSnapshots[factoryId] = currentSnapshot;

    if (throughput > 0) {
      nextPending[factoryId] = 0;
    }
  }

  // Carry forward pending throughput for factories that did not receive a sample this tick.
  for (const [factoryId, amount] of Object.entries(metrics.pendingHauler)) {
    if (nextPending[factoryId] !== undefined) {
      continue;
    }
    if (amount && amount > 0) {
      nextPending[factoryId] = amount;
    }
  }

  return {
    series: nextSeries,
    snapshots: nextSnapshots,
    pendingHauler: nextPending,
    accumulatorMs: nextAccumulator % config.intervalMs,
  };
};

export const hasMetricsData = (state: MetricsState, factoryId: string): boolean =>
  Boolean(state.series[factoryId] && state.series[factoryId].oreIn.length > 0);
