import { useId, useMemo } from 'react';
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

interface MetricsCardProps {
  metric: FactoryMetricSeriesId;
  samples: MetricSample[];
  summary: MetricSummary;
}

const MetricsCard = ({ metric, samples, summary }: MetricsCardProps) => {
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
};

export interface FactoryMetricsTabProps {
  factoryId: string | null;
}

export const FactoryMetricsTab = ({ factoryId }: FactoryMetricsTabProps) => {
  const settings = useStore((state) => state.settings);
  const metrics = useStore((state) => state.metrics);
  const updateSettings = useStore((state) => state.updateSettings);

  const config = useMemo(() => resolveMetricsConfig(settings), [settings]);
  const intervalSeconds = Math.round(config.intervalMs / 1000);
  const retentionSeconds = Math.round(config.retentionMs / 1000);
  const retentionLabel =
    retentionSeconds >= 60 ? `${Math.round(retentionSeconds / 60)}m` : `${retentionSeconds}s`;
  const activeSeries: FactoryMetricSeries | undefined = factoryId
    ? metrics.series[factoryId]
    : undefined;

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

  const cards = SERIES_ORDER.map((metric) => {
    const samples = activeSeries?.[metric] ?? [];
    return {
      metric,
      samples,
      summary: summarizeSamples(samples),
    };
  });

  const hasData = cards.some((card) => card.summary.hasData);

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
