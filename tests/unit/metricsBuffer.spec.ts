import { describe, expect, it } from 'vitest';
import {
  appendSample,
  cloneSeries,
  createEmptySeries,
  METRIC_SERIES_IDS,
} from '@/state/metrics/buffers';

const sample = (value: number) => ({ ts: value * 1000, value });

describe('state/metrics/buffers', () => {
  it('creates an empty series with entries for every metric id', () => {
    const series = createEmptySeries();

    expect(Object.keys(series)).toEqual(METRIC_SERIES_IDS);
    for (const id of METRIC_SERIES_IDS) {
      expect(series[id]).toEqual([]);
    }
  });

  it('appends samples while enforcing maximum capacity', () => {
    const base = [sample(1), sample(2), sample(3)];

    const extended = appendSample(base, sample(4), 5);
    expect(extended).toHaveLength(4);
    expect(extended.at(-1)?.value).toBe(4);

    const rotated = appendSample(extended, sample(5), 4);
    expect(rotated).toHaveLength(4);
    expect(rotated[0]?.value).toBe(2);
    expect(rotated.at(-1)?.value).toBe(5);

    const cleared = appendSample(rotated, sample(6), 0);
    expect(cleared).toHaveLength(0);
  });

  it('clones series deeply to avoid cross-mutation', () => {
    const base = createEmptySeries();
    base.oreIn = [sample(1)];

    const clone = cloneSeries(base);
    expect(clone).not.toBe(base);
    expect(clone.oreIn).not.toBe(base.oreIn);
    expect(clone.oreIn).toEqual(base.oreIn);

    clone.oreIn.push(sample(2));
    expect(base.oreIn).toEqual([sample(1)]);
    expect(clone.oreIn).toHaveLength(2);
  });
});
