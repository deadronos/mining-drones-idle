use crate::constants::{
    DRONE_MAX_BATTERY, DRONE_MAX_CARGO, DRONE_MINING_RATE, DRONE_SPEED, DRONE_STATE_IDLE,
    DRONE_STATE_MINING, DRONE_STATE_RETURNING, DRONE_STATE_TO_ASTEROID,
};
use crate::modifiers::ResourceModifierSnapshot;
use crate::rng::Mulberry32;
use crate::schema::{DroneFlight, TravelSnapshot};
use std::collections::BTreeMap;

pub fn sys_drone_ai(
    drone_flights: &mut Vec<DroneFlight>,
    drone_states: &mut [f32],
    drone_cargo: &[f32],
    drone_positions: &[f32],
    drone_battery: &[f32],
    drone_max_battery: &mut [f32],
    drone_capacity: &mut [f32],
    drone_mining_rate: &mut [f32],
    _drone_target_asteroid_index: &mut [f32], // New
    _drone_target_factory_index: &mut [f32],  // New
    drone_id_to_index: &BTreeMap<String, usize>,
    factory_id_to_index: &BTreeMap<String, usize>,
    asteroid_id_to_index: &BTreeMap<String, usize>,
    factory_positions: &[f32],
    asteroid_positions: &[f32],
    asteroid_ore: &[f32],
    rng: &mut Mulberry32,
    modifiers: &ResourceModifierSnapshot,
) {
    // We need to iterate over all drones to check their state and make decisions.
    // However, we only have SoA data and a map.
    // We can iterate the map to get IDs and indices.

    // We also need to know which drones already have active flights.
    // We can build a set of active drone IDs.
    let mut active_drones = std::collections::HashSet::new();
    for flight in drone_flights.iter() {
        active_drones.insert(flight.drone_id.clone());
    }

    // Collect new flights to add
    let mut new_flights = Vec::new();

    for (drone_id, &drone_idx) in drone_id_to_index.iter() {
        if active_drones.contains(drone_id) {
            continue;
        }

        let state = drone_states[drone_idx];
        let position = [
            drone_positions[drone_idx * 3],
            drone_positions[drone_idx * 3 + 1],
            drone_positions[drone_idx * 3 + 2],
        ];

        // Calculate stats based on modifiers
        let speed = DRONE_SPEED; // TODO: Add speed modifier
        let capacity = DRONE_MAX_CARGO * modifiers.drone_capacity_multiplier;
        let max_battery = DRONE_MAX_BATTERY * modifiers.drone_battery_multiplier;
        let mining_rate = DRONE_MINING_RATE; // TODO: Add mining rate modifier

        // Update SoA with current stats
        drone_capacity[drone_idx] = capacity;
        drone_max_battery[drone_idx] = max_battery;
        drone_mining_rate[drone_idx] = mining_rate;

        if state == DRONE_STATE_IDLE {
            // Find target asteroid
            // Simple logic: pick random asteroid with ore > 0
            // TODO: Spatial query or smarter selection
            let asteroid_count = asteroid_positions.len() / 3;
            if asteroid_count > 0 {
                // Try 5 times to find valid asteroid
                for _ in 0..5 {
                    let idx = (rng.next_u32() as usize) % asteroid_count;
                    if asteroid_ore[idx] > 0.0 {
                        // Found one
                        // Find ID
                        let target_id = asteroid_id_to_index
                            .iter()
                            .find(|&(_, &v)| v == idx)
                            .map(|(k, _)| k.clone());

                        if let Some(target_id) = target_id {
                            let target_pos = [
                                asteroid_positions[idx * 3],
                                asteroid_positions[idx * 3 + 1],
                                asteroid_positions[idx * 3 + 2],
                            ];

                            // Create flight
                            let dist = distance(position, target_pos);
                            let duration = dist / speed;

                            new_flights.push(DroneFlight {
                                drone_id: drone_id.clone(),
                                state: "toAsteroid".to_string(),
                                target_asteroid_id: Some(target_id),
                                target_region_id: None,
                                target_factory_id: None,
                                owner_factory_id: None, // TODO: Get from SoA
                                path_seed: rng.next_u32(),
                                travel: TravelSnapshot {
                                    from: position,
                                    to: target_pos,
                                    elapsed: 0.0,
                                    duration,
                                    control: None, // TODO: Bezier
                                },
                                cargo: 0.0,
                                battery: drone_battery[drone_idx],
                                max_battery,
                                capacity,
                                mining_rate,
                                cargo_profile: None,
                                charging: false,
                            });

                            // Update state immediately to prevent double assignment
                            drone_states[drone_idx] = DRONE_STATE_TO_ASTEROID;
                            break;
                        }
                    }
                }
            }
        } else if state == DRONE_STATE_MINING || state == DRONE_STATE_RETURNING {
            let cargo = drone_cargo[drone_idx];
            if state == DRONE_STATE_RETURNING || cargo >= capacity {
                // Full, return to factory
                // Find nearest factory
                // For now, just pick first factory
                if !factory_positions.is_empty() {
                    let factory_idx = 0; // TODO: Find nearest
                    let target_pos = [
                        factory_positions[factory_idx * 3],
                        factory_positions[factory_idx * 3 + 1],
                        factory_positions[factory_idx * 3 + 2],
                    ];

                    // Find ID
                    let target_id = factory_id_to_index
                        .iter()
                        .find(|&(_, &v)| v == factory_idx)
                        .map(|(k, _)| k.clone());

                    if let Some(target_id) = target_id {
                        let dist = distance(position, target_pos);
                        let duration = dist / speed;

                        new_flights.push(DroneFlight {
                            drone_id: drone_id.clone(),
                            state: "returning".to_string(),
                            target_asteroid_id: None,
                            target_region_id: None,
                            target_factory_id: Some(target_id),
                            owner_factory_id: None,
                            path_seed: rng.next_u32(),
                            travel: TravelSnapshot {
                                from: position,
                                to: target_pos,
                                elapsed: 0.0,
                                duration,
                                control: None,
                            },
                            cargo,
                            battery: drone_battery[drone_idx],
                            max_battery,
                            capacity,
                            mining_rate,
                            cargo_profile: None,
                            charging: false,
                        });

                        drone_states[drone_idx] = DRONE_STATE_RETURNING;
                    }
                }
            }
        }
    }

    drone_flights.extend(new_flights);
}

fn distance(a: [f32; 3], b: [f32; 3]) -> f32 {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    let dz = a[2] - b[2];
    (dx * dx + dy * dy + dz * dz).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::Resources;

    #[test]
    fn test_drone_ai_returning_state() {
        let mut drone_flights = vec![];
        let mut drone_states = vec![DRONE_STATE_RETURNING];
        let drone_cargo = vec![10.0];
        let drone_positions = vec![10.0, 0.0, 0.0];
        let drone_battery = vec![100.0];
        let mut drone_max_battery = vec![100.0];
        let mut drone_capacity = vec![40.0];
        let mut drone_mining_rate = vec![1.0];
        let mut drone_target_asteroid_index = vec![-1.0];
        let mut drone_target_factory_index = vec![-1.0];

        let mut drone_id_to_index = BTreeMap::new();
        drone_id_to_index.insert("d1".to_string(), 0);

        let mut factory_id_to_index = BTreeMap::new();
        factory_id_to_index.insert("f1".to_string(), 0);

        let asteroid_id_to_index = BTreeMap::new();

        let factory_positions = vec![0.0, 0.0, 0.0];
        let asteroid_positions = vec![];
        let asteroid_ore = vec![];

        let mut rng = Mulberry32::new(1);
        let modifiers = crate::modifiers::get_resource_modifiers(&Resources {
            ore: 0.0,
            ice: 0.0,
            metals: 0.0,
            crystals: 0.0,
            organics: 0.0,
            bars: 0.0,
            energy: 0.0,
            credits: 0.0,
        }, 0);

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
            &drone_id_to_index,
            &factory_id_to_index,
            &asteroid_id_to_index,
            &factory_positions,
            &asteroid_positions,
            &asteroid_ore,
            &mut rng,
            &modifiers,
        );

        assert_eq!(drone_flights.len(), 1);
        assert_eq!(drone_flights[0].state, "returning");
        assert_eq!(drone_flights[0].target_factory_id, Some("f1".to_string()));
    }
}
