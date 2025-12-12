import React from 'react';
import { render, act } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { createFactory } from '@/ecs/factories';
import { Vector3 } from 'three';
import { storeApi } from '@/state/store';

// Mock the FactoryModel and FactoryTransferFX so rendering is lightweight
vi.mock('@/r3f/Factory/FactoryModel', () => ({ FactoryModel: ({ factory }: { factory: { id: string } }) => <div>{factory.id}</div> }));
vi.mock('@/r3f/Factory/FactoryTransferFX', () => ({ FactoryTransferFX: () => null }));

import { Factory } from '@/r3f/Factory';

describe('r3f/Factory direct bridge polling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset store to multiple factories
    const fA = createFactory('factory-a', new Vector3(0, 0, 0));
    const fB = createFactory('factory-b', new Vector3(10, 0, 0));
    const fC = createFactory('factory-c', new Vector3(20, 0, 0));
    act(() => {
      storeApi.setState({ factories: [fA, fB, fC], settings: { ...storeApi.getState().settings, useRustSim: true } });
    });
  });

  it('does not poll per-factory resource/energy/hauler buffers directly from the bridge', () => {
    const getFactoryPositions = vi.fn().mockReturnValue(new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]));
    const getFactoryResources = vi.fn().mockReturnValue(new Float32Array(21));
    const getFactoryEnergy = vi.fn().mockReturnValue(new Float32Array(3));
    const getFactoryMaxEnergy = vi.fn().mockReturnValue(new Float32Array(3));
    const getFactoryHaulersAssigned = vi.fn().mockReturnValue(new Float32Array(3));

    const bridge: RustSimBridge = {
      isReady: () => true,
      getFactoryPositions,
      getFactoryResources,
      getFactoryEnergy,
      getFactoryMaxEnergy,
      getFactoryHaulersAssigned,
    } as unknown as RustSimBridge;

    registerBridge(bridge);

    render(<Factory />);

    // Positions should be read for animation
    expect(getFactoryPositions).toHaveBeenCalled();

    // Other per-factory buffers should NOT be polled by Factory component (store is authoritative)
    expect(getFactoryResources).not.toHaveBeenCalled();
    expect(getFactoryEnergy).not.toHaveBeenCalled();
    expect(getFactoryMaxEnergy).not.toHaveBeenCalled();
    expect(getFactoryHaulersAssigned).not.toHaveBeenCalled();

    // Clean up the bridge
    registerBridge(null);
  });
});
