import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { DOCKING_RING_ROTATION_SPEED, updateDockingRingRotation } from './warehouseHelpers';

describe('r3f/Warehouse helpers', () => {
  it('exposes the configured rotation speed constant', () => {
    expect(DOCKING_RING_ROTATION_SPEED).toBeCloseTo(0.5);
  });

  it('rotates the docking ring proportionally to delta time', () => {
    const ring = new Group();
    updateDockingRingRotation(ring, 0.4);
    expect(ring.rotation.y).toBeCloseTo(0.4 * DOCKING_RING_ROTATION_SPEED);

    updateDockingRingRotation(ring, 0.2);
    expect(ring.rotation.y).toBeCloseTo((0.4 + 0.2) * DOCKING_RING_ROTATION_SPEED);
  });
});
