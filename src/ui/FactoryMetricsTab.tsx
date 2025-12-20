import { useId, useMemo, memo } from 'react';
import { useStore } from '@/state/store';
import { resolveMetricsConfig } from '@/state/metrics';
import type { FactoryMetricSeries, FactoryMetricSeriesId, MetricSample } from '@/state/types';
import {
  summarizeSamples,
  buildSparklinePath,
  formatMetricValue,
  type MetricSummary,
} from './FactoryMetricsShared';
import './FactoryMetrics.css';

const SERIES_ORDER: FactoryMetricSeriesId[] = ['oreIn', 'barsOut', 'energyUse', 'haulerThroughput'];

const METRIC_META: Record<FactoryMetricSeriesId, { label: string; unit: string; color: string; description: string }> = {
  oreIn: {
    label: 'Ore Intake',
    unit: 'ore/min',
    color: '#f59e0b',
    description: 'Average ore delivered to the factory each minute.',
  },
  barsOut: {
    label: 'Bars Output',
    unit: 'bars/min',
    color: '#f97316',
    description: 'Finished bars produced per minute.',
  },
  energyUse: {
    label: 'Energy Usage',
    unit: 'energy/sec',
    color: '#38bdf8',
    description: 'Energy spent per second keeping the factory online.',
  },
  haulerThroughput: {
    label: 'Hauler Flow',
    unit: 'items/min',
    color: '#10b981',
    description: 'Items moved by haulers per minute.',
  },
};

const trimSamples = (samples: MetricSample[], limit = 64): MetricSample[] =>
  samples.length > limit ? samples.slice(samples.length - limit) : samples;

const formatElapsedTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0.9) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s ago`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.round(minutes)}m ago`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${Math.round(hours)}h ago`;
  }
  const days = hours / 24;
  return `${Math.round(days)}d ago`;
};

/**
 * Isolated component to handle high-frequency gameTime updates
 * independent of the main metrics tab re-renders.
 */
const LastSampleLabel = memo(({ latestSampleTimestamp }: { latestSampleTimestamp: number }) => {
  const gameTime = useStore((state) => state.gameTime);

  if (latestSampleTimestamp <= 0) return null;

  const secondsSince = Math.max(0, gameTime - latestSampleTimestamp / 1000);
  const label = formatElapsedTime(secondsSince);

  return (
    <p className="factory-metrics-banner__note">
      Last sample {label}
    </p>
  );
});
LastSampleLabel.displayName = 'LastSampleLabel';

interface MetricsCardProps {
  metric: FactoryMetricSeriesId;
  samples: MetricSample[];
  summary: MetricSummary;
}

const MetricsCard = memo(({ metric, samples, summary }: MetricsCardProps) => {
  const meta = METRIC_META[metric];
  const trimmed = useMemo(() => trimSamples(samples), [samples]);
  const path = useMemo(() => buildSparklinePath(trimmed, 160, 48), [trimmed]);
  const statsId = useId();

  const sparklineDescription = summary.hasData
    ? `${meta.label} recent values — last ${formatMetricValue(summary.last)} ${meta.unit}, average ${formatMetricValue(summary.average)}, peak ${formatMetricValue(summary.max)}, low ${formatMetricValue(summary.min)} across ${trimmed.length} samples.`
    : `${meta.label} sparkline is waiting for samples.`;

  return (
    <section
      className="factory-metrics-card"
      aria-label={`${meta.label} metrics`}
      title={sparklineDescription}
    >
      <header className="factory-metrics-card__header">
        <div>
          <p className="factory-metrics-card__label">{meta.label}</p>
          <p className="factory-metrics-card__description">{meta.description}</p>
        </div>
        <p className="factory-metrics-card__value">
          {summary.hasData ? formatMetricValue(summary.last) : '—'}
          <span className="factory-metrics-card__unit">{meta.unit}</span>
        </p>
      </header>
      {summary.hasData ? (
        <svg
          className="factory-metrics-card__sparkline"
          viewBox="0 0 160 48"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${meta.label} sparkline over last ${trimmed.length} samples`}
          aria-describedby={statsId}
          focusable="false"
        >
          <title>{sparklineDescription}</title>
          <path d={path} fill="none" stroke={meta.color} strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      ) : (
        <p className="factory-metrics-card__empty">Waiting for samples…</p>
      )}
      <dl className="factory-metrics-card__stats" id={statsId}>
        <div>
          <dt>Average</dt>
          <dd>{summary.hasData ? `${formatMetricValue(summary.average)} ${meta.unit}` : '—'}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{summary.hasData ? `${formatMetricValue(summary.max)} ${meta.unit}` : '—'}</dd>
        </div>
        <div>
          <dt>Low</dt>
          <dd>{summary.hasData ? `${formatMetricValue(summary.min)} ${meta.unit}` : '—'}</dd>
        </div>
      </dl>
    </section>
  );
});
MetricsCard.displayName = 'MetricsCard';

export interface FactoryMetricsTabProps {
  factoryId: string | null;
}

export const FactoryMetricsTab = ({ factoryId }: FactoryMetricsTabProps) => {
  const settings = useStore((state) => state.settings);
  const metrics = useStore((state) => state.metrics);
  const updateSettings = useStore((state) => state.updateSettings);
  // gameTime removed to prevent high-frequency re-renders

  const config = useMemo(() => resolveMetricsConfig(settings), [settings]);
  const intervalSeconds = Math.round(config.intervalMs / 1000);
  const retentionSeconds = Math.round(config.retentionMs / 1000);
  const retentionLabel =
    retentionSeconds >= 60 ? `${Math.round(retentionSeconds / 60)}m` : `${retentionSeconds}s`;
  const activeSeries: FactoryMetricSeries | undefined = factoryId
    ? metrics.series[factoryId]
    : undefined;

  // Memoize cards calculation to avoid reprocessing on every render if metrics haven't changed
  const cards = useMemo(() => SERIES_ORDER.map((metric) => {
    const samples = activeSeries?.[metric] ?? [];
    return {
      metric,
      samples,
      summary: summarizeSamples(samples),
    };
  }), [activeSeries]);

  const hasData = useMemo(() => cards.some((card) => card.summary.hasData), [cards]);

  const latestSampleTimestamp = useMemo(() => cards.reduce((latest, card) => {
    if (!card.summary.hasData || card.samples.length === 0) {
      return latest;
    }
    const lastSample = card.samples[card.samples.length - 1];
    return lastSample.ts > latest ? lastSample.ts : latest;
  }, 0), [cards]);

  if (!factoryId) {
    return (
      <div className="factory-metrics-message">
        <p>Select a factory to inspect live metrics.</p>
      </div>
    );
  }

  if (!settings.metrics.enabled) {
    return (
      <div className="factory-metrics-message">
        <p>
          Factory metrics are disabled in Settings. Enable “Factory metrics” inside the Metrics
          section to begin sampling.
        </p>
        <button
          type="button"
          className="factory-metrics-message__action"
          onClick={() =>
            updateSettings({
              metrics: { ...settings.metrics, enabled: true },
            })
          }
        >
          Enable metrics
        </button>
      </div>
    );
  }

  return (
    <div className="factory-metrics-tab">
      <div className="factory-metrics-banner">
        <p>
          Sampling every <strong>{intervalSeconds}s</strong> with a retention window of{' '}
          <strong>{retentionLabel}</strong>.
        </p>
        <div className="factory-metrics-banner__actions">
          <button
            type="button"
            onClick={() =>
              updateSettings({
                metrics: { ...settings.metrics, enabled: false },
              })
            }
          >
            Pause sampling
          </button>
        </div>
        {config.mode === 'throttled' ? (
          <p className="factory-metrics-banner__note">
            Low performance profile detected — sampling slows to preserve frame time.
          </p>
        ) : null}

        {/* Isolated component for high-frequency updates */}
        {hasData && latestSampleTimestamp > 0 ? (
          <LastSampleLabel latestSampleTimestamp={latestSampleTimestamp} />
        ) : null}

        {!hasData ? (
          <p className="factory-metrics-banner__note">
            Metrics populate after one sampling interval. Keep the factory running to gather data.
          </p>
        ) : null}
      </div>
      <div className="factory-metrics-grid">
        {cards.map(({ metric, samples, summary }) => (
          <MetricsCard key={metric} metric={metric} samples={samples} summary={summary} />
        ))}
      </div>
    </div>
  );
};
