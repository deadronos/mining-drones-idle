import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

const noop = () => undefined;

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
  useThree: () => ({ camera: {}, size: { width: 100, height: 100 } }),
}));
vi.mock('@react-three/drei', () => ({ Stars: () => <div>Stars</div> }));

vi.mock('@/r3f/Asteroids', () => ({ Asteroids: () => <div data-testid="Asteroids">ASTEROIDS_TS</div> }));
vi.mock('@/r3f/Drones', () => ({ Drones: () => <div data-testid="Drones">DRONES_TS</div> }));
vi.mock('@/r3f/RustAsteroids', () => ({
  RustAsteroids: ({ bridge }: { bridge: unknown }) => (
    <div data-testid="RustAsteroids">RUST_ASTEROIDS_{bridge ? 'READY' : 'NULL'}</div>
  ),
}));
vi.mock('@/r3f/RustDrones', () => ({
  RustDrones: ({ bridge }: { bridge: unknown }) => (
    <div data-testid="RustDrones">RUST_DRONES_{bridge ? 'READY' : 'NULL'}</div>
  ),
}));
vi.mock('@/r3f/Factory', () => ({ Factory: () => <div>FACTORY</div> }));
vi.mock('@/r3f/Warehouse', () => ({ Warehouse: () => <div>WAREHOUSE</div> }));
vi.mock('@/r3f/DroneTrails', () => ({ DroneTrails: () => <div>TRAILS</div> }));
vi.mock('@/r3f/HaulerShips', () => ({ HaulerShips: () => <div>HAULERS</div> }));
vi.mock('@/r3f/TransferLines', () => ({ TransferLines: () => <div>LINES</div> }));

vi.mock('@/hooks/useFactoryAutofit', () => ({ useFactoryAutofit: () => undefined }));
vi.mock('@/hooks/useCameraReset', () => ({ useCameraReset: () => undefined }));
vi.mock('@/lib/parityLogger', () => ({ checkParity: () => null }));

const mockUseRustEngine = vi.fn();
vi.mock('@/hooks/useRustEngine', async () => ({ useRustEngine: (...args: unknown[]) => mockUseRustEngine(...args) }));

const baseState = {
  rngSeed: 1,
  settings: { showTrails: false, showHaulerShips: false, useRustSim: false, shadowMode: false },
  factories: [],
};
vi.mock('@/state/store', async () => ({
  useStore: (selector: (state: typeof baseState) => unknown) => selector(baseState),
  storeApi: { getState: () => baseState },
}));

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

import { Scene } from '@/r3f/Scene';

describe('Scene - Rust renderer fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    baseState.settings.useRustSim = false;
  });

  it('falls back to TS asteroids/drones when rust bridge is not ready', () => {
    baseState.settings.useRustSim = true;
    mockUseRustEngine.mockReturnValue({ bridge: null, isLoaded: false, error: null, fallbackReason: null, reinitialize: async () => undefined });
    render(<Scene />);

    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });

  it('renders Rust components when bridge is ready', () => {
    baseState.settings.useRustSim = true;
    const readyBridge: Pick<RustSimBridge, 'isReady' | 'getAsteroidPositions' | 'getAsteroidOre' | 'getDronePositions' | 'getDroneStates'> = {
      isReady: () => true,
      getAsteroidPositions: () => new Float32Array([1, 2, 3, 4, 5, 6]),
      getAsteroidOre: () => new Float32Array([10, 20]),
      getDronePositions: () => new Float32Array([1, 2, 3]),
      getDroneStates: () => new Float32Array([0]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: readyBridge as RustSimBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });
    render(<Scene />);

    expect(screen.getByTestId('RustAsteroids').textContent).toContain('RUST_ASTEROIDS_READY');
    expect(screen.getByTestId('RustDrones').textContent).toContain('RUST_DRONES_READY');
  });

  it('falls back if bridge is ready but buffers are empty', () => {
    baseState.settings.useRustSim = true;
    const emptyBridge: Pick<RustSimBridge, 'isReady' | 'getAsteroidPositions' | 'getAsteroidOre' | 'getDronePositions' | 'getDroneStates'> = {
      isReady: () => true,
      getAsteroidPositions: () => new Float32Array([]),
      getAsteroidOre: () => new Float32Array([]),
      getDronePositions: () => new Float32Array([]),
      getDroneStates: () => new Float32Array([]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: emptyBridge as RustSimBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });

  it('falls back if bridge buffers are present but all zeroes', () => {
    baseState.settings.useRustSim = true;
    const zeroBridge: Pick<RustSimBridge, 'isReady' | 'getAsteroidPositions' | 'getAsteroidOre' | 'getDronePositions' | 'getDroneStates'> = {
      isReady: () => true,
      getAsteroidPositions: () => new Float32Array([0, 0, 0, 0, 0, 0]),
      getAsteroidOre: () => new Float32Array([0, 0]),
      getDronePositions: () => new Float32Array([0, 0, 0]),
      getDroneStates: () => new Float32Array([0]),
    };

    mockUseRustEngine.mockReturnValue({
      bridge: zeroBridge as RustSimBridge,
      isLoaded: true,
      error: null,
      fallbackReason: null,
      reinitialize: async () => undefined,
    });

    render(<Scene />);
    expect(screen.getByTestId('Asteroids')).toBeDefined();
    expect(screen.getByTestId('Drones')).toBeDefined();
  });
});
