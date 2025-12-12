import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { storeApi } from '@/state/store';

// Capture useFrame callback
let frameCallback: ((state: any, delta: number) => void) | null = null;

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: any) => {
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
});
