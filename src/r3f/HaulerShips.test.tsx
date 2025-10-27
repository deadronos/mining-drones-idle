import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Vector3 } from 'three';
import { computeHaulerProgress, evaluateCubicBezier, __internal } from '@/r3f/HaulerShips';
import { storeApi, serializeStore, stringifySnapshot } from '@/state/store';
import { WAREHOUSE_NODE_ID } from '@/ecs/logistics';
import type { PendingTransfer } from '@/state/store';

describe('r3f/HaulerShips', () => {
  let snapshotPayload: string;

  beforeEach(() => {
    snapshotPayload = stringifySnapshot(serializeStore(storeApi.getState()));
  });

  afterEach(() => {
    storeApi.getState().importState(snapshotPayload);
  });

  it('evaluates cubic Bezier curves at key points', () => {
    const start = new Vector3(0, 0, 0);
    const control1 = new Vector3(1, 2, 0);
    const control2 = new Vector3(3, 2, 0);
    const end = new Vector3(4, 0, 0);
    const target = new Vector3();

    evaluateCubicBezier(start, control1, control2, end, 0, target);
    expect(target.x).toBeCloseTo(0);
    expect(target.y).toBeCloseTo(0);

    evaluateCubicBezier(start, control1, control2, end, 0.5, target);
    expect(target.x).toBeGreaterThan(1.9);
    expect(target.x).toBeLessThan(2.1);
    expect(target.y).toBeGreaterThan(1.4);

    evaluateCubicBezier(start, control1, control2, end, 1, target);
    expect(target.x).toBeCloseTo(4);
    expect(target.y).toBeCloseTo(0);
  });

  it('computes clamped hauler progress', () => {
    const transfer = { departedAt: 10, eta: 20 };
    expect(computeHaulerProgress(transfer, 5)).toBe(0);
    expect(computeHaulerProgress(transfer, 15)).toBeCloseTo(0.5);
    expect(computeHaulerProgress(transfer, 25)).toBe(1);
  });

  it('computes hauler visuals with factory identifiers and speed', () => {
    const baseState = storeApi.getState();
    const [factoryA] = baseState.factories;
    const factoryB = { ...factoryA, id: 'factory-b', position: new Vector3(12, 0, -6) };
    const now = baseState.gameTime;

    const transfers: PendingTransfer[] = [
      {
        id: 'transfer-1',
        fromFactoryId: factoryA.id,
        toFactoryId: factoryB.id,
        resource: 'ore',
        amount: 24,
        status: 'in-transit',
        eta: now + 6,
        departedAt: now,
      },
      {
        id: 'transfer-2',
        fromFactoryId: WAREHOUSE_NODE_ID,
        toFactoryId: factoryA.id,
        resource: 'bars',
        amount: 12,
        status: 'in-transit',
        eta: now + 9,
        departedAt: now + 1,
      },
    ];

    const visuals = __internal.computeVisuals(transfers, [factoryA, factoryB]);
    expect(visuals).toHaveLength(2);
    const [first, second] = visuals;
    expect(first.sourceFactoryId).toBe(factoryA.id);
    expect(first.destFactoryId).toBe(factoryB.id);
    expect(first.averageSpeed).toBeGreaterThan(0);
    expect(second.sourceFactoryId).toBeNull();
    expect(second.destFactoryId).toBe(factoryA.id);
    expect(second.averageSpeed).toBeGreaterThan(0);
  });
});
