import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { computeAutofitCamera, type AutofitConfig } from './camera';

const CONFIG: AutofitConfig = {
  margin: 6,
  maxZoom: 2.5,
  easeTime: 0.5,
};

describe('computeAutofitCamera', () => {
  it('zooms out enough to include widely spaced factories', () => {
    const positions = [new Vector3(-60, 0, 0), new Vector3(60, 0, 0)];

    const result = computeAutofitCamera(positions, CONFIG);

    expect(result).not.toBeNull();
    expect(result?.zoom ?? 1).toBeLessThan(0.3);
  });

  it('caps zoom when factories are clustered together', () => {
    const positions = [new Vector3(1, 2, 0), new Vector3(2, 3, 0)];

    const result = computeAutofitCamera(positions, CONFIG);

    expect(result).not.toBeNull();
    expect(result?.zoom ?? 0).toBeLessThanOrEqual(CONFIG.maxZoom);
  });

  it('returns null when no positions are provided', () => {
    expect(computeAutofitCamera([], CONFIG)).toBeNull();
  });
});
