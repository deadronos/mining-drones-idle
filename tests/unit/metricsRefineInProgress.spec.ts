import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  createFactory,
  transferOreToFactory,
  startRefineProcess,
  tickRefineProcess,
} from '@/ecs/factories';
import { initialSettings } from '@/state/constants';
import { createMetricsState, collectFactoryMetrics } from '@/state/metrics';

describe('metrics: barsOut while refine in-progress', () => {
  it('records barsOut > 0 for partial refine ticks (not only on completion)', () => {
    const factory = createFactory('factory-refine', new Vector3(0, 0, 0));
    const settings = { ...initialSettings, metrics: { ...initialSettings.metrics } };

    // Seed metrics state to create an initial snapshot
    let metricsState = createMetricsState();
    metricsState = collectFactoryMetrics({
      metrics: metricsState,
      factories: [factory],
      telemetry: {},
      settings,
      dt: settings.metrics.intervalSeconds,
      gameTime: 10,
    });

    // Start a refine process and advance it partially (half of refine time)
    transferOreToFactory(factory, 100);
    const process = startRefineProcess(factory, 'ore', 50, 'refine-1');
    expect(process).not.toBeNull();

    // Advance by 5s (factory refineTime is 10s) -> should produce ~25 bars this tick
    const refined = tickRefineProcess(factory, process!, 5);
    expect(refined).toBeGreaterThan(0);

    const telemetry = {
      [factory.id]: {
        oreConsumed: 0,
        barsProduced: refined,
        energySpent: 0,
      },
    } as const;

    // Collect metrics for the next interval
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

    const barSample = series?.barsOut.at(-1);
    expect(barSample).toBeDefined();
    expect(barSample?.value).toBeGreaterThan(0);
  });
});
