import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import { TrailBuffer, type DroneTrailSource } from '@/r3f/trailsBuffer';
import { colorForState } from '@/r3f/droneColors';

describe('r3f/trailsBuffer', () => {
  it('seeds history with the current position when a new drone id appears', () => {
    const background = new Color('#000000');
    const buffer = new TrailBuffer({ points: 4, background, limit: 2 });
    const drone: DroneTrailSource = { id: 'd1', position: new Vector3(1, 2, 3), state: 'mining' };
    const vertices = buffer.update([drone]);
    expect(vertices).toBe(6); // (points - 1) * 2 vertices

    const positions = Array.from(buffer.positions.slice(0, 6));
    expect(positions).toEqual([1, 2, 3, 1, 2, 3]);

    const baseColor = colorForState('mining').clone();
    const expectedEnd = baseColor.clone().lerp(background, 1 / 3);
    expect(buffer.colors[0]).toBeCloseTo(baseColor.r, 5);
    expect(buffer.colors[1]).toBeCloseTo(baseColor.g, 5);
    expect(buffer.colors[2]).toBeCloseTo(baseColor.b, 5);
    expect(buffer.colors[3]).toBeCloseTo(expectedEnd.r, 5);
    expect(buffer.colors[4]).toBeCloseTo(expectedEnd.g, 5);
    expect(buffer.colors[5]).toBeCloseTo(expectedEnd.b, 5);
  });

  it('shifts history forward as drones move', () => {
    const buffer = new TrailBuffer({ points: 3, limit: 1 });
    const drone: DroneTrailSource = { id: 'd1', position: new Vector3(0, 0, 0), state: 'idle' };
    buffer.update([drone]);
    drone.position.set(5, 0, 0);
    buffer.update([drone]);
    const positions = Array.from(buffer.positions.slice(0, 6));
    expect(positions).toEqual([5, 0, 0, 0, 0, 0]);
  });

  it('clears trailing history when drones are removed or slots reused', () => {
    const buffer = new TrailBuffer({ points: 3, limit: 2 });
    const droneA: DroneTrailSource = { id: 'a', position: new Vector3(1, 0, 0), state: 'idle' };
    const droneB: DroneTrailSource = { id: 'b', position: new Vector3(2, 0, 0), state: 'idle' };
    buffer.update([droneA, droneB]);
    buffer.update([]);
    expect(buffer.vertexCount).toBe(0);
    expect(buffer.positions.every((value) => value === 0)).toBe(true);

    const droneC: DroneTrailSource = { id: 'c', position: new Vector3(3, 0, 0), state: 'idle' };
    buffer.update([droneC]);
    const positions = Array.from(buffer.positions.slice(0, 6));
    expect(positions).toEqual([3, 0, 0, 3, 0, 0]);
  });

  it('respects the configured limit when more drones are provided', () => {
    const buffer = new TrailBuffer({ limit: 1, points: 3 });
    const droneA: DroneTrailSource = { id: 'a', position: new Vector3(0, 0, 0), state: 'idle' };
    const droneB: DroneTrailSource = { id: 'b', position: new Vector3(1, 0, 0), state: 'idle' };
    const vertices = buffer.update([droneA, droneB]);
    expect(vertices).toBe(4);
    const positions = Array.from(buffer.positions.slice(0, 6));
    expect(positions).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
