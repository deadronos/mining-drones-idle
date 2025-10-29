import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import { FactoryMetricsInline } from '@/ui/FactoryMetricsInline';
import { storeApi, type StoreState } from '@/state/store';

const now = Date.now();

describe('ui/FactoryMetricsInline', () => {
  let originalSettings: StoreState['settings'];
  let originalMetrics: StoreState['metrics'];
  let originalFactories: StoreState['factories'];

  beforeEach(() => {
    const state = storeApi.getState();
    originalSettings = state.settings;
    originalMetrics = state.metrics;
    originalFactories = state.factories;
  });

  afterEach(() => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        settings: originalSettings,
        metrics: originalMetrics,
        factories: originalFactories,
      }));
    });
  });

  it('renders descriptive labels when data is available', () => {
    const factory = createFactory('factory-inline', new Vector3(0, 0, 0));

    act(() => {
      storeApi.setState((state) => ({
        ...state,
        factories: [factory],
        settings: {
          ...state.settings,
          metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 120 },
        },
        metrics: {
          ...state.metrics,
          series: {
            ...state.metrics.series,
            [factory.id]: {
              oreIn: [],
              barsOut: [
                { ts: now, value: 80 },
                { ts: now + 5_000, value: 90 },
              ],
              energyUse: [],
              haulerThroughput: [],
            },
          },
          snapshots: {
            ...state.metrics.snapshots,
            [factory.id]: { ore: 0, bars: 0, energy: 0, timestamp: now },
          },
          pendingHauler: {
            ...state.metrics.pendingHauler,
            [factory.id]: 0,
          },
        },
      }));
    });

    render(<FactoryMetricsInline factoryId={factory.id} />);

    const trendElement = screen.getByLabelText(new RegExp(`Bars output trend for ${factory.id}`, 'i'));
    expect(trendElement.getAttribute('title')).toMatch(/Last 90/);

    const svg = trendElement.querySelector('svg');
    const describedBy = svg?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const valueSpan = trendElement.querySelector('.factory-metrics-inline__value');
    expect(valueSpan).not.toBeNull();
    if (describedBy && valueSpan instanceof HTMLElement) {
      const [firstId] = describedBy.split(' ');
      expect(firstId).toBe(valueSpan.id);
    }

    const titleNode = svg?.querySelector('title');
    expect(titleNode?.textContent).toContain('Bars output trend for');
  });

  it('returns null when metrics sampling is disabled', () => {
    const factory = createFactory('factory-inline-disabled', new Vector3(0, 0, 0));

    act(() => {
      storeApi.setState((state) => ({
        ...state,
        factories: [factory],
        settings: {
          ...state.settings,
          metrics: { enabled: false, intervalSeconds: 5, retentionSeconds: 120 },
        },
        metrics: {
          ...state.metrics,
          series: {
            ...state.metrics.series,
            [factory.id]: {
              oreIn: [],
              barsOut: [{ ts: now, value: 42 }],
              energyUse: [],
              haulerThroughput: [],
            },
          },
        },
      }));
    });

    render(<FactoryMetricsInline factoryId={factory.id} />);

    expect(
      screen.queryByLabelText(new RegExp(`Bars output trend for ${factory.id}`, 'i')),
    ).toBeNull();
  });
});
