import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import { FactoryMetricsTab } from '@/ui/FactoryMetricsTab';
import { storeApi, type StoreState } from '@/state/store';

const sampleTimestampMs = 25_000;
const currentGameTimeSeconds = 30;

describe('ui/FactoryMetricsTab', () => {
  let originalSettings: StoreState['settings'];
  let originalMetrics: StoreState['metrics'];
  let originalFactories: StoreState['factories'];
  let originalSelectedFactoryId: StoreState['selectedFactoryId'];
  let originalGameTime: StoreState['gameTime'];

  beforeEach(() => {
    const state = storeApi.getState();
    originalSettings = state.settings;
    originalMetrics = state.metrics;
    originalFactories = state.factories;
    originalSelectedFactoryId = state.selectedFactoryId;
    originalGameTime = state.gameTime;
  });

  afterEach(() => {
    act(() => {
      storeApi.setState((state) => ({
        ...state,
        settings: originalSettings,
        metrics: originalMetrics,
        factories: originalFactories,
        selectedFactoryId: originalSelectedFactoryId,
        gameTime: originalGameTime,
      }));
    });
  });

  it('renders metric cards and allows pausing sampling', async () => {
    const factory = createFactory('factory-metrics-ui', new Vector3(0, 0, 0));
    const metricsSeries = {
      oreIn: [{ ts: sampleTimestampMs, value: 180 }],
      barsOut: [{ ts: sampleTimestampMs, value: 90 }],
      energyUse: [{ ts: sampleTimestampMs, value: 7.5 }],
      haulerThroughput: [{ ts: sampleTimestampMs, value: 360 }],
    };

    act(() => {
      storeApi.setState((state) => ({
        ...state,
        factories: [factory],
        selectedFactoryId: factory.id,
        gameTime: currentGameTimeSeconds,
        settings: {
          ...state.settings,
          metrics: { enabled: true, intervalSeconds: 5, retentionSeconds: 120 },
        },
        metrics: {
          series: { [factory.id]: { ...metricsSeries } },
          snapshots: { [factory.id]: { ore: 0, bars: 0, energy: 0, timestamp: sampleTimestampMs } },
          pendingHauler: {},
          accumulatorMs: 0,
        },
      }));
    });

    render(<FactoryMetricsTab factoryId={factory.id} />);

    const pauseButton = screen.getByRole('button', { name: /pause sampling/i });
    const banner = pauseButton.closest('.factory-metrics-banner');
    expect(banner).not.toBeNull();
    const normalizedBannerText = banner?.textContent?.replace(/\s+/g, ' ').trim();
    expect(normalizedBannerText).toContain('Sampling every 5s with a retention window of 2m.');
      expect(screen.getByText(/Last sample 5s ago/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ore Intake metrics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bars Output metrics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Energy Usage metrics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hauler Flow metrics/i)).toBeInTheDocument();

    const oreSparkline = screen.getByLabelText(/Ore Intake sparkline/i);
    const describedBy = oreSparkline.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    if (describedBy) {
      const statsId = describedBy.split(' ')[0] ?? '';
      const statsElement = document.getElementById(statsId);
      expect(statsElement).not.toBeNull();
    }
    const oreTitle = oreSparkline.querySelector('title');
    expect(oreTitle?.textContent).toContain('Ore Intake recent values');

    await act(async () => {
      fireEvent.click(pauseButton);
    });
    expect(storeApi.getState().settings.metrics.enabled).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enable metrics/i })).toBeInTheDocument(),
    );
  });
});
