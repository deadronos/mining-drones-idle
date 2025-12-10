use crate::constants::{
    DRONE_MAX_BATTERY, DRONE_MAX_CARGO, DRONE_MINING_RATE, DRONE_SPEED, DRONE_STATE_IDLE,
    DRONE_STATE_MINING, DRONE_STATE_RETURNING, DRONE_STATE_TO_ASTEROID,
};
use crate::modifiers::ResourceModifierSnapshot;
use crate::rng::Mulberry32;
use crate::schema::{DroneFlight, FactorySnapshot, Modules, SimulationSnapshot, TravelSnapshot};
use crate::sinks::SinkBonuses;
use std::collections::{BTreeMap, HashSet};
use std::f32::consts::PI;

const NEARBY_LIMIT: usize = 4;
const FACTORY_VARIETY_CHANCE: f32 = 0.25;
const TARGET_INDEX_NONE: f32 = -1.0;
const EPSILON: f32 = 1e-4;
const MAX_OFFSET_DISTANCE: f32 = 3.0;
const SEED_MIX: u32 = 0x9e37_79b9;
const FRAC_PI_5: f32 = PI / 5.0;

#[derive(Clone, Debug, Default)]
pub struct AsteroidRegionMeta {
    pub id: String,
    pub weight: f32,
    pub gravity_multiplier: f32,
    pub offset: [f32; 3],
    pub hazard_severity: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct AsteroidMetadata {
    pub gravity_multiplier: f32,
    pub regions: Vec<AsteroidRegionMeta>,
}

#[derive(PartialEq, Eq)]
enum DockingResult {
    Docking,
    Queued,
    Exists,
}

#[derive(Clone)]
struct FactoryAssignment {
    factory_index: usize,
    factory_id: String,
    destination: [f32; 3],
    start_travel: bool,
}

#[derive(Clone)]
struct AsteroidTarget {
    id: String,
    index: usize,
    destination: [f32; 3],
    region_id: Option<String>,
    region_index: Option<usize>,
    gravity_multiplier: f32,
}

pub fn extract_asteroid_metadata(
    snapshot: &SimulationSnapshot,
    asteroid_id_to_index: &BTreeMap<String, usize>,
) -> Vec<AsteroidMetadata> {
    let mut metadata = vec![AsteroidMetadata::default(); asteroid_id_to_index.len()];

    if let Some(asteroids) = asteroid_array(snapshot) {
        for asteroid in asteroids {
            if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                if let Some(&idx) = asteroid_id_to_index.get(id) {
                    let asteroid_id = id.to_string();
                    let gravity = asteroid
                        .get("gravityMultiplier")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(1.0) as f32;

                    let mut entry = AsteroidMetadata {
                        gravity_multiplier: gravity.max(0.01),
                        regions: Vec::new(),
                    };

                    if let Some(regions) = asteroid.get("regions").and_then(|v| v.as_array()) {
                        for (region_index, region) in regions.iter().enumerate() {
                            let offset = region
                                .get("offset")
                                .and_then(|v| v.as_array())
                                .and_then(|arr| {
                                    if arr.len() >= 3 {
                                        Some([
                                            arr[0].as_f64().unwrap_or(0.0) as f32,
                                            arr[1].as_f64().unwrap_or(0.0) as f32,
                                            arr[2].as_f64().unwrap_or(0.0) as f32,
                                        ])
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or([0.0, 0.0, 0.0]);
                            let weight = region
                                .get("weight")
                                .and_then(|v| v.as_f64())
                                .unwrap_or(1.0) as f32;
                            let gravity_multiplier = region
                                .get("gravityMultiplier")
                                .and_then(|v| v.as_f64())
                                .unwrap_or(entry.gravity_multiplier as f64) as f32;
                            let hazard_severity = region
                                .get("hazard")
                                .and_then(|h| h.get("severity"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            let id = region
                                .get("id")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| format!("{}-r{}", asteroid_id, region_index));

                            entry.regions.push(AsteroidRegionMeta {
                                id,
                                weight,
                                gravity_multiplier: gravity_multiplier.max(0.01),
                                offset,
                                hazard_severity,
                            });
                        }
                    }

                    metadata[idx] = entry;
                }
            }
        }
    }

    metadata
}

fn asteroid_array(snapshot: &SimulationSnapshot) -> Option<&Vec<serde_json::Value>> {
    snapshot
        .extra
        .get("asteroids")
        .and_then(|value| value.as_array())
        .or_else(|| {
            snapshot
                .extra
                .get("extra")
                .and_then(|value| value.as_object())
                .and_then(|obj| obj.get("asteroids"))
                .and_then(|value| value.as_array())
        })
}

pub fn sys_drone_ai(
    drone_flights: &mut Vec<DroneFlight>,
    drone_states: &mut [f32],
    drone_cargo: &[f32],
    drone_positions: &[f32],
    drone_battery: &[f32],
    drone_max_battery: &mut [f32],
    drone_capacity: &mut [f32],
    drone_mining_rate: &mut [f32],
    drone_target_asteroid_index: &mut [f32],
    drone_target_factory_index: &mut [f32],
    drone_target_region_index: &mut [f32],
    drone_owner_factory_index: &[f32],
    drone_ids: &[String],
    drone_id_to_index: &BTreeMap<String, usize>,
    factory_id_to_index: &BTreeMap<String, usize>,
    asteroid_id_to_index: &BTreeMap<String, usize>,
    factories: &mut [FactorySnapshot],
    factory_positions: &[f32],
    asteroid_positions: &[f32],
    asteroid_metadata: &[AsteroidMetadata],
    asteroid_ore: &[f32],
    rng: &mut Mulberry32,
    modifiers: &ResourceModifierSnapshot,
    modules: &Modules,
    sink_bonuses: &SinkBonuses,
) {
    let mut active_drones = HashSet::new();
    for flight in drone_flights.iter() {
        active_drones.insert(flight.drone_id.clone());
    }

    let mut new_flights = Vec::new();

    for (drone_id, &drone_idx) in drone_id_to_index.iter() {
        if drone_idx >= drone_states.len() || active_drones.contains(drone_id) {
            continue;
        }

        let position = [
            *drone_positions.get(drone_idx * 3).unwrap_or(&0.0),
            *drone_positions.get(drone_idx * 3 + 1).unwrap_or(&0.0),
            *drone_positions.get(drone_idx * 3 + 2).unwrap_or(&0.0),
        ];

        let speed_bonus = 1.0 + ((modules.drone_bay as f32 - 1.0).max(0.0)) * 0.05;
        let base_speed = DRONE_SPEED * speed_bonus;
        let speed = base_speed * modifiers.drone_production_speed_multiplier;
        let capacity_base = DRONE_MAX_CARGO + modules.storage as f32 * 5.0;
        let capacity = capacity_base * modifiers.drone_capacity_multiplier;
        let max_battery = DRONE_MAX_BATTERY * modifiers.drone_battery_multiplier;
        let mining_base = DRONE_MINING_RATE + modules.refinery as f32 * 0.5;
        let mining_rate = mining_base * modifiers.drone_production_speed_multiplier;

        if let Some(slot) = drone_capacity.get_mut(drone_idx) {
            *slot = capacity;
        }
        if let Some(slot) = drone_max_battery.get_mut(drone_idx) {
            *slot = max_battery;
        }
        if let Some(slot) = drone_mining_rate.get_mut(drone_idx) {
            *slot = mining_rate;
        }
        if let Some(slot) = drone_target_region_index.get_mut(drone_idx) {
            *slot = TARGET_INDEX_NONE;
        }

        let state = drone_states[drone_idx];
        if state == DRONE_STATE_IDLE {
            if let Some(target) = select_asteroid_target(
                position,
                asteroid_positions,
                asteroid_ore,
                asteroid_metadata,
                asteroid_id_to_index,
                rng,
            ) {
                let path_seed = next_path_seed(rng);
                let travel = build_travel_snapshot(
                    position,
                    target.destination,
                    path_seed,
                    speed,
                    sink_bonuses.drone_speed_multiplier,
                    target.gravity_multiplier,
                );

                let owner_factory_id =
                    resolve_factory_id(factory_id_to_index, drone_owner_factory_index, drone_idx);

                new_flights.push(DroneFlight {
                    drone_id: drone_id.clone(),
                    state: "toAsteroid".to_string(),
                    target_asteroid_id: Some(target.id),
                    target_region_id: target.region_id,
                    target_factory_id: None,
                    owner_factory_id,
                    path_seed,
                    travel,
                    cargo: 0.0,
                    battery: *drone_battery.get(drone_idx).unwrap_or(&0.0),
                    max_battery,
                    capacity,
                    mining_rate,
                    cargo_profile: None,
                    charging: false,
                });

                drone_states[drone_idx] = DRONE_STATE_TO_ASTEROID;
                if let Some(slot) = drone_target_asteroid_index.get_mut(drone_idx) {
                    *slot = target.index as f32;
                }
                if let Some(slot) = drone_target_factory_index.get_mut(drone_idx) {
                    *slot = TARGET_INDEX_NONE;
                }
                if let Some(idx) = target.region_index {
                    if let Some(slot) = drone_target_region_index.get_mut(drone_idx) {
                        *slot = idx as f32;
                    }
                }
            }
        } else if state == DRONE_STATE_MINING || state == DRONE_STATE_RETURNING {
            let cargo = *drone_cargo.get(drone_idx).unwrap_or(&0.0);
            if state == DRONE_STATE_RETURNING || cargo >= capacity {
                let current_factory_index =
                    *drone_target_factory_index.get(drone_idx).unwrap_or(&TARGET_INDEX_NONE);
                let drone_label = drone_ids
                    .get(drone_idx)
                    .cloned()
                    .unwrap_or_else(|| drone_id.to_string());

                if let Some(assignment) = select_return_factory(
                    &drone_label,
                    current_factory_index,
                    position,
                    factories,
                    factory_positions,
                    rng,
                ) {
                    drone_states[drone_idx] = DRONE_STATE_RETURNING;
                    if let Some(slot) = drone_target_factory_index.get_mut(drone_idx) {
                        *slot = assignment.factory_index as f32;
                    }
                    if let Some(slot) = drone_target_asteroid_index.get_mut(drone_idx) {
                        *slot = TARGET_INDEX_NONE;
                    }
                    if let Some(slot) = drone_target_region_index.get_mut(drone_idx) {
                        *slot = TARGET_INDEX_NONE;
                    }

                    if assignment.start_travel {
                        let path_seed = next_path_seed(rng);
                        let travel = build_travel_snapshot(
                            position,
                            assignment.destination,
                            path_seed,
                            speed,
                            sink_bonuses.drone_speed_multiplier,
                            1.0,
                        );

                        new_flights.push(DroneFlight {
                            drone_id: drone_id.clone(),
                            state: "returning".to_string(),
                            target_asteroid_id: None,
                            target_region_id: None,
                            target_factory_id: Some(assignment.factory_id),
                            owner_factory_id: None,
                            path_seed,
                            travel,
                            cargo,
                            battery: *drone_battery.get(drone_idx).unwrap_or(&0.0),
                            max_battery,
                            capacity,
                            mining_rate,
                            cargo_profile: None,
                            charging: false,
                        });
                    }
                }
            }
        }
    }

    drone_flights.extend(new_flights);
}

fn select_asteroid_target(
    drone_position: [f32; 3],
    asteroid_positions: &[f32],
    asteroid_ore: &[f32],
    asteroid_metadata: &[AsteroidMetadata],
    asteroid_id_to_index: &BTreeMap<String, usize>,
    rng: &mut Mulberry32,
) -> Option<AsteroidTarget> {
    let asteroid_count = asteroid_positions.len() / 3;
    if asteroid_count == 0 {
        return None;
    }

    #[derive(Clone)]
    struct Candidate {
        index: usize,
        id: String,
        distance: f32,
    }

    let mut candidates: Vec<Candidate> = asteroid_id_to_index
        .iter()
        .filter_map(|(id, &idx)| {
            if idx >= asteroid_count {
                return None;
            }
            if *asteroid_ore.get(idx).unwrap_or(&0.0) <= 0.0 {
                return None;
            }
            let pos = [
                asteroid_positions[idx * 3],
                asteroid_positions[idx * 3 + 1],
                asteroid_positions[idx * 3 + 2],
            ];
            let dx = pos[0] - drone_position[0];
            let dy = pos[1] - drone_position[1];
            let dz = pos[2] - drone_position[2];
            let distance = (dx * dx + dy * dy + dz * dz).sqrt();
            Some(Candidate {
                index: idx,
                id: id.clone(),
                distance,
            })
        })
        .collect();

    if candidates.is_empty() {
        return None;
    }

    candidates.sort_by(|a, b| a.distance.total_cmp(&b.distance));
    candidates.truncate(NEARBY_LIMIT.min(candidates.len()));

    let mut total_weight = 0.0;
    let mut weighted = Vec::with_capacity(candidates.len());
    for candidate in candidates.iter() {
        let weight = 1.0 / candidate.distance.max(1.0);
        total_weight += weight;
        weighted.push((candidate, weight));
    }

    let mut roll = rng.next_f32() * total_weight.max(1.0);
    let mut chosen = weighted.last().map(|(c, _)| (*c).clone());
    for (candidate, weight) in weighted {
        roll -= weight;
        if roll <= 0.0 {
            chosen = Some(candidate.clone());
            break;
        }
    }

    let chosen = chosen?;
    let base_pos = [
        asteroid_positions[chosen.index * 3],
        asteroid_positions[chosen.index * 3 + 1],
        asteroid_positions[chosen.index * 3 + 2],
    ];
    let metadata = asteroid_metadata
        .get(chosen.index)
        .cloned()
        .unwrap_or_default();
    let (region, region_index) = pick_region(&metadata, rng);

    let mut destination = base_pos;
    let mut gravity_multiplier = metadata.gravity_multiplier.max(0.5);
    let mut region_id = None;

    if let Some(region_meta) = region {
        gravity_multiplier = region_meta.gravity_multiplier.max(0.5);
        destination[0] += region_meta.offset[0];
        destination[1] += region_meta.offset[1];
        destination[2] += region_meta.offset[2];
        region_id = Some(region_meta.id);
    }

    Some(AsteroidTarget {
        id: chosen.id,
        index: chosen.index,
        destination,
        region_id,
        region_index,
        gravity_multiplier,
    })
}

fn pick_region(
    metadata: &AsteroidMetadata,
    rng: &mut Mulberry32,
) -> (Option<AsteroidRegionMeta>, Option<usize>) {
    if metadata.regions.is_empty() {
        return (None, None);
    }

    let mut safe_regions: Vec<(usize, &AsteroidRegionMeta)> = metadata
        .regions
        .iter()
        .enumerate()
        .filter(|(_, region)| region.hazard_severity.as_deref() != Some("high"))
        .collect();
    let pool: Vec<(usize, &AsteroidRegionMeta)> = if safe_regions.is_empty() {
        metadata.regions.iter().enumerate().collect()
    } else {
        safe_regions.drain(..).collect()
    };

    let mut total: f32 = 0.0;
    let mut weighted = Vec::with_capacity(pool.len());
    for (idx, region) in pool.into_iter() {
        let hazard_factor = if region.hazard_severity.as_deref() == Some("medium") {
            0.7
        } else {
            1.0
        };
        let weight = (region.weight.max(0.01)) * hazard_factor;
        total += weight;
        weighted.push((idx, region.clone(), weight));
    }

    if weighted.is_empty() {
        return (None, None);
    }

    let mut roll = rng.next_f32() * total.max(0.01);
    let mut chosen = weighted.last().cloned();
    for entry in weighted {
        roll -= entry.2;
        if roll <= 0.0 {
            chosen = Some(entry);
            break;
        }
    }

    match chosen {
        Some((idx, region, _)) => (Some(region), Some(idx)),
        None => (None, None),
    }
}

fn select_return_factory(
    drone_id: &str,
    current_factory_index: f32,
    position: [f32; 3],
    factories: &mut [FactorySnapshot],
    factory_positions: &[f32],
    rng: &mut Mulberry32,
) -> Option<FactoryAssignment> {
    if factories.is_empty() || factory_positions.is_empty() {
        return None;
    }

    if let Some((existing_idx, queue_pos)) = find_existing_queue(factories, drone_id) {
        let capacity = factories[existing_idx].docking_capacity.max(0) as usize;
        let destination = factory_position(factory_positions, existing_idx)?;
        let start_travel = queue_pos < capacity;
        return Some(FactoryAssignment {
            factory_index: existing_idx,
            factory_id: factories[existing_idx].id.clone(),
            destination,
            start_travel,
        });
    }

    if current_factory_index >= 0.0 {
        let idx = current_factory_index as usize;
        if let Some(factory) = factories.get_mut(idx) {
            if let Some(destination) = factory_position(factory_positions, idx) {
                let docking_result = dock_drone_at_factory(factory, drone_id);
                let capacity = factory.docking_capacity.max(0) as usize;
                let queue_pos =
                    find_queue_index(factory, drone_id).unwrap_or(factory.queued_drones.len());
                let start_travel = match docking_result {
                    DockingResult::Docking => true,
                    DockingResult::Queued => false,
                    DockingResult::Exists => queue_pos < capacity,
                };
                return Some(FactoryAssignment {
                    factory_index: idx,
                    factory_id: factory.id.clone(),
                    destination,
                    start_travel,
                });
            }
        }
    }

    let with_distances: Vec<_> = factories
        .iter()
        .enumerate()
        .filter_map(|(idx, factory)| {
            let destination = factory_position(factory_positions, idx)?;
            let dx = destination[0] - position[0];
            let dy = destination[1] - position[1];
            let dz = destination[2] - position[2];
            let distance = (dx * dx + dy * dy + dz * dz).sqrt();
            let queue_len = factory.queued_drones.len();
            let capacity = factory.docking_capacity.max(0) as usize;
            let occupied = queue_len.min(capacity);
            let available = capacity.saturating_sub(occupied);
            Some((idx, distance, available, queue_len))
        })
        .collect();

    if with_distances.is_empty() {
        return None;
    }

    let mut candidates: Vec<_> = with_distances
        .iter()
        .filter(|(_, _, available, _)| *available > 0)
        .cloned()
        .collect();

    let selection_idx = if !candidates.is_empty() {
        candidates.sort_by(|a, b| {
            let queue_cmp = a.3.cmp(&b.3);
            if queue_cmp == std::cmp::Ordering::Equal {
                a.1.total_cmp(&b.1)
            } else {
                queue_cmp
            }
        });
        let mut chosen = candidates[0].0;
        if candidates.len() > 1 && rng.next_f32() < FACTORY_VARIETY_CHANCE {
            let others = &candidates[1..];
            let weights: Vec<f32> = others.iter().map(|entry| 1.0 / entry.1.max(0.001)).collect();
            let total: f32 = weights.iter().sum();
            let mut roll = rng.next_f32() * total.max(0.001);
            for (i, entry) in others.iter().enumerate() {
                roll -= weights[i];
                if roll <= 0.0 {
                    chosen = entry.0;
                    break;
                }
            }
        }
        chosen
    } else {
        with_distances
            .iter()
            .cloned()
            .min_by(|a, b| {
                let queue_cmp = a.3.cmp(&b.3);
                if queue_cmp == std::cmp::Ordering::Equal {
                    a.1.total_cmp(&b.1)
                } else {
                    queue_cmp
                }
            })
            .map(|entry| entry.0)?
    };

    let destination = factory_position(factory_positions, selection_idx)?;
    let factory = factories.get_mut(selection_idx)?;
    let docking_result = dock_drone_at_factory(factory, drone_id);

    let capacity = factory.docking_capacity.max(0) as usize;
    let queue_pos = find_queue_index(factory, drone_id).unwrap_or(factory.queued_drones.len());
    let start_travel = match docking_result {
        DockingResult::Docking => true,
        DockingResult::Queued => false,
        DockingResult::Exists => queue_pos < capacity,
    };

    Some(FactoryAssignment {
        factory_index: selection_idx,
        factory_id: factory.id.clone(),
        destination,
        start_travel,
    })
}

fn find_existing_queue(factories: &[FactorySnapshot], drone_id: &str) -> Option<(usize, usize)> {
    factories
        .iter()
        .enumerate()
        .find_map(|(idx, factory)| find_queue_index(factory, drone_id).map(|pos| (idx, pos)))
}

fn find_queue_index(factory: &FactorySnapshot, drone_id: &str) -> Option<usize> {
    factory
        .queued_drones
        .iter()
        .position(|existing| existing == drone_id)
}

fn dock_drone_at_factory(factory: &mut FactorySnapshot, drone_id: &str) -> DockingResult {
    if factory.queued_drones.contains(&drone_id.to_string()) {
        return DockingResult::Exists;
    }
    factory.queued_drones.push(drone_id.to_string());
    let position = factory.queued_drones.len().saturating_sub(1);
    let capacity = factory.docking_capacity.max(0) as usize;
    if position < capacity {
        DockingResult::Docking
    } else {
        DockingResult::Queued
    }
}

fn build_travel_snapshot(
    from: [f32; 3],
    to: [f32; 3],
    path_seed: u32,
    base_speed: f32,
    sink_speed_multiplier: f32,
    gravity_multiplier: f32,
) -> TravelSnapshot {
    let dx = to[0] - from[0];
    let dy = to[1] - from[1];
    let dz = to[2] - from[2];
    let distance = (dx * dx + dy * dy + dz * dz).sqrt();
    let gravity = gravity_multiplier.max(0.5);
    let effective_speed = ((base_speed * sink_speed_multiplier) / gravity).max(1.0);
    let duration = (distance / effective_speed).max(0.1);

    TravelSnapshot {
        from,
        to,
        elapsed: 0.0,
        duration,
        control: compute_control_point(from, to, path_seed),
    }
}

fn compute_control_point(from: [f32; 3], to: [f32; 3], path_seed: u32) -> Option<[f32; 3]> {
    let mid = [(from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5, (from[2] + to[2]) * 0.5];
    let waypoint = compute_waypoint_with_offset(mid, path_seed, 0);
    clamp_perpendicular_offset(from, to, mid, waypoint)
}

fn compute_waypoint_with_offset(base: [f32; 3], seed: u32, index: u32) -> [f32; 3] {
    let mixed_seed = seed ^ ((index + 1) * SEED_MIX);
    let mut rng = Mulberry32::new(if mixed_seed == 0 { 1 } else { mixed_seed });
    let yaw = rng.next_range(0.0, PI * 2.0).unwrap_or(0.0);
    let pitch = rng
        .next_range(-FRAC_PI_5, FRAC_PI_5)
        .unwrap_or(0.0);
    let radius = rng.next_range(0.2, 1.0).unwrap_or(0.2);

    let (sin_pitch, cos_pitch) = pitch.sin_cos();
    let (sin_yaw, cos_yaw) = yaw.sin_cos();
    [
        base[0] + cos_pitch * cos_yaw * radius,
        base[1] + sin_pitch * radius,
        base[2] + cos_pitch * sin_yaw * radius,
    ]
}

fn clamp_perpendicular_offset(
    from: [f32; 3],
    to: [f32; 3],
    mid: [f32; 3],
    waypoint: [f32; 3],
) -> Option<[f32; 3]> {
    let mut offset = [waypoint[0] - mid[0], waypoint[1] - mid[1], waypoint[2] - mid[2]];
    let mut direction = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    let dir_len_sq =
        direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
    if dir_len_sq < EPSILON {
        return None;
    }
    let dir_len = dir_len_sq.sqrt();
    direction[0] /= dir_len;
    direction[1] /= dir_len;
    direction[2] /= dir_len;

    let parallel = offset[0] * direction[0] + offset[1] * direction[1] + offset[2] * direction[2];
    offset[0] -= direction[0] * parallel;
    offset[1] -= direction[1] * parallel;
    offset[2] -= direction[2] * parallel;

    let offset_len_sq = offset[0] * offset[0] + offset[1] * offset[1] + offset[2] * offset[2];
    if offset_len_sq < EPSILON {
        return None;
    }
    let offset_len = offset_len_sq.sqrt();
    let clamp_max = (dir_len * 0.25).min(MAX_OFFSET_DISTANCE).max(0.5);
    let clamp_scale = (clamp_max / offset_len).min(1.0);
    offset[0] *= clamp_scale;
    offset[1] *= clamp_scale;
    offset[2] *= clamp_scale;

    Some([mid[0] + offset[0], mid[1] + offset[1], mid[2] + offset[2]])
}

fn factory_position(factory_positions: &[f32], idx: usize) -> Option<[f32; 3]> {
    let base = idx.checked_mul(3)?;
    if base + 2 >= factory_positions.len() {
        return None;
    }
    Some([
        factory_positions[base],
        factory_positions[base + 1],
        factory_positions[base + 2],
    ])
}

fn resolve_factory_id(
    factory_id_to_index: &BTreeMap<String, usize>,
    owner_index_buffer: &[f32],
    drone_idx: usize,
) -> Option<String> {
    let owner_idx = *owner_index_buffer.get(drone_idx)? as usize;
    factory_id_to_index
        .iter()
        .find_map(|(id, &idx)| if idx == owner_idx { Some(id.clone()) } else { None })
}

fn next_path_seed(rng: &mut Mulberry32) -> u32 {
    let sample = (rng.next_u32().wrapping_sub(1)) & 0x7fff_ffff;
    if sample == 0 { 1 } else { sample }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{FactorySnapshot, Resources};

    #[test]
    fn parses_asteroid_metadata() {
        let mut snapshot = SimulationSnapshot {
            resources: Resources {
                ore: 0.0,
                ice: 0.0,
                metals: 0.0,
                crystals: 0.0,
                organics: 0.0,
                bars: 0.0,
                energy: 0.0,
                credits: 0.0,
            },
            modules: Modules {
                drone_bay: 1,
                refinery: 1,
                storage: 0,
                solar: 0,
                scanner: 0,
                hauler_depot: 0,
                logistics_hub: 0,
                routing_protocol: 0,
            },
            prestige: crate::schema::Prestige { cores: 0 },
            save: crate::schema::SaveMeta {
                last_save: 0,
                version: "0.0.0".to_string(),
            },
            settings: crate::schema::StoreSettings {
                autosave_enabled: true,
                autosave_interval: 30,
                offline_cap_hours: 8,
                notation: "standard".to_string(),
                throttle_floor: 0.2,
                show_trails: false,
                show_hauler_ships: false,
                show_debug_panel: false,
                performance_profile: "high".to_string(),
                inspector_collapsed: false,
                metrics: crate::schema::MetricsSettings {
                    enabled: true,
                    interval_seconds: 5,
                    retention_seconds: 300,
                },
            },
            rng_seed: Some(1),
            drone_flights: vec![],
            factories: vec![],
            selected_factory_id: None,
            drone_owners: BTreeMap::new(),
            logistics_queues: None,
            spec_techs: None,
            spec_tech_spent: None,
            prestige_investments: None,
            game_time: 0.0,
            extra: BTreeMap::new(),
            schema_version: crate::schema::SCHEMA_VERSION.to_string(),
        };

        snapshot.extra.insert(
            "asteroids".to_string(),
            serde_json::json!([
                {
                    "id": "a1",
                    "gravityMultiplier": 1.5,
                    "regions": [
                        {
                            "id": "r1",
                            "weight": 2,
                            "gravityMultiplier": 0.8,
                            "offset": [1, 2, 3],
                            "hazard": { "severity": "medium" }
                        }
                    ]
                }
            ]),
        );

        let mut map = BTreeMap::new();
        map.insert("a1".to_string(), 0);
        let metadata = extract_asteroid_metadata(&snapshot, &map);
        assert_eq!(metadata.len(), 1);
        assert!((metadata[0].gravity_multiplier - 1.5).abs() < 1e-6);
        assert_eq!(metadata[0].regions.len(), 1);
        assert_eq!(metadata[0].regions[0].id, "r1");
        assert_eq!(metadata[0].regions[0].offset, [1.0, 2.0, 3.0]);
        assert_eq!(metadata[0].regions[0].hazard_severity.as_deref(), Some("medium"));
    }

    #[test]
    fn assigns_return_factory_and_queue() {
        let mut drone_flights = vec![];
        let mut drone_states = vec![DRONE_STATE_RETURNING];
        let drone_cargo = vec![10.0];
        let drone_positions = vec![5.0, 0.0, 0.0];
        let drone_battery = vec![5.0];
        let mut drone_max_battery = vec![0.0];
        let mut drone_capacity = vec![0.0];
        let mut drone_mining_rate = vec![0.0];
        let mut drone_target_asteroid_index = vec![0.0];
        let mut drone_target_factory_index = vec![TARGET_INDEX_NONE];
        let mut drone_target_region_index = vec![TARGET_INDEX_NONE];
        let drone_owner_factory_index = vec![0.0];
        let drone_ids = vec!["d1".to_string()];

        let mut drone_id_to_index = BTreeMap::new();
        drone_id_to_index.insert("d1".to_string(), 0);
        let mut factory_id_to_index = BTreeMap::new();
        factory_id_to_index.insert("f1".to_string(), 0);
        let asteroid_id_to_index = BTreeMap::new();

        let mut factories = vec![FactorySnapshot {
            id: "f1".to_string(),
            position: [0.0, 0.0, 0.0],
            docking_capacity: 1,
            refine_slots: 0,
            idle_energy_per_sec: 0.0,
            energy_per_refine: 0.0,
            storage_capacity: 0.0,
            current_storage: 0.0,
            queued_drones: vec![],
            pinned: false,
            energy: 0.0,
            energy_capacity: 0.0,
            resources: Default::default(),
            upgrades: Default::default(),
            haulers_assigned: None,
            hauler_config: None,
            hauler_upgrades: None,
            logistics_state: None,
        }];

        let factory_positions = vec![0.0, 0.0, 0.0];
        let asteroid_positions = vec![];
        let asteroid_metadata = vec![];
        let asteroid_ore = vec![];

        let mut rng = Mulberry32::new(1);
        let modifiers = crate::modifiers::get_resource_modifiers(
            &Resources {
                ore: 0.0,
                ice: 0.0,
                metals: 0.0,
                crystals: 0.0,
                organics: 0.0,
                bars: 0.0,
                energy: 0.0,
                credits: 0.0,
            },
            0,
            None,
            None,
        );
        let modules = Modules {
            drone_bay: 1,
            refinery: 0,
            storage: 0,
            solar: 0,
            scanner: 0,
            hauler_depot: 0,
            logistics_hub: 0,
            routing_protocol: 0,
        };
        let sink_bonuses = SinkBonuses {
            ore_yield_multiplier: 1.0,
            drone_speed_multiplier: 1.0,
            asteroid_richness_multiplier: 1.0,
            asteroid_spawn_multiplier: 1.0,
            refinery_yield_multiplier: 1.0,
            offline_progress_multiplier: 1.0,
        };

        sys_drone_ai(
            &mut drone_flights,
            &mut drone_states,
            &drone_cargo,
            &drone_positions,
            &drone_battery,
            &mut drone_max_battery,
            &mut drone_capacity,
            &mut drone_mining_rate,
            &mut drone_target_asteroid_index,
            &mut drone_target_factory_index,
            &mut drone_target_region_index,
            &drone_owner_factory_index,
            &drone_ids,
            &drone_id_to_index,
            &factory_id_to_index,
            &asteroid_id_to_index,
            &mut factories,
            &factory_positions,
            &asteroid_positions,
            &asteroid_metadata,
            &asteroid_ore,
            &mut rng,
            &modifiers,
            &modules,
            &sink_bonuses,
        );

        assert_eq!(drone_states[0], DRONE_STATE_RETURNING);
        assert_eq!(drone_target_factory_index[0], 0.0);
        assert_eq!(factories[0].queued_drones, vec!["d1".to_string()]);
        assert_eq!(drone_flights.len(), 1);
        assert_eq!(drone_flights[0].target_factory_id, Some("f1".to_string()));
    }

    #[test]
    fn travel_snapshot_varies_with_seed() {
        let from = [0.0, 0.0, 0.0];
        let to = [10.0, 0.0, 0.0];
        let travel_a = build_travel_snapshot(from, to, 1, 10.0, 1.0, 1.0);
        let travel_b = build_travel_snapshot(from, to, 2, 10.0, 1.0, 1.0);
        assert!(travel_a.control.is_some());
        assert!(travel_b.control.is_some());
        assert_ne!(travel_a.control, travel_b.control);
        assert!(travel_a.duration > 0.0);
    }
}
