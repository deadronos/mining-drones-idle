import type { StoreSnapshot } from '../state/types';

export interface BufferSection {
  offset_bytes: number;
  length: number;
}

export interface DroneBuffers {
  positions: BufferSection;
  velocities: BufferSection;
  states: BufferSection;
  cargo: BufferSection;
  battery: BufferSection;
  max_battery: BufferSection;
  capacity: BufferSection;
  mining_rate: BufferSection;
  cargo_profile: BufferSection;
  target_factory_index: BufferSection;
  owner_factory_index: BufferSection;
  target_asteroid_index: BufferSection;
  target_region_index: BufferSection;
  charging: BufferSection;
}

export interface AsteroidBuffers {
  positions: BufferSection;
  ore_remaining: BufferSection;
  max_ore: BufferSection;
  resource_profile: BufferSection;
}

export interface FactoryBuffers {
  positions: BufferSection;
  orientations: BufferSection;
  activity: BufferSection;
  resources: BufferSection;
  energy: BufferSection;
  max_energy: BufferSection;
  upgrades: BufferSection;
  refinery_state: BufferSection;
  haulers_assigned: BufferSection;
}

export interface GlobalBuffers {
  resources: BufferSection;
}

export interface RustSimLayout {
  drones: DroneBuffers;
  asteroids: AsteroidBuffers;
  factories: FactoryBuffers;
  globals: GlobalBuffers;
  total_size_bytes: number;
}

export interface TickResult {
  dt: number;
  gameTime: number;
  rngSample: number;
}

export interface OfflineResult {
  elapsed: number;
  steps: number;
  snapshotJson: string;
}

export type SimulationCommand =
  | { type: 'UpdateResources'; payload: StoreSnapshot['resources'] }
  | { type: 'UpdateModules'; payload: StoreSnapshot['modules'] }
  | { type: 'SetSettings'; payload: Partial<StoreSnapshot['settings']> }
  | { type: 'BuyModule'; payload: { moduleType: string; factoryId?: string } }
  | { type: 'DoPrestige'; payload?: undefined }
  | {
      type: 'PurchaseFactoryUpgrade';
      payload: { factoryId: string; upgradeType: string; costVariant?: string };
    }
  | { type: 'AssignHauler'; payload: { factoryId: string; count: number } }
  | { type: 'ImportPayload'; payload: { snapshotJson: string } }
  | { type: 'SpawnDrone'; payload: { factoryId: string } }
  | { type: 'RecycleAsteroid'; payload: { asteroidId: string } };

// Interface for the wasm-bindgen generated module exports
export interface WasmSimExports {
  memory: WebAssembly.Memory;
  WasmGameState: new (snapshot_json: string) => WasmGameState;
}

export interface WasmGameState {
  free(): void;
  load_snapshot(snapshot_json: string): void;
  export_snapshot(): string;
  step(dt: number): number;
  apply_command(command_json: string): void;
  layout_json(): string;
  data_ptr(): number;
}

/**
 * TypeScript bridge to the Rust WASM simulation.
 * Provides typed access to simulation buffers and lifecycle management.
 */
export interface RustSimBridge {
  // Lifecycle
  init(snapshot: StoreSnapshot): Promise<void>;
  dispose(): void;
  isReady(): boolean;

  // Simulation
  step(dt: number): TickResult;
  applyCommand(cmd: SimulationCommand): void;
  simulateOffline(seconds: number, stepSize: number): OfflineResult;

  // Snapshots
  exportSnapshot(): StoreSnapshot;
  loadSnapshot(snapshot: StoreSnapshot): void;

  // Layout
  getLayout(): RustSimLayout;

  // Drone buffer accessors
  getDronePositions(): Float32Array;
  getDroneVelocities(): Float32Array;
  getDroneStates(): Float32Array;
  getDroneCargo(): Float32Array;
  getDroneBattery(): Float32Array;
  getDroneMaxBattery(): Float32Array;
  getDroneCapacity(): Float32Array;
  getDroneMiningRate(): Float32Array;
  getDroneCargoProfile(): Float32Array;
  getDroneTargetFactoryIndex(): Float32Array;
  getDroneOwnerFactoryIndex(): Float32Array;
  getDroneTargetAsteroidIndex(): Float32Array;
  getDroneTargetRegionIndex(): Float32Array;
  getDroneCharging(): Float32Array;

  // Asteroid buffer accessors
  getAsteroidPositions(): Float32Array;
  getAsteroidOre(): Float32Array;
  getAsteroidMaxOre(): Float32Array;
  getAsteroidResourceProfile(): Float32Array;

  // Global buffer accessors
  getGlobalResources(): Float32Array;

  // Factory buffer accessors
  getFactoryPositions(): Float32Array;
  getFactoryOrientations(): Float32Array;
  getFactoryActivity(): Uint32Array;
  getFactoryResources(index?: number): Float32Array;
  getFactoryEnergy(index?: number): Float32Array;
  getFactoryMaxEnergy(): Float32Array;
  getFactoryUpgrades(): Float32Array;
  getFactoryRefineryState(): Float32Array;
  getFactoryHaulersAssigned(index?: number): Float32Array;
}

export function buildRustSimBridge(
  wasmExports: WasmSimExports,
  snapshot: StoreSnapshot
): RustSimBridge {
  const json = JSON.stringify(snapshot);
  let gameState: WasmGameState | null = new wasmExports.WasmGameState(json);
  let layout: RustSimLayout = JSON.parse(gameState.layout_json()) as RustSimLayout;
  let gameTime = snapshot.gameTime ?? 0;

  const getViewF32 = (section: BufferSection) => {
    if (!gameState) throw new Error('Game state not initialized');
    const ptr = gameState.data_ptr();
    return new Float32Array(
      wasmExports.memory.buffer,
      ptr + section.offset_bytes,
      section.length
    );
  };

  const getViewU32 = (section: BufferSection) => {
    if (!gameState) throw new Error('Game state not initialized');
    const ptr = gameState.data_ptr();
    return new Uint32Array(
      wasmExports.memory.buffer,
      ptr + section.offset_bytes,
      section.length
    );
  };

  return {
    // Lifecycle
    async init(newSnapshot: StoreSnapshot) {
      if (gameState) {
        gameState.free();
      }
      const snapshotJson = JSON.stringify(newSnapshot);
      gameState = new wasmExports.WasmGameState(snapshotJson);
      layout = JSON.parse(gameState.layout_json()) as RustSimLayout;
      gameTime = newSnapshot.gameTime ?? 0;
    },

    dispose() {
      if (gameState) {
        gameState.free();
        gameState = null;
      }
    },

    isReady(): boolean {
      return gameState !== null;
    },

    // Simulation
    step(dt: number): TickResult {
      if (!gameState) throw new Error('Game state not initialized');
      const returnedGameTime = gameState.step(dt);
      gameTime = returnedGameTime;
      return { dt, gameTime, rngSample: returnedGameTime };
    },

    applyCommand(cmd: SimulationCommand): void {
      if (!gameState) throw new Error('Game state not initialized');
      const commandJson = JSON.stringify(cmd);
      gameState.apply_command(commandJson);
    },

    simulateOffline(seconds: number, stepSize: number): OfflineResult {
      if (!gameState) throw new Error('Game state not initialized');
      if (seconds <= 0 || stepSize <= 0) {
        return { elapsed: 0, steps: 0, snapshotJson: gameState.export_snapshot() };
      }
      const iterations = Math.ceil(seconds / stepSize);
      for (let i = 0; i < iterations; i++) {
        gameState.step(stepSize);
      }
      gameTime += iterations * stepSize;
      return {
        elapsed: iterations * stepSize,
        steps: iterations,
        snapshotJson: gameState.export_snapshot(),
      };
    },

    // Snapshots
    exportSnapshot(): StoreSnapshot {
      if (!gameState) throw new Error('Game state not initialized');
      const snapshotJson = gameState.export_snapshot();
      return JSON.parse(snapshotJson) as StoreSnapshot;
    },

    loadSnapshot(newSnapshot: StoreSnapshot): void {
      if (!gameState) throw new Error('Game state not initialized');
      const snapshotJson = JSON.stringify(newSnapshot);
      gameState.load_snapshot(snapshotJson);
      layout = JSON.parse(gameState.layout_json()) as RustSimLayout;
      gameTime = newSnapshot.gameTime ?? 0;
    },

    // Layout
    getLayout() {
      return layout;
    },

    // Drone buffer accessors
    getDronePositions() {
      return getViewF32(layout.drones.positions);
    },

    getDroneVelocities() {
      return getViewF32(layout.drones.velocities);
    },

    getDroneStates() {
      return getViewF32(layout.drones.states);
    },

    getDroneCargo() {
      return getViewF32(layout.drones.cargo);
    },

    getDroneBattery() {
      return getViewF32(layout.drones.battery);
    },

    getDroneMaxBattery() {
      return getViewF32(layout.drones.max_battery);
    },

    getDroneCapacity() {
      return getViewF32(layout.drones.capacity);
    },

    getDroneMiningRate() {
      return getViewF32(layout.drones.mining_rate);
    },

    getDroneCargoProfile() {
      return getViewF32(layout.drones.cargo_profile);
    },

    getDroneTargetFactoryIndex() {
      return getViewF32(layout.drones.target_factory_index);
    },

    getDroneOwnerFactoryIndex() {
      return getViewF32(layout.drones.owner_factory_index);
    },

    getDroneTargetAsteroidIndex() {
      return getViewF32(layout.drones.target_asteroid_index);
    },

    getDroneTargetRegionIndex() {
      return getViewF32(layout.drones.target_region_index);
    },

    getDroneCharging() {
      return getViewF32(layout.drones.charging);
    },

    // Asteroid buffer accessors
    getAsteroidPositions() {
      return getViewF32(layout.asteroids.positions);
    },

    getAsteroidOre() {
      return getViewF32(layout.asteroids.ore_remaining);
    },

    getAsteroidMaxOre() {
      return getViewF32(layout.asteroids.max_ore);
    },

    getAsteroidResourceProfile() {
      return getViewF32(layout.asteroids.resource_profile);
    },

    // Global buffer accessors
    getGlobalResources() {
      return getViewF32(layout.globals.resources);
    },

    // Factory buffer accessors
    getFactoryPositions() {
      return getViewF32(layout.factories.positions);
    },

    getFactoryOrientations() {
      return getViewF32(layout.factories.orientations);
    },

    getFactoryActivity() {
      return getViewU32(layout.factories.activity);
    },

    getFactoryResources(index?: number) {
      const view = getViewF32(layout.factories.resources);
      if (index !== undefined) {
        return view.subarray(index * 7, (index + 1) * 7);
      }
      return view;
    },

    getFactoryEnergy(index?: number) {
      const view = getViewF32(layout.factories.energy);
      if (index !== undefined) {
        return view.subarray(index, index + 1);
      }
      return view;
    },

    getFactoryMaxEnergy() {
      return getViewF32(layout.factories.max_energy);
    },

    getFactoryUpgrades() {
      return getViewF32(layout.factories.upgrades);
    },

    getFactoryRefineryState() {
      return getViewF32(layout.factories.refinery_state);
    },

    getFactoryHaulersAssigned(index?: number) {
      const view = getViewF32(layout.factories.haulers_assigned);
      if (index !== undefined) {
        return view.subarray(index, index + 1);
      }
      return view;
    },
  };
}
