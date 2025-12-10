import { renderHook, act } from '@testing-library/react';
import { useRustHUD } from '../useRustHUD';
import { useStore } from '@/state/store';
import { registerBridge, unregisterBridge } from '@/lib/rustBridgeRegistry';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useRustHUD', () => {
  beforeEach(() => {
    useStore.setState({
      settings: { useRustSim: false },
      resources: {
        ore: 100,
        ice: 0,
        metals: 0,
        crystals: 0,
        organics: 0,
        bars: 0,
        energy: 0,
        credits: 0,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as any); // Using any to bypass deep partial requirement for test setup
    unregisterBridge();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns store resources when useRustSim is false', () => {
    const { result } = renderHook(() => useRustHUD());
    expect(result.current.isRustActive).toBe(false);
    expect(result.current.resources.ore).toBe(100);
  });

  it('returns bridge resources when useRustSim is true and bridge ready', async () => {
    const mockBridge = {
      isReady: () => true,
      getGlobalResources: () => new Float32Array([10, 20, 30, 40, 50, 60, 70, 80]),
      getFactoryResources: () => new Float32Array(7),
      getFactoryEnergy: () => new Float32Array(1),
      getFactoryHaulersAssigned: () => new Float32Array(1),
    } as unknown as RustSimBridge;

    registerBridge(mockBridge);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore.setState({ settings: { useRustSim: true } } as unknown as any);

    const { result } = renderHook(() => useRustHUD());

    // Advance time to allow RAF loop to run
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isRustActive).toBe(true);
    expect(result.current.resources.ore).toBe(10);
    expect(result.current.resources.ice).toBe(20);
    expect(result.current.resources.energy).toBe(70);
  });

  it('handles bridge factory access', async () => {
    const mockBridge = {
      isReady: () => true,
      getGlobalResources: () => new Float32Array(8),
      getFactoryResources: (idx: number) => {
        if (idx === 0) return new Float32Array([1, 2, 3, 4, 5, 6, 7]);
        return new Float32Array(7);
      },
      getFactoryEnergy: (_idx: number) => new Float32Array([100]),
      getFactoryHaulersAssigned: (_idx: number) => new Float32Array([5]),
    } as unknown as RustSimBridge;

    registerBridge(mockBridge);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore.setState({ settings: { useRustSim: true } } as unknown as any);

    const { result } = renderHook(() => useRustHUD());

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const factoryData = result.current.getFactory(0);
    expect(factoryData).not.toBeNull();
    expect(factoryData?.resources.ore).toBe(1);
    expect(factoryData?.resources.ice).toBe(2);
    expect(factoryData?.energy).toBe(100);
    expect(factoryData?.haulersAssigned).toBe(5);
  });

  it('falls back to inactive if bridge throws', async () => {
     const mockBridge = {
      isReady: () => true,
      getGlobalResources: () => { throw new Error('memory access error'); }
    } as unknown as RustSimBridge;

    registerBridge(mockBridge);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore.setState({ settings: { useRustSim: true } } as unknown as any);

    const { result } = renderHook(() => useRustHUD());

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isRustActive).toBe(false);
  });
});
