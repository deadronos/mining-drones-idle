# Mining Drones Idle - Architecture Overview

This document describes the high-level structure and architecture of Mining Drones Idle, an idle/automation game built with React, Three.js, and an ECS-driven simulation loop.

## Table of Contents

- [Core Architecture](#core-architecture)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Key Subsystems](#key-subsystems)
- [Directory Structure](#directory-structure)

## Core Architecture

Mining Drones Idle uses a layered architecture that separates concerns between simulation logic, state management, 3D rendering, and UI:

```
┌─────────────────────────────────────────────────────┐
│                   UI Layer (React)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │UpgradePanel  │  │LogisticsPanel│  │ Settings │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│          State Management (Zustand Store)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Resources │  │Factories │  │ Logistics/Haulers│  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│        3D Rendering (React Three Fiber)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Factory  │  │ Drones   │  │   Asteroids      │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────┐
│         Simulation (ECS - Miniplex)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ DroneAI  │  │  Mining  │  │    Logistics     │  │
│  │ Travel   │  │ Refinery │  │    Power         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies

- **React 19.2**: UI framework for components and state management
- **React Three Fiber (r3f)**: React renderer for Three.js, handles 3D scene
- **Three.js**: 3D graphics library
- **Zustand**: Lightweight state management
- **Miniplex**: Entity Component System (ECS) for simulation logic
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server

### Supporting Libraries

- **@react-three/drei**: Helper components for r3f (Stars, Html overlays)
- **@radix-ui/themes**: UI component library
- **Tailwind CSS**: Utility-first styling
- **Immer**: Immutable state updates

### Development Tools

- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing
- **ESLint + Prettier**: Code quality and formatting

## System Architecture

### 1. Application Entry Point

The application bootstraps in `main.tsx`:

1. Creates `PersistenceManager` for save/load functionality
2. Loads saved game state from localStorage
3. Starts autosave timer
4. Renders the React app with persistence context
5. Sets up visibility change handlers for saving on tab switch

### 2. State Management (Zustand Store)

Located in `src/state/`, the Zustand store is the single source of truth for game state.

#### Store Structure

```typescript
{
  // Global resources (warehouse)
  resources: {
    ore: number,
    bars: number,
    energy: number,
    credits: number
  },
  
  // Factory instances
  factories: FactorySnapshot[],
  
  // Logistics and hauler state
  logistics: {
    pending: PendingTransfer[],
    scheduled: PendingTransfer[],
    completed: PendingTransfer[]
  },
  
  // Prestige and progression
  prestige: {
    cores: number,
    investmentLevels: Record<string, number>,
    specializationTechs: Record<string, number>
  },
  
  // User settings
  settings: {
    autosaveEnabled: boolean,
    autosaveIntervalSec: number,
    offlineProgressCapSec: number,
    notationMode: string,
    throttleFloor: number,
    showTrails: boolean,
    showHaulerShips: boolean
  },
  
  // Save metadata
  save: {
    lastSave: number,
    version: string
  },
  
  // RNG seed for deterministic world generation
  rngSeed: number
}
```

#### Store Slices

The store is organized into slices for modularity:

- **resourceSlice**: Manages global warehouse resources
- **factorySlice**: Manages factory CRUD operations and upgrades
- **droneSlice**: Manages drone assignments and capacities
- **logisticsSlice**: Manages hauler scheduling and transfers
- **settingsSlice**: User preferences and configuration

### 3. ECS Simulation Layer (Miniplex)

Located in `src/ecs/`, the ECS handles real-time simulation of entities.

#### Entity Types

**Asteroid Entity**
```typescript
{
  id: string,
  position: Vector3,
  oreRemaining: number,
  richness: number,
  radius: number,
  biome: AsteroidBiomeState,
  resourceProfile: ResourceWeights,
  dominantResource: ResourceKey
}
```

**Drone Entity**
```typescript
{
  id: string,
  position: Vector3,
  state: 'idle' | 'toAsteroid' | 'mining' | 'returning' | 'unloading',
  targetId: string | null,
  cargo: number,
  capacity: number,
  speed: number,
  battery: number,
  ownerFactoryId: string
}
```

**Factory Entity**
```typescript
{
  id: string,
  position: Vector3,
  resources: { ore, bars, energy },
  upgrades: { dockingBay, refinery, storage, etc. }
}
```

#### ECS Systems

Systems run every frame in a fixed timestep accumulator (default 0.1s):

1. **TimeSystem** (`time.ts`): Manages fixed timestep accumulation
2. **FleetSystem** (`fleet.ts`): Spawns and manages drone entities
3. **AsteroidSystem** (`asteroids.ts`): Generates and refreshes asteroid field
4. **DroneAISystem** (`droneAI.ts`): Drone state machine (idle → navigate → mine → return → unload)
5. **TravelSystem** (`travel.ts`): Moves drones along curved paths
6. **MiningSystem** (`mining.ts`): Extracts ore from asteroids, manages battery drain
7. **UnloadSystem** (`unload.ts`): Transfers cargo to factory storage
8. **PowerSystem** (`power.ts`): Charges drone batteries, manages energy consumption
9. **RefinerySystem** (`refinery.ts`): Processes ore into bars
10. **BiomeSystem** (`biomes.ts`): Manages asteroid biome and resource distribution

#### System Execution Flow

```
useFrame (60fps)
    ↓
TimeSystem.tick(deltaTime)
    ↓
Accumulator += deltaTime
    ↓
while (Accumulator >= fixedDt) {
    BiomeSystem.tick(fixedDt)
    FleetSystem.tick(fixedDt)
    AsteroidSystem.tick(fixedDt)
    DroneAISystem.tick(fixedDt)
    TravelSystem.tick(fixedDt)
    MiningSystem.tick(fixedDt)
    UnloadSystem.tick(fixedDt)
    PowerSystem.tick(fixedDt)
    RefinerySystem.tick(fixedDt)
    Accumulator -= fixedDt
}
```

### 4. 3D Rendering Layer (React Three Fiber)

Located in `src/r3f/`, handles all 3D visualization.

#### Scene Components

- **Scene.tsx**: Root component, sets up lighting, fog, and systems
- **Factory.tsx**: Renders factory mesh with visual effects
- **Drones.tsx**: Instanced rendering of all drones
- **Asteroids.tsx**: Instanced rendering of asteroid field
- **DroneTrails.tsx**: Optional particle trails for drones
- **HaulerShips.tsx**: Visualizes hauler logistics transfers
- **Warehouse.tsx**: Renders global warehouse structure
- **TransferLines.tsx**: Shows active resource transfers

#### Rendering Optimizations

- Instanced meshes for drones and asteroids (hundreds of objects)
- Conditional rendering based on settings (trails, hauler ships)
- Auto-LOD system for distant objects
- Fog to hide far objects and improve performance

### 5. UI Layer (React Components)

Located in `src/ui/`, provides overlays and panels.

#### Main UI Components

- **UpgradePanel**: Factory module purchases (docking bay, refinery, storage, etc.)
- **LogisticsPanel**: Hauler management and transfer visualization
- **FactoryManager**: Factory creation, deletion, and overview
- **WarehousePanel**: Global resource display and warehouse upgrades
- **Settings**: Game configuration, import/export, reset
- **DebugPanel**: Development tools and metrics
- **AsteroidInspector**: Hover inspection of asteroids

#### UI Architecture

- Components use Zustand selectors for reactive updates
- Minimal re-renders via precise selector usage
- Radix UI for accessible dialogs and controls
- Tailwind CSS for styling

## Data Flow

### Game Loop Data Flow

```
Scene.useFrame (RAF callback)
    ↓
ECS Systems Update
    ↓
Entity state changes (positions, cargo, battery)
    ↓
r3f Components read entity state
    ↓
Three.js renders frame
```

### UI Data Flow

```
User Action (button click)
    ↓
Zustand Store Action (e.g., buyUpgrade)
    ↓
Store State Updated
    ↓
UI Components React to Selector Changes
    ↓
Re-render Updated Components
```

### Store → ECS Synchronization

The store and ECS are bidirectional:

1. **Store → ECS**: Factory upgrades affect drone spawning (FleetSystem)
2. **ECS → Store**: Unloaded cargo updates factory resources in store
3. **Store Processing**: Refinery and logistics run in store tick functions

```
Store.tick() (2s interval)
    ↓
processRefinery() - Process ore → bars in factories
    ↓
processLogistics() - Schedule hauler transfers
    ↓
Store state updated
    ↓
UI reflects new resource counts
```

## Key Subsystems

### 1. Persistence System

Located in `src/state/persistence.ts`, handles save/load/import/export.

#### Features

- **Autosave**: Configurable interval (default 5s)
- **Offline Progress**: Simulates up to configured max time (default 8 hours)
- **Import/Export**: JSON-based manual backups
- **Migrations**: Handles version upgrades for backwards compatibility

#### Save Format

Saves are stored in localStorage under `space-factory-save` key:

```json
{
  "resources": { "ore": 1000, "bars": 500, ... },
  "factories": [...],
  "prestige": { "cores": 0, ... },
  "settings": { "autosaveEnabled": true, ... },
  "save": {
    "lastSave": 1698765432000,
    "version": "1.2.0"
  },
  "rngSeed": 123456789
}
```

#### Migration System

Located in `src/state/migrations.ts`, handles schema evolution:

```typescript
// Adds missing fields with safe defaults
export function migrateSnapshot(snapshot: any): StoreSnapshot {
  // Add missing settings fields
  if (!snapshot.settings.showTrails) {
    snapshot.settings.showTrails = true;
  }
  
  // Update version
  snapshot.save.version = SAVE_VERSION;
  
  return snapshot;
}
```

### 2. Factory System

Factories are the core production units. Each factory has:

#### Upgrades

- **Docking Bay**: Drone capacity and speed
- **Refinery**: Bar production rate
- **Storage**: Local resource capacity
- **Energy**: Energy capacity
- **Solar Array**: Energy regeneration rate
- **Scanner**: Asteroid detection range

#### Resources

Each factory maintains local buffers:
- Ore (mined by drones)
- Bars (refined from ore)
- Energy (powers drones)

#### Progression

Upgrades use exponential cost scaling: `baseCost * (1.15 ^ level)`

### 3. Logistics System

Located in `src/ecs/logistics/`, manages resource distribution.

#### Hauler Scheduling

Every 2 seconds, the logistics matcher:

1. Identifies factories with surplus resources (above buffer target)
2. Identifies factories with resource deficits (below buffer target)
3. Creates pending transfers respecting minimum reserves
4. Assigns haulers to execute transfers
5. Tracks transfer progress and completion

#### Buffer Targets

Each resource type has consumption-based targets:

- **Ore**: Based on refinery slot count × average consumption rate
- **Bars**: Exported to warehouse when surplus exists
- **Energy**: Based on drone count × average drain rate

#### Transfer States

- **Pending**: Waiting for hauler assignment
- **Scheduled**: Hauler assigned, in transit
- **Completed**: Transfer finished, resources delivered

### 4. Energy and Throttling System

Located in `src/ecs/energy.ts` and `src/ecs/systems/power.ts`.

#### Battery System

Each drone has:
- `battery`: Current energy level (0-100)
- `maxBattery`: Maximum capacity
- `charging`: Whether currently docked

#### Energy Consumption

Drones consume energy during:
- **Travel**: Scales with distance and speed
- **Mining**: Scales with mining rate

#### Throttling

When battery is low, drone performance scales down:
```typescript
const throttle = Math.max(
  battery / maxBattery,
  settings.throttleFloor
);

effectiveSpeed = baseSpeed * throttle;
effectiveMiningRate = baseMiningRate * throttle;
```

The throttle floor (default 0.2) prevents complete shutdown.

### 5. World Generation System

Located in `src/ecs/world.ts` and `src/ecs/biomes.ts`.

#### Deterministic RNG

Uses Mulberry32 algorithm seeded with `store.rngSeed`:

```typescript
const rng = createRng(store.getState().rngSeed);
const value = rng(); // Returns deterministic value
```

#### Asteroid Generation

1. Generate positions on rings around factories
2. Assign biomes (ice, rock, metal, volcanic)
3. Calculate resource profiles based on biome
4. Set richness and ore capacity
5. Create visual variance (rotation, color bias)

#### Biome System

Asteroids have resource profiles:
- **Ice**: High water, low metal
- **Rock**: Balanced resources
- **Metal**: High metal, low water
- **Volcanic**: High energy materials

## Directory Structure

```
src/
├── App.tsx                 # Root app component
├── main.tsx                # Application entry point
├── config/                 # Configuration constants
├── ecs/                    # Entity Component System
│   ├── world.ts            # ECS world setup
│   ├── biomes.ts           # Biome generation
│   ├── factories/          # Factory entity logic
│   ├── logistics/          # Hauler scheduling
│   └── systems/            # ECS systems (drone AI, travel, mining, etc.)
├── state/                  # Zustand store
│   ├── store.ts            # Main store definition
│   ├── persistence.ts      # Save/load system
│   ├── migrations.ts       # Save format migrations
│   ├── slices/             # Store slices (resources, factories, logistics)
│   ├── processing/         # Game loop processing (refinery, logistics)
│   └── metrics/            # Performance tracking
├── r3f/                    # React Three Fiber components
│   ├── Scene.tsx           # Main 3D scene
│   ├── Factory.tsx         # Factory rendering
│   ├── Drones.tsx          # Drone rendering
│   ├── Asteroids.tsx       # Asteroid field rendering
│   ├── DroneTrails.tsx     # Particle trails
│   ├── HaulerShips.tsx     # Hauler visualization
│   └── Warehouse.tsx       # Warehouse rendering
├── ui/                     # React UI components
│   ├── UpgradePanel.tsx    # Factory upgrades
│   ├── LogisticsPanel.tsx  # Hauler management
│   ├── FactoryManager/     # Factory CRUD
│   ├── WarehousePanel.tsx  # Global resources
│   ├── Settings.tsx        # Game settings
│   └── DebugPanel.tsx      # Debug tools
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
│   ├── math.ts             # Math helpers
│   ├── rng.ts              # Random number generation
│   ├── camera.ts           # Camera utilities
│   └── offline.ts          # Offline progress simulation
└── styles.css              # Global styles

tests/                      # Test files
├── unit/                   # Unit tests
└── e2e/                    # Playwright e2e tests

docs/                       # Documentation
├── ARCHITECTURE.md         # This file
├── best-practices.md       # Development guidelines
└── RESOURCE_DISTRIBUTION_ANALYSIS.md
```

## Testing Strategy

### Unit Tests (Vitest)

- Store slice logic (`store.test.ts`, `store.factories.test.ts`)
- ECS systems (`droneAI.test.ts`, `mining.test.ts`, `power.test.ts`)
- Persistence (`persistence.test.ts`, `migrations.test.ts`)
- UI components (`Settings.test.tsx`, `WarehousePanel.test.tsx`)

### Integration Tests

- Store ↔ ECS synchronization
- Logistics scheduling and execution
- Offline progress simulation

### E2E Tests (Playwright)

- Complete game flows (mining, upgrading, prestige)
- Save/load/import/export functionality
- UI interactions and state updates

## Performance Considerations

### Optimization Techniques

1. **Instanced Rendering**: Drones and asteroids use instancing for hundreds of objects
2. **Fixed Timestep**: Deterministic simulation independent of frame rate
3. **Selective Subscriptions**: Zustand selectors prevent unnecessary re-renders
4. **Memoization**: Expensive calculations cached with `useMemo`
5. **Conditional Features**: Trails and hauler ships can be disabled
6. **Fog Culling**: Objects beyond fog distance are not rendered

### Performance Monitoring

The metrics system tracks:
- Drone throughput (ore/sec)
- Refinery efficiency (bars/sec)
- Hauler utilization (transfers/sec)
- Frame rate and render time

## Development Workflow

### Running the Game

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
```

### Testing

```bash
npm run test         # Run unit tests
npm run typecheck    # TypeScript checking
npm run lint         # Code linting
npm run e2e          # E2E tests (after build)
```

### Building

```bash
npm run build        # Production build
npm run preview      # Preview build locally
```

## Future Architecture Considerations

### Planned Extensions

- Multi-factory networks with specialization
- Advanced automation scripts
- Prestige system expansion
- Additional resource types and chains
- Multiplayer/leaderboard integration

### Scalability

The current architecture supports:
- Up to 10 factories without performance issues
- Hundreds of drones and asteroids via instancing
- Complex logistics networks with multiple haulers
- Long-running games with offline progress

### Extensibility

The modular architecture allows easy addition of:
- New ECS systems for game mechanics
- New factory upgrade types
- New UI panels and visualizations
- New biomes and resource types
- Save format migrations for backwards compatibility
