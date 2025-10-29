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

## RQ-019 Resource Modifier Computation

WHEN resource stockpiles change, THE SYSTEM SHALL recompute persistent modifiers using diminishing returns and clamp them to configured caps while exposing the values to downstream systems. [Acceptance: Unit tests cover modifier math for each resource at low/high stocks and assert caps are respected.]

## RQ-020 Resource-Driven Systems Integration

WHEN Metals, Crystals, Organics, or Ice amounts change, THE SYSTEM SHALL adjust drone durability/capacity, refinery yield, and energy storage/generation/consumption within the next simulation tick. [Acceptance: Unit/integration tests observe stat deltas in fleet, refinery, and energy systems after updating the corresponding resources.]

## RQ-021 Resource Modifier Visibility

WHEN players view the HUD, THE SYSTEM SHALL display current resource-derived bonuses with descriptive labels and tooltips that update as resources change. [Acceptance: React component test or manual verification confirms the HUD list reflects live modifier percentages.]

## RQ-022 Factory Purchase Flow

WHEN the player buys a factory, THE SYSTEM SHALL verify affordability, deduct the metals and crystals cost, and place the new factory at a valid location with default capacities. [Acceptance: Unit test constructs a store, purchases a factory, and asserts resources drop while the factory count increases with initialized defaults.]

## RQ-023 Drone Factory Assignment

WHEN a drone transitions to a returning state with cargo, THE SYSTEM SHALL reserve a docking slot at the factory with the least-filled docking queue (ties broken by distance) and set the drone's travel target to that factory to balance load across all available factories. [Acceptance: Drone AI unit test assigns drones from a common position and verifies they distribute across multiple factories roughly equally, with no single factory receiving all drones.]

## RQ-024 Factory Refining Pipeline

WHEN factory storage contains ore and refine slots are free, THE SYSTEM SHALL start refine processes that drain energy each tick and deliver refined ore to the global resource pool on completion. [Acceptance: Store-level unit test enqueues ore, advances processFactories, and asserts energy decreases while refined ore accumulates.]

## RQ-025 Camera Autofit Trigger

WHEN the player clicks the Autofit Factories control, THE SYSTEM SHALL animate the camera to encompass all factory positions within the configured margin and zoom limits. [Acceptance: Hook unit test or integration harness fires the trigger and inspects the computed camera state for expected bounds.]

## RQ-026 Factory Return Distribution

WHEN a drone enters the returning phase with cargo, THE SYSTEM SHALL select a destination factory by weighting nearest open bays most heavily while retaining a non-zero probability for other factories, queuing at the chosen site if docks are occupied. [Acceptance: Drone AI unit test seeds repeated returns and asserts distribution favours nearest while allowing alternates and that queue length never exceeds docking capacity.]

## RQ-027 Per-Factory Energy and Resources

WHEN factories consume or receive resources, THE SYSTEM SHALL track ore, refined outputs, and energy on each factory independently, applying idle and refine drains against that factory's energy store and refusing new processes when depleted. [Acceptance: Store-level tests simulate energy drain/refill per factory and confirm processes pause when energy hits zero while other factories continue.]

## RQ-028 Factory Upgrade & Ownership Panel

WHEN the player opens the factory management UI, THE SYSTEM SHALL provide arrow controls to cycle through factories, show the selected factory's stats, and allow buying upgrades and assigning drones that persist to whichever factory they last landed on. [Acceptance: React component test verifies arrow cycling updates the display, upgrade buttons consume per-factory currency, and docking swaps drone ownership to the most recent factory.]

## RQ-029 Desktop HUD Responsiveness

WHEN the browser viewport width changes between 960px and 1920px, THE SYSTEM SHALL fluidly scale HUD typography and spacing so that no HUD item overflows its container and all resource labels remain fully visible. [Acceptance: UI test or manual verification captures widths at 960px, 1280px, and 1920px showing clamped typography with zero horizontal scroll or clipped text.]

## RQ-030 Panel Height Management

WHEN the available viewport height is less than 900px, THE SYSTEM SHALL constrain sidebar panels to fit within the viewport and provide internal scrolling so buttons and content remain reachable without overlapping other UI. [Acceptance: Manual verification resizes the window height to 720px and confirms the sidebar introduces scroll within its bounds while the rest of the UI remains unobscured.]

## RQ-031 Inspector & Sidebar Coexistence

WHEN the viewport width drops below 1280px, THE SYSTEM SHALL adjust inspector and sidebar widths using clamped sizing to prevent overlap or horizontal overflow while keeping all controls visible. [Acceptance: Manual verification at 1180px width confirms the sidebar and inspector remain within the window with no clipped buttons or text.]

## RQ-032 Unload Idle Reset

WHEN a drone completes an unload system tick, THE SYSTEM SHALL release its docking slot and transition the drone to `idle` even if the cargo amount is zero. [Acceptance: Store/ECS test runs the unload system with zero-cargo drones and asserts the drone leaves the queue, enters `idle`, and clears `targetFactoryId`.]

## RQ-033 Factory Assignment Cleanup

WHEN a drone's state is neither `returning` nor `unloading`, THE SYSTEM SHALL clear any lingering `targetFactoryId` and remove the drone from that factory's queue so the AI can assign a fresh destination. [Acceptance: Drone AI unit test forces a state mismatch and verifies the drone is removed from the factory queue and `targetFactoryId` becomes null within one tick.]

## RQ-034 Factory Energy Charging

WHEN a docked drone requires energy and its owning factory still has stored energy, THE SYSTEM SHALL charge the drone from that factory pool when the global grid cannot supply enough energy, deducting the matching amount from the factory. [Acceptance: Power system test drains global energy, leaves factory energy available, ticks the system, and confirms the drone battery increases while factory energy decreases by the charged amount.]

## RQ-035 Factory Solar Regeneration

WHEN a factory has at least one solar collector upgrade active during a power system tick, THE SYSTEM SHALL add `baseRegen + perLevel * upgradeLevel` energy to that factory's local store without exceeding its energy capacity. [Acceptance: Power system unit test advances ticks with varying upgrade levels and asserts factory energy increases accordingly while clamping at capacity.]

## RQ-036 Warehouse Onboarding Hauler

WHEN a new game run initializes, THE SYSTEM SHALL spawn Factory 0 with one assigned hauler and a starter cache of ore and bars so that logistics activity is visible within the first tick. [Acceptance: Store initialization test confirms `haulersAssigned === 1` on Factory 0 and local stock values exceed zero.]

## RQ-037 Warehouse Export Scheduling

WHEN a factory holds a warehoused resource above its buffer target plus reserve, THE SYSTEM SHALL schedule an export transfer to the warehouse and only increase warehouse inventory when the transfer completes. [Acceptance: Logistics scheduler test verifies surplus factories enqueue warehouse-bound transfers and warehouse totals change after `executeArrival`.]

## RQ-038 Warehouse Import Scheduling

WHEN a factory's warehoused resource level drops below its buffer target and the warehouse has available inventory, THE SYSTEM SHALL schedule an import transfer that maintains warehouse totals above zero and respects the factory's minimum reserve threshold. [Acceptance: Scheduler/import test confirms warehouse dispatch obeys reserves and updates both inventories correctly.]

## RQ-039 Local Production Isolation

WHEN refinery batches or drone unloads produce resources at a factory, THE SYSTEM SHALL retain the output in that factory's local inventory until logistics exports it, preventing concurrent increments to warehouse totals. [Acceptance: Factory processing and unload tests assert global warehouse resources remain unchanged until an export transfer arrives.]

## RQ-040 Prestige Warehouse Reset

WHEN the player activates prestige, THE SYSTEM SHALL compute earned cores from the warehouse inventory available at trigger time and then reset both warehouse and factory inventories to their starting values. [Acceptance: Prestige flow test confirms cores awarded match warehouse stock and all post-prestige inventories reset.]

## RQ-041 Settings Multi-Column Layout

WHEN the viewport width is at least 1280px and the Settings panel is open, THE SYSTEM SHALL arrange top-level settings sections into at least two columns while preserving reading order left-to-right, top-to-bottom, and without introducing horizontal overflow. [Acceptance: Manual resize at 1440px width shows two columns rendered with no clipped text or horizontal scrollbars.]

## RQ-042 Settings Panel Height Clamp

WHEN the Settings panel content height exceeds the available viewport height minus its modal margins, THE SYSTEM SHALL clamp the panel height and expose an internal vertical scrollbar so the browser window itself does not overflow. [Acceptance: Manual resize to 720px height verifies panel max-height clamps and an internal scrollbar appears while the window stays static.]

## RQ-043 Settings Narrow View Layout

WHEN the viewport width shrinks below 1024px, THE SYSTEM SHALL collapse the Settings panel to a single column, reducing horizontal padding as needed so that the panel fits within the viewport without spawning horizontal scrollbars. [Acceptance: Manual resize at 900px width confirms a single column layout with no horizontal scrolling.]

## RQ-044 Factory Buffer Target Visibility

WHEN viewing a factory's storage inventory in the Inspector, THE SYSTEM SHALL display the logistics buffer target for each tracked resource (ore, bars, metals, crystals, organics, ice) as a suffix label so players understand the surplus/deficit thresholds. [Acceptance: React component test verifies buffer targets render for each resource, TypeScript compiles without errors, and linting passes.]

## RQ-045 Warehouse Landmark Placement

WHEN the game world initializes, THE SYSTEM SHALL create a static warehouse entity positioned at Vector3(8, 0, 5) and expose it via `gameWorld.warehouse` without adding it to drone or asteroid queries. [Acceptance: Unit test instantiates a fresh world and asserts the warehouse position vector and entity isolation.]

## RQ-046 Warehouse Docking Ring Animation

WHEN the warehouse renders in the 3D scene, THE SYSTEM SHALL rotate its docking ring at 0.5 radians per second around the Y axis so the station appears active. [Acceptance: Unit test covers the rotation helper to confirm the angular velocity constant and frame-update behavior.]

## RQ-047 Warehouse Panel Presentation

WHEN the HUD renders, THE SYSTEM SHALL display a "Warehouse" panel with a card-styled resource list and resource bonuses section matching the factory panel theming, including the Settings button anchored at the bottom. [Acceptance: React component test renders the panel, verifies resource formatting, header hierarchy, bonuses heading, and Settings button callback.]

## RQ-048 Global Hauler Module Scaling

WHEN a player purchases a global hauler module upgrade, THE SYSTEM SHALL apply the corresponding capacity and speed multipliers to every factory's hauler configuration during logistics resolution. [Acceptance: Unit tests confirm that warehouse module levels increase computed capacity and speed for multiple factories.]

## RQ-049 Per-Factory Hauler Overrides

WHEN a factory owns hauler override upgrades, THE SYSTEM SHALL merge the override bonuses with the global module multipliers so that the factory receives the higher of additive bonuses and stacked multipliers without affecting other factories. [Acceptance: Unit tests set different override levels per factory and assert resolved configs differ only where overrides exist.]

## RQ-050 Hauler Upgrade Purchase Validation

WHEN a player attempts to buy a hauler module or factory override upgrade, THE SYSTEM SHALL validate affordability, enforce maximum level caps, deduct the required resources, and reject purchases that fail validation without mutating state. [Acceptance: Store slice tests cover successful purchases, insufficient funds, and max-level rejections.]

## RQ-051 Save Migration for Hauler Upgrades

WHEN loading a snapshot saved before version 0.3.3, THE SYSTEM SHALL initialize all new hauler module and per-factory upgrade fields to their defaults while preserving existing data so the save loads without errors. [Acceptance: Migration tests load a pre-0.3.3 snapshot and assert new fields exist with zeroed levels and prior data remains intact.]

## RQ-052 Hauler Upgrade Guidance Tooltips

WHEN a player views the Logistics Modules panel or a factory's Per-Factory Upgrades section, THE SYSTEM SHALL surface contextual guidance explaining that global modules apply network-wide while overrides affect only the inspected factory. [Acceptance: UI tests assert that help affordances render with descriptive copy next to the Logistics Modules header and within the factory hauler upgrades list.]

## RQ-053 Specialization Tech Unlock Thresholds

WHEN the cumulative metals, crystals, organics, or ice spent on specialization techs reaches each tech's unlock threshold, THE SYSTEM SHALL expose that tech in the Specialization panel with its current level, cost, and effect description. [Acceptance: Store/unit tests simulate spend increments and assert the selector marks techs unlocked at exactly the target thresholds.]

## RQ-054 Specialization Tech Bonus Application

WHEN a player purchases a specialization tech level, THE SYSTEM SHALL immediately apply the advertised multiplier to the corresponding production system (ore attraction, asteroid richness, refinery yield, or offline gains) and reflect the effect in downstream calculations. [Acceptance: Integration tests cover ore delivery scaling, asteroid spawn richness, refinery output, and offline simulation multipliers after purchasing tech levels.]

## RQ-055 Prestige Investment Persistence

WHEN a player invests resources into the prestige investment board, THE SYSTEM SHALL persist the purchased tiers across prestige resets while leaving per-run specialization tech progress reset. [Acceptance: Store/serialization tests prestige the run and verify investment tiers remain while specialization state clears.]

## RQ-056 Prestige Investment Bonus Stack

WHEN prestige investment tiers exist, THE SYSTEM SHALL apply their bonuses multiplicatively with specialization tech multipliers, increasing drone speed, asteroid spawn rate, refinery yield, and offline gains by the documented per-tier percentages. [Acceptance: Unit tests compute combined multipliers from multiple tiers and confirm stacking order matches design.]

## RQ-057 Sink Progress UI Visibility

WHEN viewing the Warehouse prestige and specialization panels, THE SYSTEM SHALL display current spend totals, tier levels, next costs, and aggregate multipliers so players understand the effect of their investments. [Acceptance: React component tests verify renders for locked/unlocked states, tooltip text, and formatted progress values.]

## RQ-058 Hauler Ship Rendering

WHEN logistics schedules a transfer with status `scheduled` or `in-transit`, THE SYSTEM SHALL render an animated hauler ship along that route within the 3D scene instead of the legacy transfer line. [Acceptance: React Three Fiber test mounts the component with a sample transfer and asserts the instanced mesh count equals the transfer count.]

## RQ-059 Hauler Flight Interpolation

WHEN a hauler ship is in flight, THE SYSTEM SHALL interpolate its position along an arcing Bezier curve using the transfer's departure time, ETA, and the current `gameTime` so that progress is time-based and clamped to `[0, 1]`. [Acceptance: Unit tests validate the interpolation helper returns correct vectors at `t = 0`, mid-curve, and `t = 1`, including clamping for early/late gameTime values.]

## RQ-060 Hauler Orientation & Trails

WHEN hauler ships move, THE SYSTEM SHALL orient each ship to face its instantaneous velocity and emit a resource-colored engine glow or trail so players can perceive direction and motion. [Acceptance: Rendering test inspects instance matrices/quaternions for forward alignment, and snapshot verifies emissive trail material per resource color.]

## RQ-061 Hauler Interaction Feedback

WHEN a player hovers a hauler ship, THE SYSTEM SHALL display a tooltip containing source, destination, resource, amount, and ETA remaining while subtly brightening the ship. [Acceptance: Interaction test triggers pointer events and confirms tooltip content and emissive intensity update.]

## RQ-062 Hauler Visual Toggle

WHEN the player disables "Show Hauler Ships" in Settings, THE SYSTEM SHALL hide hauler ships and fall back to the legacy transfer lines while persisting the preference across saves. [Acceptance: Settings test toggles the option, verifies store state persists, and asserts the scene swaps between components accordingly.]

## RQ-063 Factory Metrics Tab Visibility

WHEN the player inspects a factory, THE SYSTEM SHALL surface a Metrics tab containing ore-in, bars-produced, and hauler throughput sparklines plus the latest numeric summaries within the panel. [Acceptance: React UI test opens the factory inspector and asserts the Metrics tab renders three labeled charts and numeric readouts for the selected factory.]

## RQ-064 Factory Metrics Sampling Buffer

WHEN the simulation advances while metrics are enabled, THE SYSTEM SHALL collect per-factory ore delta, bar delta, hauler throughput, and energy samples at the configured interval and maintain at least the last five minutes of data. [Acceptance: Store-level test simulates ticks over five minutes and verifies each factory buffer contains approximately 60 samples with correct timestamps and computed rates.]

## RQ-065 Metrics Performance Profile Gating

WHEN the player sets the performance profile to "low" or toggles metrics off, THE SYSTEM SHALL throttle sampling to no more frequently than every fifteen seconds or suspend sampling entirely to protect frame time. [Acceptance: Settings/metrics test updates the profile to "low" and confirms the effective sampling interval meets or exceeds 15 seconds and buffers stop accumulating when metrics are disabled.]

## RQ-066 Metrics Lifecycle Cleanup

WHEN a factory is removed or the game resets, THE SYSTEM SHALL clear the associated metrics buffers to prevent stale data and memory leaks. [Acceptance: Store integration test removes a factory and asserts its metrics entry is removed immediately; resetGame test verifies all metrics maps are empty afterward.]
