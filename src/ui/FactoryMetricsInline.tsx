import { useId, useMemo } from 'react';
import { useStore } from '@/state/store';
import type { MetricSample } from '@/state/types';
import { summarizeSamples, buildSparklinePath, formatMetricValue } from './FactoryMetricsShared';
import './FactoryMetrics.css';

export interface FactoryMetricsInlineProps {
  factoryId: string;
}

const trimInlineSamples = (samples: MetricSample[], limit = 32): MetricSample[] =>
  samples.length > limit ? samples.slice(samples.length - limit) : samples;

const EMPTY_SAMPLES: MetricSample[] = [];

export const FactoryMetricsInline = ({ factoryId }: FactoryMetricsInlineProps) => {
  const metricsSettings = useStore((state) => state.settings.metrics);
  const series = useStore((state) => state.metrics.series[factoryId]);

  const samples = series?.barsOut ?? EMPTY_SAMPLES;
  const summary = useMemo(() => summarizeSamples(samples), [samples]);
  const trimmed = useMemo(() => trimInlineSamples(samples), [samples]);
  const valueId = useId();
  const description = summary.hasData
    ? `Bars output trend for ${factoryId}. Last ${formatMetricValue(summary.last)} bars/min, average ${formatMetricValue(summary.average)}, peak ${formatMetricValue(summary.max)}, low ${formatMetricValue(summary.min)} across ${trimmed.length} samples.`
    : `Bars output trend for ${factoryId} is waiting for samples.`;
  const path = useMemo(() => buildSparklinePath(trimmed, 96, 28), [trimmed]);

  if (!metricsSettings.enabled || !summary.hasData) {
    return null;
  }

  return (
    <div
      className="factory-metrics-inline"
      aria-label={description}
      aria-describedby={valueId}
      title={description}
    >
      <svg
        className="factory-metrics-inline__sparkline"
        viewBox="0 0 96 28"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Bars output sparkline showing ${trimmed.length} samples`}
        aria-describedby={valueId}
        focusable="false"
      >
        <title>{description}</title>
        <path d={path} fill="none" stroke="#f97316" strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      <span className="factory-metrics-inline__value" id={valueId}>
        {formatMetricValue(summary.last)} <span className="factory-metrics-inline__unit">bars/min</span>
      </span>
    </div>
  );
};
