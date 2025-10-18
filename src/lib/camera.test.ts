import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { computeAutofitCamera, type AutofitConfig } from './camera';

const CONFIG: AutofitConfig = {
  margin: 6,
  maxZoom: 2.5,
  easeTime: 0.5,
};

const DEFAULT_FOV = 52;
const DEFAULT_ASPECT = 1.5;

describe('computeAutofitCamera', () => {
  it('positions camera farther away for widely spaced factories', () => {
    const positions = [new Vector3(-60, 0, 0), new Vector3(60, 0, 0)];

    const result = computeAutofitCamera(positions, CONFIG, DEFAULT_FOV, DEFAULT_ASPECT);

    expect(result).not.toBeNull();
    // For widely spaced factories, camera should be far away (large distance)
    expect(result?.distance ?? 0).toBeGreaterThan(60);
    // Camera position should be elevated and behind the center
    expect(result?.position.y).toBeGreaterThan(0);
    expect(result?.position.z).toBeGreaterThan(10);
  });

  it('positions camera closer for clustered factories', () => {
    const positions = [new Vector3(1, 2, 0), new Vector3(2, 3, 0)];

    const result = computeAutofitCamera(positions, CONFIG, DEFAULT_FOV, DEFAULT_ASPECT);

    expect(result).not.toBeNull();
    // For clustered factories, camera can be closer (smaller distance)
    expect(result?.distance ?? Infinity).toBeLessThan(40);
    // But should maintain minimum distance
    expect(result?.position.z).toBeGreaterThan(8);
  });

  it('returns null when no positions are provided', () => {
    expect(computeAutofitCamera([], CONFIG, DEFAULT_FOV, DEFAULT_ASPECT)).toBeNull();
  });

  it('centers camera on factory cluster', () => {
    const positions = [new Vector3(-10, 0, 0), new Vector3(10, 0, 0), new Vector3(0, 15, 0)];

    const result = computeAutofitCamera(positions, CONFIG, DEFAULT_FOV, DEFAULT_ASPECT);

    expect(result).not.toBeNull();
    // Camera X should be near center (around 0)
    expect(Math.abs(result?.position.x ?? 100)).toBeLessThan(5);
    // Camera should look at the vertical center (around 5)
    expect(result?.position.y).toBeGreaterThan(0);
  });
});
