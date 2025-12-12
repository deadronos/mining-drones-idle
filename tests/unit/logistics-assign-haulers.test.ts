import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import { registerBridge } from '@/lib/rustBridgeRegistry';
import { createStoreInstance } from '@/state/store';

describe('logistics assignHaulers -> Rust bridge write/read', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    registerBridge(null);
  });

  it('calls applyCommand and updates store with authoritative hauler count after readback (purchase fails)', () => {
    // Prepare store with a single factory that cannot purchase (no bars)
    const factory = createFactory('factory-1', new Vector3(0, 0, 0));
    factory.resources.bars = 0; // cannot afford purchasing a hauler
    factory.haulersAssigned = 1;
    const store = createStoreInstance();
    store.setState({ factories: [factory], settings: { ...store.getState().settings, useRustSim: true } });

    // Mock bridge that will accept command and report higher hauler count (3)
    const applyCommandSpy = vi.fn();
    const getHaulers = vi.fn().mockReturnValue(new Float32Array([3]));
    const bridgeMock: RustSimBridge = {
      isReady: () => true,
      applyCommand: applyCommandSpy,
      getFactoryHaulersAssigned: getHaulers,
    } as unknown as RustSimBridge;

    registerBridge(bridgeMock);

    // Call assignHaulers with delta=1 (purchase) — TS purchase fails due to 0 bars
    const result = store.getState().assignHaulers('factory-1', 1);
    // TS purchase should return false (purchase unsuccessful)
    expect(result).toBe(false);

    // Verify bridge applyCommand was called
    expect(applyCommandSpy).toHaveBeenCalledTimes(1);
    expect(applyCommandSpy).toHaveBeenCalledWith({ type: 'AssignHauler', payload: { factoryId: 'factory-1', count: 1 } });
    expect(getHaulers).toHaveBeenCalled();

    // Readback from bridge should have been applied to store (haulersAssigned becomes 3)
    const haulersAfter = store.getState().factories[0].haulersAssigned;
    expect(haulersAfter).toBe(3);
  });

  it('calls applyCommand and updates store with authoritative hauler count after readback (negative delta)', () => {
    const factory = createFactory('factory-1', new Vector3(0, 0, 0));
    factory.resources.bars = 100; // doesn't matter for negative delta
    factory.haulersAssigned = 5;
    const store2 = createStoreInstance();
    store2.setState({ factories: [factory], settings: { ...store2.getState().settings, useRustSim: true } });

    const applyCommandSpy = vi.fn();
    const getHaulers = vi.fn().mockReturnValue(new Float32Array([2]));
    const bridgeMock: RustSimBridge = {
      isReady: () => true,
      applyCommand: applyCommandSpy,
      getFactoryHaulersAssigned: getHaulers,
    } as unknown as RustSimBridge;
    registerBridge(bridgeMock);

    const result = store2.getState().assignHaulers('factory-1', -3);
    // Negative delta performs a TS update; result should be true (updated)
    expect(result).toBe(true);
    expect(applyCommandSpy).toHaveBeenCalledTimes(1);
    expect(applyCommandSpy).toHaveBeenCalledWith({ type: 'AssignHauler', payload: { factoryId: 'factory-1', count: -3 } });

    const haulersAfter = store2.getState().factories[0].haulersAssigned;
    // After bridge readback (2) then negative delta (-3) is applied, final count clamps to 0
    expect(haulersAfter).toBe(0);
  });
});
