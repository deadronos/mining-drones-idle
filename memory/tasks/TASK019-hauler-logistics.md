# TASK019 - Hauler Logistics Implementation

**Status:** Pending  
**Added:** 2025-10-19  
**Updated:** 2025-10-19  
**Design Reference:** [DES018: Per-Factory Upgrades & Hauler Logistics](../designs/DES018-per-factory-upgrades-hauler-logistics.md)

## Original Request

Implement hauler drones logistics system to redistribute resources between factories, addressing resource management complexity with multiple buyable factories.

## Thought Process

The hauler logistics system is a critical feature for scaling the multi-factory gameplay introduced in TASK016. Without it, players must manually manage resource distribution, creating tedious micromanagement. The design proposes:

1. **Reservation-based scheduling** to prevent race conditions and make the system deterministic
2. **Configurable per-factory settings** to give players control without overwhelming complexity
3. **Auto-mode with smoothing** to handle common cases automatically while preventing thrashing
4. **Minimal global state changes** to keep migration low-risk

Key implementation challenges:
- Performance at scale (50+ factories with O(N²) matching)
- Save/load migration without breaking existing saves
- UI that's intuitive for both new and advanced players
- Testing reservation logic and edge cases thoroughly

The phased approach allows us to deliver core value quickly while leaving room for future enhancements (multi-hop, central hubs, specialized haulers).

## Implementation Plan

### Phase 1: Data Layer & Core Types

1. Extend type definitions in `src/state/store.ts`
2. Add `HaulerConfig` and `FactoryLogisticsState` interfaces
3. Extend `FactorySnapshot` and `BuildableFactory` types
4. Add `logisticsQueues` to `StoreState`
5. Update serialization functions (`factoryToSnapshot`, `normalizeFactorySnapshot`)

### Phase 2: Scheduling Algorithm

1. Create `src/ecs/logistics.ts` with core functions:
   - `computeBufferTarget(factory, resource): number`
   - `computeTravelTime(source, dest, config): number`
   - `matchSurplusToNeed(factories, resource): Transfer[]`
   - `generateTransferId(): string`
2. Implement `processLogistics(dt)` method in store
3. Add logistics tick timing and interval management

### Phase 3: Store Integration

1. Add store methods:
   - `assignHaulers(factoryId, count): boolean`
   - `updateHaulerConfig(factoryId, config): void`
   - `getLogisticsStatus(factoryId): LogisticsStatus`
2. Hook `processLogistics` into main game loop (`tick` method)
3. Implement reservation tracking and cleanup

### Phase 4: Migration & Persistence

1. Bump `SAVE_VERSION` to `'0.3.0'`
2. Add migration logic in `normalizeSnapshot`
3. Initialize default hauler fields for existing factories
4. Add migration notification logic
5. Update snapshot validation tests

### Phase 5: UI Components

1. Create `src/ui/LogisticsPanel.tsx` (global overview)
2. Extend Factory Inspector with hauler controls
3. Add hauler assignment buttons (+/-)
4. Add mode dropdown and resource filter checkboxes
5. Add inbound/outbound shipment displays
6. Show ETA and transfer status

### Phase 6: Visual Indicators

1. Add transfer lines/arrows in 3D scene
2. Implement line thickness based on transfer amount
3. Add resource-type color coding
4. Add hover tooltips with transfer details
5. Integrate with existing rendering pipeline

### Phase 7: Testing

1. Write unit tests (`tests/unit/logistics.spec.ts`):
   - Matching algorithm correctness
   - Reservation prevention of double-booking
   - Min reserve enforcement
   - Global resource totals unchanged
   - Hysteresis/cooldown behavior
2. Write integration tests (`tests/e2e/factory-logistics.spec.ts`):
   - Starvation resolution scenario
   - Save/load persistence
   - Multi-factory network behavior
3. Performance testing with 50+ factories

### Phase 8: Balance & Polish

1. Add hauler purchase cost calculation
2. Implement hauler maintenance cost (energy drain)
3. Tune default parameters (buffer_seconds, capacity, speed)
4. Add tooltips and help text
5. Add bottleneck detection and suggestions

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks

| ID   | Description                                    | Status      | Updated    | Notes |
| ---- | ---------------------------------------------- | ----------- | ---------- | ----- |
| 1.1  | Extend type definitions                        | Not Started | 2025-10-19 |       |
| 1.2  | Update serialization                           | Not Started | 2025-10-19 |       |
| 2.1  | Create logistics.ts with core functions        | Not Started | 2025-10-19 |       |
| 2.2  | Implement processLogistics method              | Not Started | 2025-10-19 |       |
| 3.1  | Add store logistics methods                    | Not Started | 2025-10-19 |       |
| 3.2  | Hook into game loop                            | Not Started | 2025-10-19 |       |
| 4.1  | Bump save version and add migration            | Not Started | 2025-10-19 |       |
| 4.2  | Update persistence tests                       | Not Started | 2025-10-19 |       |
| 5.1  | Create LogisticsPanel component                | Not Started | 2025-10-19 |       |
| 5.2  | Extend Factory Inspector with hauler controls  | Not Started | 2025-10-19 |       |
| 6.1  | Add 3D transfer visualization                  | Not Started | 2025-10-19 |       |
| 6.2  | Add hover tooltips                             | Not Started | 2025-10-19 |       |
| 7.1  | Write unit tests for scheduler                 | Not Started | 2025-10-19 |       |
| 7.2  | Write integration tests                        | Not Started | 2025-10-19 |       |
| 7.3  | Performance testing                            | Not Started | 2025-10-19 |       |
| 8.1  | Implement cost and maintenance                 | Not Started | 2025-10-19 |       |
| 8.2  | Tune parameters and add polish                 | Not Started | 2025-10-19 |       |

## Progress Log

### 2025-10-19

- Created task file based on DES018 design document
- Broke implementation into 8 phases with 35 discrete steps
- Identified key challenges: performance, migration, reservation logic
- Status: Planning complete, ready for implementation

## Technical Notes

### Performance Considerations

- Scheduler runs every 1-5s (configurable via `LOGISTICS_INTERVAL`)
- For N factories and M resources, naive O(N²×M) per tick
- Optimizations planned:
  - Filter to only factories with nonzero need/surplus before matching
  - Use priority queues sorted by need/surplus magnitude
  - Cache distance matrix between factories
  - Limit to top-K candidates per resource per tick
  - Consider region-based clustering for 100+ factories

### Critical Constraints

1. **No Global Sum Drift:** Transfers between factories must never change `state.resources` totals
2. **Deterministic:** Given same initial state, scheduler produces same transfers
3. **Reservation Safety:** Double-booking prevented via immediate reservation at scheduling time
4. **Min Reserve:** Never drain factory below `min_reserve_seconds` worth of resources
5. **Graceful Degradation:** System works with 0 haulers (no crashes), just no transfers

### Data Invariants

- `factory.logisticsState.outboundReservations[resource] >= 0` always
- Sum of all `factory.resources[resource]` equals `state.resources[resource]` for global resources
- `transfer.eta >= gameTime` when status is 'scheduled'
- `source.resources[resource] >= outboundReservations[resource]` after scheduling

### Migration Safety

- Migration is additive only (adds fields, never removes)
- Default values ensure old saves work without haulers
- Version guard ensures migration runs exactly once
- Notification shown only on first load after migration

## Dependencies

**Blocked By:**

- None (can start immediately)

**Blocks:**

- Future factory specialization features
- Central storage hub implementation
- Multi-hop routing enhancements

**Related:**

- TASK016: Factory Buyable (provides multi-factory foundation)
- TASK017: Factory Fleet Upgrades (similar per-factory upgrade pattern)
- TASK009: Tests & CI (hauler tests will extend test suite)

## Success Criteria

**Functional:**

- [ ] Factories can be assigned haulers via UI
- [ ] Scheduler runs and transfers resources between factories
- [ ] Reservations prevent double-booking
- [ ] Save/load preserves hauler state and in-transit transfers
- [ ] Global resource totals remain unchanged by internal transfers
- [ ] UI shows inbound/outbound shipments with ETAs

**Testing:**

- [ ] Unit tests pass for all scheduler functions
- [ ] Integration tests confirm starvation resolution
- [ ] Performance acceptable (<16ms/tick) at 50+ factories
- [ ] No regression in existing persistence tests

**Polish:**

- [ ] Visual transfer lines appear in 3D scene
- [ ] Tooltips explain hauler mechanics
- [ ] Bottleneck detection suggests when more haulers needed
- [ ] Help text explains global vs factory storage

**Player Value:**

- [ ] Reduces micromanagement of resource distribution
- [ ] Enables factory specialization strategies
- [ ] Adds depth without overwhelming new players (default: 0 haulers)
- [ ] Clear upgrade path from manual management to automated logistics

## Future Enhancements (Post-MVP)

**V2 (Medium Priority):**

- Central storage hub (special factory type)
- Multi-hop routing for large networks
- Specialized hauler types (heavy/fast)
- Energy haulers
- Per-factory/global hauler efficiency upgrades

**V3 (Lower Priority):**

- Manual route editor
- Logistics analytics dashboard
- Auto-specialization suggestions
- Predictive bottleneck warnings
- Hauler autopilot (AI-driven optimization)

## Open Questions

1. Should hauler purchase be global unlock or per-factory? → **Decision: Per-factory assignment, global unlock via tech**
2. How to handle energy for haulers? → **Decision: Small maintenance cost, not hauled themselves initially**
3. Should we show transfer animations or just lines? → **Decision: Lines for MVP, animations in V2**
4. How to prevent thrashing without frustrating players? → **Decision: 20% hysteresis threshold + 10s cooldown**

## References

- Design: [DES018: Per-Factory Upgrades & Hauler Logistics](../designs/DES018-per-factory-upgrades-hauler-logistics.md)
- Code: `src/state/store.ts`, `src/ecs/logistics.ts` (new)
- Tests: `tests/unit/logistics.spec.ts` (new), `tests/e2e/factory-logistics.spec.ts` (new)
- Related Tasks: TASK016, TASK017, TASK009
