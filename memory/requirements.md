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
