import { StoreSnapshot } from '../state/types';

export interface BufferSection {
  offset_bytes: number;
  length: number;
}

export interface DroneBuffers {
  positions: BufferSection;
  velocities: BufferSection;
  states: BufferSection;
}

export interface AsteroidBuffers {
  positions: BufferSection;
  ore_remaining: BufferSection;
}

export interface FactoryBuffers {
  positions: BufferSection;
  orientations: BufferSection;
  activity: BufferSection;
}

export interface RustSimLayout {
  drones: DroneBuffers;
  asteroids: AsteroidBuffers;
  factories: FactoryBuffers;
  total_size_bytes: number;
}

// Interface for the wasm-bindgen generated module exports
export interface WasmSimExports {
  memory: WebAssembly.Memory;
  WasmGameState: {
    new (snapshot_json: string): WasmGameState;
  };
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

export interface RustSimBridge {
  init(snapshot: StoreSnapshot): Promise<void>;
  step(dt: number): number;
  getLayout(): RustSimLayout;
  getDronePositions(): Float32Array;
  getDroneVelocities(): Float32Array;
  getDroneStates(): Uint32Array;
  getAsteroidPositions(): Float32Array;
  getAsteroidOre(): Float32Array;
  getFactoryPositions(): Float32Array;
  getFactoryOrientations(): Float32Array;
  getFactoryActivity(): Uint32Array;
}

export function buildRustSimBridge(
  wasmExports: WasmSimExports,
  snapshot: StoreSnapshot
): RustSimBridge {
  const json = JSON.stringify(snapshot);
  let gameState: WasmGameState | null = new wasmExports.WasmGameState(json);
  let layout: RustSimLayout = JSON.parse(gameState.layout_json());

  // Helper to create views
  // Note: We recreate views on access because WASM memory buffer can detach on growth
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
    async init(newSnapshot: StoreSnapshot) {
      if (gameState) {
        gameState.free();
      }
      const json = JSON.stringify(newSnapshot);
      gameState = new wasmExports.WasmGameState(json);
      layout = JSON.parse(gameState.layout_json());
    },

    step(dt: number) {
      if (!gameState) throw new Error('Game state not initialized');
      return gameState.step(dt);
    },

    getLayout() {
      return layout;
    },

    getDronePositions() {
      return getViewF32(layout.drones.positions);
    },

    getDroneVelocities() {
      return getViewF32(layout.drones.velocities);
    },

    getDroneStates() {
      return getViewU32(layout.drones.states);
    },

    getAsteroidPositions() {
      return getViewF32(layout.asteroids.positions);
    },

    getAsteroidOre() {
      return getViewF32(layout.asteroids.ore_remaining);
    },

    getFactoryPositions() {
      return getViewF32(layout.factories.positions);
    },

    getFactoryOrientations() {
      return getViewF32(layout.factories.orientations);
    },

    getFactoryActivity() {
      return getViewU32(layout.factories.activity);
    },
  };
}
