import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { storeApi } from '@/state/store';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

// Capture useFrame callback
let frameCallback: ((state: unknown, delta: number) => void) | null = null;

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frameCallback = cb;
  },
  useThree: () => ({ camera: {}, size: { width: 100, height: 100 } }),
  Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock child components to avoid rendering issues
vi.mock('@react-three/drei', () => ({ Stars: () => null }));
vi.mock('@/r3f/Asteroids', () => ({ Asteroids: () => null }));
vi.mock('@/r3f/Drones', () => ({ Drones: () => null }));
vi.mock('@/r3f/RustAsteroids', () => ({ RustAsteroids: () => null }));
vi.mock('@/r3f/RustDrones', () => ({ RustDrones: () => null }));
vi.mock('@/r3f/Factory', () => ({ Factory: () => null }));
vi.mock('@/r3f/Warehouse', () => ({ Warehouse: () => null }));
vi.mock('@/r3f/DroneTrails', () => ({ DroneTrails: () => null }));
vi.mock('@/r3f/HaulerShips', () => ({ HaulerShips: () => null }));
vi.mock('@/r3f/TransferLines', () => ({ TransferLines: () => null }));

// Mock UI sub-components
vi.mock('@/ui/ResourceModifiersDebug', () => ({ ResourceModifiersDebug: () => null }));
vi.mock('@/ui/WarehousePanel/HaulerModulesPanel', () => ({ HaulerModulesPanel: () => null }));
vi.mock('@/ui/WarehousePanel/SpecializationTechsPanel', () => ({ SpecializationTechsPanel: () => null }));
vi.mock('@/ui/WarehousePanel/InvestmentBoardPanel', () => ({ InvestmentBoardPanel: () => null }));

// Mock hooks
vi.mock('@/hooks/useFactoryAutofit', () => ({ useFactoryAutofit: () => undefined }));
vi.mock('@/hooks/useCameraReset', () => ({ useCameraReset: () => undefined }));
vi.mock('@/lib/parityLogger', () => ({ checkParity: () => null }));

// Mock ECS systems
const noop = () => undefined;
vi.mock('@/ecs/systems/time', () => ({ createTimeSystem: () => ({ update: (_s: number, cb: (runner: () => void) => void) => cb(noop) }) }));
vi.mock('@/ecs/systems/fleet', () => ({ createFleetSystem: () => noop }));
vi.mock('@/ecs/systems/asteroids', () => ({ createAsteroidSystem: () => noop }));
vi.mock('@/ecs/systems/droneAI', () => ({ createDroneAISystem: () => noop }));
vi.mock('@/ecs/systems/travel', () => ({ createTravelSystem: () => noop }));
vi.mock('@/ecs/systems/mining', () => ({ createMiningSystem: () => noop }));
vi.mock('@/ecs/systems/unload', () => ({ createUnloadSystem: () => noop }));
vi.mock('@/ecs/systems/power', () => ({ createPowerSystem: () => noop }));
vi.mock('@/ecs/systems/refinery', () => ({ createRefinerySystem: () => noop }));
vi.mock('@/ecs/systems/biomes', () => ({ createBiomeSystem: () => noop }));

// Mock useRustEngine
const mockUseRustEngine = vi.fn();
vi.mock('@/hooks/useRustEngine', async () => ({ useRustEngine: (...args: unknown[]) => mockUseRustEngine(...args) }));

// Import components under test
import { Scene } from '@/r3f/Scene';
import { LogisticsPanel } from '@/ui/LogisticsPanel';
import { WarehousePanel } from '@/ui/WarehousePanel';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { createFactory } from '@/ecs/factories';
import { Vector3 } from 'three';

describe('Rust Resource Sync Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    frameCallback = null;

    // Reset store state
    act(() => {
      storeApi.setState({
        resources: {
          ore: 0,
          ice: 0,
          metals: 0,
          crystals: 0,
          organics: 0,
          bars: 0,
          energy: 0,
          credits: 0,
        },
        settings: {
          useRustSim: true, // Enable Rust sim
          showTrails: false,
          showHaulerShips: false,
          shadowMode: false,
          autosaveEnabled: false,
          autosaveInterval: 60,
          offlineCapHours: 24,
          notation: 'standard',
          throttleFloor: 10,
          showDebugPanel: false,
          performanceProfile: 'high',
          inspectorCollapsed: false,
          metrics: { enabled: false, intervalSeconds: 1, retentionSeconds: 60 },
        },
        logisticsQueues: {
          pendingTransfers: [],
        }
      });
    });
  });

  it('syncs resources from Rust bridge to store every 6 frames', () => {
    // Setup mock bridge
    const mockResources = new Float64Array([100, 200, 300, 400, 500, 600, 700, 800]);
    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(mockResources),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);

    // Verify useFrame was called
    expect(frameCallback).toBeTruthy();

    // Advance 5 frames - should NOT sync yet (mod 6)
    if (frameCallback) {
      // Frame 1
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).not.toHaveBeenCalled();

      // Frame 2
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).not.toHaveBeenCalled();

      // Frame 3
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).not.toHaveBeenCalled();

      // Frame 4
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).not.toHaveBeenCalled();

      // Frame 5
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).not.toHaveBeenCalled();

      // Frame 6 -> 6 % 6 === 0 -> Sync!
      act(() => frameCallback!(null, 0.016));
      expect(mockBridge.getGlobalResources).toHaveBeenCalled();
    }

    // Verify store was updated
    const resources = storeApi.getState().resources;
    expect(resources).toEqual({
      ore: 100,
      ice: 200,
      metals: 300,
      crystals: 400,
      organics: 500,
      bars: 600,
      energy: 700,
      credits: 800,
    });
  });

  it('updates LogisticsPanel when Rust resources sync', () => {
    // Setup mock bridge with specific values
    const mockResources = new Float64Array([0, 0, 0, 0, 0, 1234, 0, 0]); // 1234 bars
    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(mockResources),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    // Render Scene (for sync logic) and LogisticsPanel (for UI verification)
    render(
      <>
        <Scene />
        <LogisticsPanel />
      </>
    );

    // Initial state check - should be 0
    // LogisticsPanel renders "Warehouse Bars:" then the value
    // We can check for "1,234" later. Initially it should be 0.
    expect(screen.getByText(/Warehouse Bars:/i)).toBeDefined();

    // Trigger 6 frames to force a sync
    if (frameCallback) {
      for (let i = 0; i < 6; i++) {
        act(() => frameCallback!(null, 0.016));
      }
    }

    // Verify store updated
    expect(storeApi.getState().resources.bars).toBe(1234);

    // Verify UI updated
    // LogisticsPanel uses formatInteger which adds commas
    expect(screen.getByText('1,234')).toBeDefined();
  });

  it('updates WarehousePanel when Rust resources sync', () => {
    // Setup mock bridge with specific values
    const mockResources = new Float64Array([111, 222, 333, 444, 555, 666, 777, 888]);
    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(mockResources),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    // Render Scene and WarehousePanel
    render(
      <>
        <Scene />
        <WarehousePanel onOpenSettings={vi.fn()} />
      </>
    );

    // Initial check - should be 0
    expect(screen.getByText(/Warehouse/i)).toBeDefined();

    // Trigger 6 frames to force a sync
    if (frameCallback) {
      for (let i = 0; i < 6; i++) {
        act(() => frameCallback!(null, 0.016));
      }
    }

    // Verify store updated
    expect(storeApi.getState().resources.ore).toBe(111);
    expect(storeApi.getState().resources.bars).toBe(666);

    // Verify UI updated
    // WarehousePanel displays "Ore", "111.0" (formatDecimalOne)
    // "Bars", "666.0"
    expect(screen.getByText('111.0')).toBeDefined();
    expect(screen.getByText('666.0')).toBeDefined();
  });

  it('updates UpgradePanel when Rust resources sync', () => {
    // Setup mock bridge with specific values
    const mockResources = new Float64Array([0, 0, 0, 0, 0, 9999, 0, 0]); // 9999 bars
    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(mockResources),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    // Render Scene and UpgradePanel
    render(
      <>
        <Scene />
        <UpgradePanel />
      </>
    );

    // Initial check
    expect(screen.getByText(/Upgrades/i)).toBeDefined();

    // Trigger 6 frames to force a sync
    if (frameCallback) {
      for (let i = 0; i < 6; i++) {
        act(() => frameCallback!(null, 0.016));
      }
    }

    // Verify store updated
    expect(storeApi.getState().resources.bars).toBe(9999);

    // Verify UI updated
    // UpgradePanel displays "Warehouse Bars: {value}"
    expect(screen.getByText(/9,999/)).toBeDefined();
  });

  it('syncs per-factory buffers (resources/energy/haulers) into the store', () => {
    const mockResources = new Float32Array([111, 222, 333, 444, 555, 666, 777]); // ore..ice..metals..crystals..organics..bars..credits
    const mockEnergy = new Float32Array([123.5]);
    const mockMaxEnergy = new Float32Array([250]);
    const mockHaulers = new Float32Array([6]);

    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(new Float64Array([0, 0, 0, 0, 0, 0, 0, 0])),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
      getFactoryResources: vi.fn().mockReturnValue(mockResources),
      getFactoryEnergy: vi.fn().mockReturnValue(mockEnergy),
      getFactoryMaxEnergy: vi.fn().mockReturnValue(mockMaxEnergy),
      getFactoryHaulersAssigned: vi.fn().mockReturnValue(mockHaulers),
    } as unknown as RustSimBridge;

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);

    // Trigger 6 frames to force a sync
    if (frameCallback) {
      for (let i = 0; i < 6; i++) {
        act(() => frameCallback!(null, 0.016));
      }
    }

    // Check store factory data matches mocked values
    const factories = storeApi.getState().factories;
    expect(factories.length).toBeGreaterThan(0);
    const f0 = factories[0];
    expect(f0.resources.ore).toBe(111);
    expect(f0.resources.bars).toBe(666);
    expect(f0.energy).toBeCloseTo(123.5, 3);
    expect(f0.energyCapacity).toBe(250);
    expect(f0.haulersAssigned).toBe(6);
  });

  it('syncs multi-factory buffers into the store', () => {
    const fA = createFactory('factory-a', new Vector3(0, 0, 0));
    const fB = createFactory('factory-b', new Vector3(10, 0, 0));
    const fC = createFactory('factory-c', new Vector3(20, 0, 0));
    act(() => storeApi.setState({ factories: [fA, fB, fC] }));

    const resBuf = new Float32Array([
      // factory-a
      101, 11, 1, 2, 3, 4, 5,
      // factory-b
      201, 21, 2, 3, 4, 5, 6,
      // factory-c
      301, 31, 3, 4, 5, 6, 7,
    ]);
    const energyBuf = new Float32Array([10.5, 20.5, 30.5]);
    const maxEnergyBuf = new Float32Array([100, 200, 300]);
    const haulersBuf = new Float32Array([1, 2, 3]);

    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(new Float64Array([0, 0, 0, 0, 0, 0, 0, 0])),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
      getFactoryResources: vi.fn().mockReturnValue(resBuf),
      getFactoryEnergy: vi.fn().mockReturnValue(energyBuf),
      getFactoryMaxEnergy: vi.fn().mockReturnValue(maxEnergyBuf),
      getFactoryHaulersAssigned: vi.fn().mockReturnValue(haulersBuf),
    } as unknown as RustSimBridge;

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    if (frameCallback) {
      for (let i = 0; i < 6; i++) act(() => frameCallback!(null, 0.016));
    }

    const factories = storeApi.getState().factories;
    expect(factories[0].resources.ore).toBe(101);
    expect(factories[1].resources.ore).toBe(201);
    expect(factories[2].resources.ore).toBe(301);
    expect(factories[0].energy).toBeCloseTo(10.5, 3);
    expect(factories[1].energy).toBeCloseTo(20.5, 3);
    expect(factories[2].energy).toBeCloseTo(30.5, 3);
    expect(factories[0].haulersAssigned).toBe(1);
    expect(factories[1].haulersAssigned).toBe(2);
    expect(factories[2].haulersAssigned).toBe(3);
  });

  it('handles partial and invalid buffers (partial-length resource arrays)', () => {
    const fA = createFactory('factory-a', new Vector3(0, 0, 0));
    const fB = createFactory('factory-b', new Vector3(10, 0, 0));
    const fC = createFactory('factory-c', new Vector3(20, 0, 0));
    // Set distinct sentinel initial values
    fA.resources.ore = 1;
    fB.resources.ore = 2;
    fC.resources.ore = 3;
    fA.haulersAssigned = 4;
    fB.haulersAssigned = 5;
    fC.haulersAssigned = 6;
    act(() => storeApi.setState({ factories: [fA, fB, fC] }));

    // resources array only contains data for factory-a (7 entries), not others
    const resBuf = new Float32Array([555, 11, 1, 2, 3, 4, 5]);
    const energyBuf = new Float32Array([111, 222]); // for first 2 factories
    const haulersBuf = new Float32Array([7]); // only for first factory

    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(new Float64Array([0, 0, 0, 0, 0, 0, 0, 0])),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
      getFactoryResources: vi.fn().mockReturnValue(resBuf),
      getFactoryEnergy: vi.fn().mockReturnValue(energyBuf),
      getFactoryMaxEnergy: vi.fn().mockReturnValue(new Float32Array([50, 60])),
      getFactoryHaulersAssigned: vi.fn().mockReturnValue(haulersBuf),
    } as unknown as RustSimBridge;

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    if (frameCallback) {
      for (let i = 0; i < 6; i++) act(() => frameCallback!(null, 0.016));
    }

    const factories = storeApi.getState().factories;
    // factory-a should update
    expect(factories[0].resources.ore).toBe(555);
    expect(factories[0].haulersAssigned).toBe(7);
    expect(factories[0].energy).toBeCloseTo(111, 3);
    // factory-b energy updated, resources unchanged
    expect(factories[1].resources.ore).toBe(2);
    expect(factories[1].energy).toBeCloseTo(222, 3);
    // factory-c unchanged
    expect(factories[2].resources.ore).toBe(3);
    expect(factories[2].haulersAssigned).toBe(6);
  });

  it('sanitizes haulers (negative/NaN) and clamps to non-negative integers', () => {
    const fA = createFactory('factory-a', new Vector3(0, 0, 0));
    const fB = createFactory('factory-b', new Vector3(10, 0, 0));
    const fC = createFactory('factory-c', new Vector3(20, 0, 0));
    fA.haulersAssigned = 3;
    fB.haulersAssigned = 5;
    fC.haulersAssigned = 2;
    act(() => storeApi.setState({ factories: [fA, fB, fC] }));

    const haulersBuf = new Float32Array([-2, NaN, 2.7]);
    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(new Float64Array([0, 0, 0, 0, 0, 0, 0, 0])),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
      getFactoryResources: vi.fn().mockReturnValue(new Float32Array(21)),
      getFactoryEnergy: vi.fn().mockReturnValue(new Float32Array([0, 0, 0])),
      getFactoryMaxEnergy: vi.fn().mockReturnValue(new Float32Array([0, 0, 0])),
      getFactoryHaulersAssigned: vi.fn().mockReturnValue(haulersBuf),
    } as unknown as RustSimBridge;

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    if (frameCallback) {
      for (let i = 0; i < 6; i++) act(() => frameCallback!(null, 0.016));
    }

    const factories = storeApi.getState().factories;
    expect(factories[0].haulersAssigned).toBe(0); // clamped from -2 to 0
    expect(Number.isFinite(factories[1].haulersAssigned)).toBe(true); // NaN shouldn't be assigned
    // because NaN is not finite, we expect the value to be unchanged from previous (5)
    expect(factories[1].haulersAssigned).toBe(5);
    expect(factories[2].haulersAssigned).toBe(2); // 2.7 -> trunc(2)
  });

  it('ignores extra trailing values in buffers beyond factory count', () => {
    const fA = createFactory('factory-a', new Vector3(0, 0, 0));
    const fB = createFactory('factory-b', new Vector3(10, 0, 0));
    const fC = createFactory('factory-c', new Vector3(20, 0, 0));
    act(() => storeApi.setState({ factories: [fA, fB, fC] }));

    const resBuf = new Float32Array([
      1, 1, 1, 1, 1, 1, 1,
      2, 2, 2, 2, 2, 2, 2,
      3, 3, 3, 3, 3, 3, 3,
      999, 999, 999, // extra trailing values that shouldn't be assigned
    ]);
    const energyBuf = new Float32Array([10, 20, 30, 40, 50]); // extra values
    const haulersBuf = new Float32Array([1, 2, 3, 4]);

    const mockBridge = {
      isReady: () => true,
      step: vi.fn(),
      getGlobalResources: vi.fn().mockReturnValue(new Float64Array([0, 0, 0, 0, 0, 0, 0, 0])),
      getLogisticsQueues: vi.fn().mockReturnValue({ pendingTransfers: [] }),
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
      getFactoryResources: vi.fn().mockReturnValue(resBuf),
      getFactoryEnergy: vi.fn().mockReturnValue(energyBuf),
      getFactoryMaxEnergy: vi.fn().mockReturnValue(new Float32Array([0, 0, 0, 0, 0])),
      getFactoryHaulersAssigned: vi.fn().mockReturnValue(haulersBuf),
    } as unknown as RustSimBridge;

    mockUseRustEngine.mockReturnValue({
      bridge: mockBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    if (frameCallback) {
      for (let i = 0; i < 6; i++) act(() => frameCallback!(null, 0.016));
    }

    const factories = storeApi.getState().factories;
    expect(factories[0].resources.ore).toBe(1);
    expect(factories[1].resources.ore).toBe(2);
    expect(factories[2].resources.ore).toBe(3);
    // trailing extra should have been ignored (no crash and not applied)
    expect(factories.length).toBe(3);
  });
});
