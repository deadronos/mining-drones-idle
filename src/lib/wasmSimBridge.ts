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

export interface RustSimExports {
  memory?: WebAssembly.Memory;
  get_layout?: () => RustSimLayout;
  layout_json?: () => string;
  export_snapshot?: () => string;
  load_snapshot?: (snapshotJson: string) => void;
  init_world?: (snapshotJson: string) => void;
  step?: (dt: number) => void;
  apply_command?: (commandJson: string) => void;
}

export interface RustSimViews {
  drones: {
    positions: Float32Array;
    velocities: Float32Array;
    states: Uint32Array;
  };
  asteroids: {
    positions: Float32Array;
    oreRemaining: Float32Array;
  };
  factories: {
    positions: Float32Array;
    orientations: Float32Array;
    activity: Float32Array;
  };
}

export interface RustSimBridge {
  layout: RustSimLayout;
  memory: WebAssembly.Memory;
  views: RustSimViews;
  step: (dt: number) => void;
  loadSnapshot: (snapshotJson: string) => void;
  exportSnapshot: () => string;
  applyCommand: (commandJson: string) => void;
}

const bytesPerElement = 4;

const assertSectionCapacity = (section: BufferSection, memory: WebAssembly.Memory, label: string) => {
  const end = section.offset_bytes + section.length * bytesPerElement;
  if (memory.buffer.byteLength < end) {
    throw new Error(`WASM memory too small for ${label} view`);
  }
};

const resolveLayout = (exports: RustSimExports): RustSimLayout => {
  if (typeof exports.get_layout === 'function') {
    return exports.get_layout();
  }
  if (typeof exports.layout_json === 'function') {
    const layoutJson = exports.layout_json();
    return JSON.parse(layoutJson) as RustSimLayout;
  }
  throw new Error('Rust WASM exports must provide get_layout or layout_json');
};

const requireMemory = (exports: RustSimExports): WebAssembly.Memory => {
  if (!exports.memory) {
    throw new Error('Rust WASM memory export is missing');
  }
  return exports.memory;
};

const selectLoader = (exports: RustSimExports) => {
  if (typeof exports.load_snapshot === 'function') return exports.load_snapshot;
  if (typeof exports.init_world === 'function') return exports.init_world;
  throw new Error('Rust WASM exports must provide load_snapshot or init_world');
};

const selectStep = (exports: RustSimExports) => {
  if (typeof exports.step !== 'function') {
    throw new Error('Rust WASM exports must provide step');
  }
  return exports.step;
};

const selectExporter = (exports: RustSimExports) => {
  if (typeof exports.export_snapshot !== 'function') {
    throw new Error('Rust WASM exports must provide export_snapshot');
  }
  return exports.export_snapshot;
};

const selectCommander = (exports: RustSimExports) => {
  if (typeof exports.apply_command !== 'function') {
    throw new Error('Rust WASM exports must provide apply_command');
  }
  return exports.apply_command;
};

const createViews = (layout: RustSimLayout, memory: WebAssembly.Memory): RustSimViews => {
  assertSectionCapacity(layout.drones.positions, memory, 'drone positions');
  assertSectionCapacity(layout.drones.velocities, memory, 'drone velocities');
  assertSectionCapacity(layout.drones.states, memory, 'drone states');
  assertSectionCapacity(layout.asteroids.positions, memory, 'asteroid positions');
  assertSectionCapacity(layout.asteroids.ore_remaining, memory, 'asteroid ore_remaining');
  assertSectionCapacity(layout.factories.positions, memory, 'factory positions');
  assertSectionCapacity(layout.factories.orientations, memory, 'factory orientations');
  assertSectionCapacity(layout.factories.activity, memory, 'factory activity');

  return {
    drones: {
      positions: new Float32Array(
        memory.buffer,
        layout.drones.positions.offset_bytes,
        layout.drones.positions.length,
      ),
      velocities: new Float32Array(
        memory.buffer,
        layout.drones.velocities.offset_bytes,
        layout.drones.velocities.length,
      ),
      states: new Uint32Array(memory.buffer, layout.drones.states.offset_bytes, layout.drones.states.length),
    },
    asteroids: {
      positions: new Float32Array(
        memory.buffer,
        layout.asteroids.positions.offset_bytes,
        layout.asteroids.positions.length,
      ),
      oreRemaining: new Float32Array(
        memory.buffer,
        layout.asteroids.ore_remaining.offset_bytes,
        layout.asteroids.ore_remaining.length,
      ),
    },
    factories: {
      positions: new Float32Array(
        memory.buffer,
        layout.factories.positions.offset_bytes,
        layout.factories.positions.length,
      ),
      orientations: new Float32Array(
        memory.buffer,
        layout.factories.orientations.offset_bytes,
        layout.factories.orientations.length,
      ),
      activity: new Float32Array(
        memory.buffer,
        layout.factories.activity.offset_bytes,
        layout.factories.activity.length,
      ),
    },
  };
};

export const buildRustSimBridge = (exports: RustSimExports): RustSimBridge => {
  const layout = resolveLayout(exports);
  const memory = requireMemory(exports);
  const views = createViews(layout, memory);
  const loadSnapshot = selectLoader(exports);
  const step = selectStep(exports);
  const exportSnapshot = selectExporter(exports);
  const applyCommand = selectCommander(exports);

  return {
    layout,
    memory,
    views,
    step: (dt: number) => step(dt),
    loadSnapshot: (snapshotJson: string) => loadSnapshot(snapshotJson),
    exportSnapshot: () => exportSnapshot(),
    applyCommand: (commandJson: string) => applyCommand(commandJson),
  };
};
