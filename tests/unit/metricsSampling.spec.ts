import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import { initialSettings } from '@/state/constants';
import {
  accumulateHaulerThroughput,
  collectFactoryMetrics,
  createMetricsState,
} from '@/state/metrics';
import type { MetricsState } from '@/state/types';

describe('state/metrics/collectFactoryMetrics', () => {
  it('produces per-minute samples after each interval and clears pending throughput', () => {
    const factory = createFactory('factory-metrics', new Vector3(0, 0, 0));
    const settings = { ...initialSettings, metrics: { ...initialSettings.metrics } };

    let metricsState = createMetricsState();

    // First interval seeds snapshots without producing samples.
    metricsState = collectFactoryMetrics({
      metrics: metricsState,
      factories: [factory],
      telemetry: {},
      settings,
      dt: settings.metrics.intervalSeconds,
      gameTime: 10,
    });
    expect(metricsState.series[factory.id]?.oreIn).toHaveLength(0);

    // Update factory state and inject telemetry before the next interval elapses.
    factory.resources.ore = 10;
    const telemetry = {
      [factory.id]: {
        oreConsumed: 20,
        barsProduced: 12,
        energySpent: 30,
      },
    } as const;

    metricsState = {
      ...metricsState,
      pendingHauler: { ...metricsState.pendingHauler, [factory.id]: 90 },
    } satisfies MetricsState;

    metricsState = collectFactoryMetrics({
      metrics: metricsState,
      factories: [factory],
      telemetry,
      settings,
      dt: settings.metrics.intervalSeconds,
      gameTime: 15,
    });

    const series = metricsState.series[factory.id];
    expect(series).toBeDefined();
    expect(series?.oreIn).toHaveLength(1);

    const oreSample = series?.oreIn.at(-1);
    const barSample = series?.barsOut.at(-1);
    const energySample = series?.energyUse.at(-1);
    const haulerSample = series?.haulerThroughput.at(-1);

    expect(oreSample?.value).toBeCloseTo(360, 5);
    expect(barSample?.value).toBeCloseTo(144, 5);
    expect(energySample?.value).toBeCloseTo(6, 5);
    expect(haulerSample?.value).toBeCloseTo(1080, 5);

    expect(metricsState.pendingHauler[factory.id]).toBe(0);
  });

  it('clears metrics buffers when disabled via settings', () => {
    const factory = createFactory('factory-disabled', new Vector3(0, 0, 0));
    const enabledSettings = { ...initialSettings, metrics: { ...initialSettings.metrics } };

    let metricsState = createMetricsState();
    metricsState = collectFactoryMetrics({
      metrics: metricsState,
      factories: [factory],
      telemetry: {},
      settings: enabledSettings,
      dt: enabledSettings.metrics.intervalSeconds,
      gameTime: 5,
    });

    // Ensure the factory series exists.
    expect(metricsState.series[factory.id]).toBeDefined();

    const disabledSettings = {
      ...enabledSettings,
      metrics: { ...enabledSettings.metrics, enabled: false },
    } as const;

    metricsState = collectFactoryMetrics({
      metrics: metricsState,
      factories: [factory],
      telemetry: {},
      settings: disabledSettings,
      dt: enabledSettings.metrics.intervalSeconds,
      gameTime: 6,
    });

    expect(metricsState.series).toEqual({});
    expect(metricsState.snapshots).toEqual({});
    expect(metricsState.pendingHauler).toEqual({});
    expect(metricsState.accumulatorMs).toBe(0);
  });
});

describe('state/metrics/accumulateHaulerThroughput', () => {
  it('accumulates positive deltas per factory id', () => {
    const state = createMetricsState();
    const updated = accumulateHaulerThroughput(state, {
      alpha: 30,
      beta: undefined,
      gamma: -10,
      delta: 0,
    });

    expect(updated).not.toBe(state);
    expect(updated.pendingHauler.alpha).toBe(30);
    expect(updated.pendingHauler.beta).toBeUndefined();
    expect(updated.pendingHauler.gamma).toBeUndefined();
    expect(updated.pendingHauler.delta).toBeUndefined();
  });

  it('returns the same state when no meaningful deltas are provided', () => {
    const state = createMetricsState();
    const updated = accumulateHaulerThroughput(state, {});
    expect(updated).toBe(state);
  });
});
