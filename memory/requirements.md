# Requirements

## RQ-001 Core Economy Tick

WHEN the simulation advances by a fixed timestep, THE SYSTEM SHALL convert available ore into bars at a 10:1 ratio modified by refinery level and prestige bonus. [Acceptance: Unit test validates tick math for multiple module levels.]

## RQ-002 Drone Fleet Scaling

WHEN the player purchases additional drone bay modules, THE SYSTEM SHALL adjust the active drone count within one second to match the module level minimum of one drone. [Acceptance: Unit or integration test confirms drone count change after upgrade.]

## RQ-003 Asteroid Richness Scaling

WHEN the scanner module level increases, THE SYSTEM SHALL spawn future asteroids with an increased average ore richness proportional to the scanner bonus. [Acceptance: Unit test measures richness mean rising with level.]

## RQ-004 UI Feedback Loop

WHEN resources change due to simulation or actions, THE SYSTEM SHALL update HUD and upgrade panel values within the next frame. [Acceptance: Playwright test verifies ore accrual and upgrade availability.]

## RQ-005 Prestige Reset

WHEN the player activates prestige with required bars, THE SYSTEM SHALL grant permanent cores based on bars held, reset run resources, and preserve prestige bonus function. [Acceptance: Unit test verifies prestige gain and reset behavior.]

## RQ-006 Spec Reflects Persistence Stack

WHEN maintainers consult the spec for save/offline behavior, THE SYSTEM SHALL describe the existing persistence manager API (load/start/stop/save/import/export) and the offline simulation utility contract including cap-hours handling. [Acceptance: Spec section enumerates manager methods, storage key, and offline simulation flow tied to current code.]

## RQ-007 Spec Differentiates Implemented vs. Planned UI/Systems

WHEN the spec covers UI and ECS systems, THE SYSTEM SHALL distinguish between features present in the codebase and roadmap items, so that readers can see current coverage and open gaps. [Acceptance: Spec explicitly labels implemented HUD/Upgrade panel, notes missing Settings/offline recap, and calls out placeholder systems.]

## RQ-008 Per-Drone Energy Throttle

WHEN a drone consumes more power than the grid can supply, THE SYSTEM SHALL slow that drone's travel and mining speed according to its battery charge fraction while never dropping below the configured throttle floor and without allowing negative battery values. [Acceptance: Unit tests exercise mining and travel ticks with depleted batteries to confirm throttled progress and non-negative charge.]

## RQ-009 Seeded World Generation

WHEN a new world is generated with a given RNG seed, THE SYSTEM SHALL place asteroids in identical positions and with the same attributes whenever that seed is reused, while different seeds yield different layouts. [Acceptance: Unit tests construct worlds with shared/different seeds and compare asteroid distributions.]

## RQ-010 Visual Effects Toggle Persistence

WHEN the player changes the drone trails preference in Settings, THE SYSTEM SHALL persist the `showTrails` flag across autosaves and import/export operations and apply the new value within the next rendered frame. [Acceptance: Unit tests cover settings normalization/serialization, and UI tests assert the toggle updates the store and re-renders the scene without errors.]

## RQ-011 Drone Trail Rendering

WHEN drones travel or change state, THE SYSTEM SHALL render a fading trail indicating their recent path using at most one additional draw call and no more than 12 stored points per drone, honoring the global `showTrails` toggle. [Acceptance: Unit tests validate the trail buffer helper's vertex counts/color gradients, and manual verification confirms the toggle hides/shows trails without performance regressions.]

## RQ-012 Factory Transfer Feedback

WHEN a drone unloads cargo at the factory, THE SYSTEM SHALL emit a visible transfer effect that travels from the drone's approach vector into the factory within 0.75 seconds. [Acceptance: Unit tests cover event emission during unload, and manual verification confirms the effect spawns at runtime.]

## RQ-013 Conveyor Activity Animation

WHEN the refinery consumes ore, THE SYSTEM SHALL animate conveyor belts and ore items with speed proportional to the current processing intensity. [Acceptance: Unit tests assert processing intensity updates from the refinery system, and manual verification confirms belt motion while ore is processed.]

## RQ-014 Boost Emissive Pulse

WHEN refinery throughput exceeds the baseline by 20% or more, THE SYSTEM SHALL trigger a temporary boost pulse on factory materials that fades out over 1.5 seconds. [Acceptance: Unit tests verify boost levels decay over time and spike above the threshold, and manual verification confirms the emissive pulse.]

## RQ-015 Performance Profiles

WHEN the player selects a factory performance profile in Settings, THE SYSTEM SHALL adjust visual effect density to match the profile within the next rendered frame and persist the choice across saves. [Acceptance: Unit tests cover settings normalization/export, and manual verification confirms profiles toggle effect density.]

## RQ-016 Per-Drone Target Selection

WHEN an idle drone seeks a mining target while multiple asteroids are available, THE SYSTEM SHALL choose among the nearby asteroids using deterministic weighted randomization so that simultaneous assignments distribute drones instead of converging on a single rock. [Acceptance: Unit tests simulate repeated assignments and assert the chosen asteroid IDs vary when multiple options exist.]

## RQ-017 Deterministic Flight Offsets

WHEN a drone begins travel, THE SYSTEM SHALL generate a seeded path offset that perturbs the waypoint curve without changing its endpoints, ensuring drones with identical seeds reproduce the same motion. [Acceptance: Unit tests cover offset determinism for fixed seeds and confirm path endpoints remain stable.]

## RQ-018 Flight Persistence

WHEN the player saves or reloads while drones are mid-flight, THE SYSTEM SHALL serialize and restore each flight's target, seeded offset, and progress so that drones resume the exact trajectory after load. [Acceptance: Integration test saves a mid-flight snapshot, reloads it, and verifies flight state resumes with matching progress and seed.]
