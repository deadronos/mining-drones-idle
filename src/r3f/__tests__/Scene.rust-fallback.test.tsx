/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

// Lightweight mocks for heavy three/react-three imports and child components
vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined, useThree: () => ({ camera: {}, size: { width: 100, height: 100 } }) }));
vi.mock('@react-three/drei', () => ({ Stars: () => <div>Stars</div> }));

// Stub out many heavy child components so we can assert which one renders
vi.mock('@/r3f/Asteroids', () => ({ Asteroids: () => <div data-testid="Asteroids">ASTEROIDS_TS</div> }));
vi.mock('@/r3f/Drones', () => ({ Drones: () => <div data-testid="Drones">DRONES_TS</div> }));
vi.mock('@/r3f/RustAsteroids', () => ({ RustAsteroids: ({ bridge }: any) => <div data-testid="RustAsteroids">RUST_ASTEROIDS_{bridge ? 'READY' : 'NULL'}</div> }));
vi.mock('@/r3f/RustDrones', () => ({ RustDrones: ({ bridge }: any) => <div data-testid="RustDrones">RUST_DRONES_{bridge ? 'READY' : 'NULL'}</div> }));
vi.mock('@/r3f/Factory', () => ({ Factory: () => <div>FACTORY</div> }));
vi.mock('@/r3f/Warehouse', () => ({ Warehouse: () => <div>WAREHOUSE</div> }));
vi.mock('@/r3f/DroneTrails', () => ({ DroneTrails: () => <div>TRAILS</div> }));
vi.mock('@/r3f/HaulerShips', () => ({ HaulerShips: () => <div>HAULERS</div> }));
vi.mock('@/r3f/TransferLines', () => ({ TransferLines: () => <div>LINES</div> }));

// Replace most hooks and ECS systems with light stubs
vi.mock('@/hooks/useFactoryAutofit', () => ({ useFactoryAutofit: () => undefined }));
vi.mock('@/hooks/useCameraReset', () => ({ useCameraReset: () => undefined }));
vi.mock('@/lib/parityLogger', () => ({ checkParity: () => null }));

// Mock the Rust engine hook - controlled by test
const mockUseRustEngine = vi.fn();
vi.mock('@/hooks/useRustEngine', async () => ({ useRustEngine: (...args: any[]) => mockUseRustEngine(...args) }));

// Provide a simple useStore mock that returns a basic stable state
const baseState = {
  rngSeed: 1,
  settings: { showTrails: false, showHaulerShips: false, useRustSim: false, shadowMode: false },
  factories: [],
};
vi.mock('@/state/store', async () => ({ useStore: (selector: any) => selector(baseState), storeApi: { getState: () => baseState } }));

// Mock the various ECS system factories used in Scene (no-op runners)
vi.mock('@/ecs/systems/time', () => ({ createTimeSystem: () => ({ update: (_s: number, cb: any) => cb((() => {}) as any) }) }));
vi.mock('@/ecs/systems/fleet', () => ({ createFleetSystem: () => () => {} }));
vi.mock('@/ecs/systems/asteroids', () => ({ createAsteroidSystem: () => () => {} }));
vi.mock('@/ecs/systems/droneAI', () => ({ createDroneAISystem: () => () => {} }));
vi.mock('@/ecs/systems/travel', () => ({ createTravelSystem: () => () => {} }));
vi.mock('@/ecs/systems/mining', () => ({ createMiningSystem: () => () => {} }));
vi.mock('@/ecs/systems/unload', () => ({ createUnloadSystem: () => () => {} }));
vi.mock('@/ecs/systems/power', () => ({ createPowerSystem: () => () => {} }));
vi.mock('@/ecs/systems/refinery', () => ({ createRefinerySystem: () => () => {} }));
vi.mock('@/ecs/systems/biomes', () => ({ createBiomeSystem: () => () => {} }));

// Import the Scene after mocks are set up
import { Scene } from '@/r3f/Scene';

describe('Scene - Rust renderer fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    baseState.settings.useRustSim = false;
  });

  it('falls back to TS asteroids/drones when rust bridge is not ready', () => {
    // Simulate store enabling rust, but bridge is not loaded yet
    baseState.settings.useRustSim = true;
    mockUseRustEngine.mockReturnValue({ bridge: null, isLoaded: false, error: null, fallbackReason: null, reinitialize: async () => {} });
    // Render
    render(<Scene />);

    // Should render the TypeScript instanced components (fallback)
    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });

  it('renders Rust components when bridge is ready', () => {
    baseState.settings.useRustSim = true;
    // Bridge is present and loaded and reports buffers
    mockUseRustEngine.mockReturnValue({
      bridge: {
        isReady: () => true,
        getAsteroidPositions: () => new Float32Array([1, 2, 3, 4, 5, 6]),
        getAsteroidOre: () => new Float32Array([10, 20]),
        getDronePositions: () => new Float32Array([1, 2, 3]),
        getDroneStates: () => new Float32Array([0]),
      } as any,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => {},
    });
    render(<Scene />);

    expect(screen.getByTestId('RustAsteroids').textContent).toContain('RUST_ASTEROIDS_READY');
    expect(screen.getByTestId('RustDrones').textContent).toContain('RUST_DRONES_READY');
  });

  it('falls back if bridge is ready but buffers are empty', () => {
    baseState.settings.useRustSim = true;
    mockUseRustEngine.mockReturnValue({
      bridge: {
        isReady: () => true,
        getAsteroidPositions: () => new Float32Array([]),
        getAsteroidOre: () => new Float32Array([]),
        getDronePositions: () => new Float32Array([]),
        getDroneStates: () => new Float32Array([]),
      } as any,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => {},
    });

    render(<Scene />);
    // Should still show TS components because buffers are not populated
    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });

  it('falls back if bridge buffers are present but all zeroes', () => {
    baseState.settings.useRustSim = true;
    mockUseRustEngine.mockReturnValue({
      bridge: {
        isReady: () => true,
        // positions present but only zero-initialized
        getAsteroidPositions: () => new Float32Array([0, 0, 0, 0, 0, 0]),
        getAsteroidOre: () => new Float32Array([0, 0]),
        getDronePositions: () => new Float32Array([0, 0, 0]),
        getDroneStates: () => new Float32Array([0]),
      } as any,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => {},
    });

    render(<Scene />);
    // We should still see TS components because buffer contents are all zeros
    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });
});
