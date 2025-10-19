# TASK024 - Refactor serialization.ts into Domain-Focused Modules

**Status:** Pending  
**Added:** 2025-10-19  
**Updated:** 2025-10-19

## Original Request

Reorganize `src/state/serialization.ts` (603 lines) into domain-focused modules to improve clarity, reduce cognitive load, and enable better testing of individual serialization concerns.

## Thought Process

The serialization file mixes multiple abstraction levels and concerns:

1. **Low-level utilities** – Vector tuple operations, type guards
2. **Domain-specific logic** – Drone flights, refine processes, factory snapshots
3. **Complex normalization** – Factory snapshot normalization (120 lines) with nested logic
4. **Game logic leakage** – `mergeResourceDelta` includes prestige and capacity logic
5. **Inconsistent patterns** – `normalize*`, `clone*`, and `to*` functions without semantic grouping

By reorganizing into domain-focused modules, we can:

- Reduce file size from 603 to ~250–300 lines across 6 focused files
- Extract game logic (prestige, capacity) into separate `lib/resourceMerging.ts`
- Make each domain file ~50–100 lines, focused on one entity
- Enable parallel testing of factory serialization, drone serialization, etc.
- Establish clear naming conventions (`FactorySnapshot.normalize()`, `Drone.clone()`)
- Simplify imports and reduce circular dependency risk

## Implementation Plan

### Subtasks

| ID   | Description                                          | Status      | Updated | Notes                                      |
| ---- | ---------------------------------------------------- | ----------- | ------- | ------------------------------------------ |
| 3.1  | Create serialization directory structure             | Not Started | -       | `src/state/serialization/`                 |
| 3.2  | Extract `vectors.ts` (tuples, cloning)               | Not Started | -       | Vector normalization, cloning              |
| 3.3  | Extract `drones.ts` (flights, normalization)         | Not Started | -       | DroneFlightState, travel snapshots         |
| 3.4  | Extract `factory.ts` (factory snapshots)             | Not Started | -       | Complex factory normalization (~120 lines) |
| 3.5  | Extract `resources.ts` (resource logic)              | Not Started | -       | Resource normalization, merging            |
| 3.6  | Extract `store.ts` (top-level serialization)         | Not Started | -       | Store snapshot, serialize/parse            |
| 3.7  | Extract `types.ts` (type guards, coercion)           | Not Started | -       | Shared validation helpers                  |
| 3.8  | Move `mergeResourceDelta` → `lib/resourceMerging.ts` | Not Started | -       | Prestige + capacity logic isolated         |
| 3.9  | Update imports across codebase                       | Not Started | -       | store.ts, UI components, tests             |
| 3.10 | Create `src/state/serialization/index.ts`            | Not Started | -       | Re-export all public functions             |
| 3.11 | Add unit tests for each domain module                | Not Started | -       | ~40–50 lines per test file                 |
| 3.12 | Verify round-trip save/load still works              | Not Started | -       | Integration test for serialization         |
| 3.13 | Profile bundle size; confirm no regression           | Not Started | -       | Tree-shaking, build optimization           |

## Progress Tracking

**Overall Status:** Not Started – 0%

### Subtasks Progress

All subtasks pending completion.

## Progress Log

### 2025-10-19

- Initial task creation from refactor plan REFACTOR-PLAN-three-largest-files.md
- Defined 13 subtasks with clear dependencies
- Estimated effort: 2 days
- Next: Await review or proceed with Phase 3 implementation

---

## Architecture Notes

### Domain Module Structure

Each module will focus on a single entity or concern:

```typescript
// src/state/serialization/vectors.ts
import type { VectorTuple } from '../types';

export const normalizeVectorTuple = (value: unknown): VectorTuple | null => {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const parsed = value.map((component) => Number(component));
  if (parsed.some((component) => !Number.isFinite(component))) {
    return null;
  }
  return [parsed[0], parsed[1], parsed[2]] as VectorTuple;
};

export const cloneVectorTuple = (value: VectorTuple): VectorTuple => [
  value[0],
  value[1],
  value[2],
];
```

```typescript
// src/state/serialization/drones.ts
import type { DroneFlightState } from '../types';
import { normalizeTravelSnapshot, cloneTravelSnapshot } from './vectors';
import { coerceNumber } from '../utils';

export const normalizeDroneFlight = (
  value: unknown,
): DroneFlightState | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<DroneFlightState>;

  if (typeof raw.droneId !== 'string' || raw.droneId.length === 0) {
    return null;
  }

  const travel = normalizeTravelSnapshot(raw.travel);
  if (!travel) {
    return null;
  }

  return {
    droneId: raw.droneId,
    state: raw.state,
    targetAsteroidId:
      typeof raw.targetAsteroidId === 'string' ? raw.targetAsteroidId : null,
    targetRegionId:
      typeof raw.targetRegionId === 'string' ? raw.targetRegionId : null,
    targetFactoryId:
      typeof raw.targetFactoryId === 'string' ? raw.targetFactoryId : null,
    pathSeed: coerceNumber(raw.pathSeed, 0),
    travel,
  };
};

export const cloneDroneFlight = (
  flight: DroneFlightState,
): DroneFlightState => ({
  droneId: flight.droneId,
  state: flight.state,
  targetAsteroidId: flight.targetAsteroidId,
  targetRegionId: flight.targetRegionId,
  targetFactoryId: flight.targetFactoryId,
  pathSeed: flight.pathSeed,
  travel: cloneTravelSnapshot(flight.travel),
});
```

```typescript
// src/state/serialization/factory.ts
import type { BuildableFactory, FactorySnapshot } from '../types';
import { normalizeVectorTuple, cloneVectorTuple } from './vectors';
import {
  normalizeFactoryResources,
  normalizeFactoryUpgrades,
} from './resources';
import { coerceNumber } from '../utils';

export const normalizeFactorySnapshot = (
  value: unknown,
): FactorySnapshot | null => {
  // Complex factory normalization logic (~120 lines)
};

export const cloneFactory = (factory: BuildableFactory): BuildableFactory => {
  // Factory cloning logic
};

export const snapshotToFactory = (
  snapshot: FactorySnapshot,
): BuildableFactory => {
  // Snapshot to domain object conversion
};

export const factoryToSnapshot = (
  factory: BuildableFactory,
): FactorySnapshot => {
  // Domain object to snapshot conversion
};
```

```typescript
// src/state/serialization/resources.ts
import type { FactoryResourceSnapshot, FactoryUpgradeSnapshot } from '../types';
import { coerceNumber } from '../utils';

export const normalizeFactoryResources = (
  value: unknown,
): FactoryResourceSnapshot => {
  // Resource normalization
};

export const normalizeFactoryUpgrades = (
  value: unknown,
): FactoryUpgradeSnapshot => {
  // Upgrade normalization
};

export const normalizeDroneOwners = (
  value: unknown,
): Record<string, string | null> => {
  // Drone ownership normalization
};
```

```typescript
// src/state/serialization/store.ts
import type { StoreSnapshot, StoreState } from '../types';
import { normalizeSnapshot, serializeStore } from './internal';

export const stringifySnapshot = (snapshot: StoreSnapshot): string =>
  JSON.stringify(snapshot);

export const parseSnapshot = (payload: string): StoreSnapshot | null => {
  try {
    const parsed = JSON.parse(payload) as Partial<StoreSnapshot>;
    return normalizeSnapshot(parsed);
  } catch (error) {
    console.warn('Failed to parse snapshot payload', error);
    return null;
  }
};

export const normalizeSnapshot = (
  snapshot: Partial<StoreSnapshot>,
): StoreSnapshot => {
  // Top-level store normalization
};

export const serializeStore = (state: StoreState): StoreSnapshot => {
  // Store serialization
};
```

```typescript
// src/state/serialization/index.ts
// Re-export public API
export * from './vectors';
export * from './drones';
export * from './factory';
export * from './resources';
export * from './store';
export type * from './types';
```

```typescript
// src/lib/resourceMerging.ts (NEW - extracted game logic)
import type { Resources, Modules } from '@/state/types';
import { getResourceModifiers } from './resourceModifiers';
import { getStorageCapacity } from '@/state/utils';

export const mergeResourceDelta = (
  base: Resources,
  delta: Partial<Resources>,
  modules: Modules,
  capacityAware: boolean,
  prestigeCores = 0,
): Resources => {
  // Complex game logic with prestige and capacity awareness
  // NOW ISOLATED from serialization concerns
};
```

## References

- **Refactor Plan**: `memory/designs/REFACTOR-PLAN-three-largest-files.md`
- **Current Implementation**: `src/state/serialization.ts`
- **Store Types**: `src/state/types.ts`
- **Related Task**: TASK009 (Tests & CI)

## Acceptance Criteria

- [ ] All 6 domain modules created in `src/state/serialization/`
- [ ] Game logic (`mergeResourceDelta`) moved to `src/lib/resourceMerging.ts`
- [ ] Public API re-exported from `src/state/serialization/index.ts`
- [ ] All imports updated across codebase (no broken imports)
- [ ] Each module is 50–100 lines, single concern
- [ ] Factory normalization broken into logical sub-functions if needed
- [ ] Type guards consolidated in `types.ts` module
- [ ] Unit tests cover each domain (happy path + edge cases)
- [ ] Save/load round-trip integration test passes
- [ ] TypeScript compiles with no errors
- [ ] All existing tests pass
- [ ] Bundle size verified (no significant regression)
- [ ] PR created with before/after file structure comparison
