use crate::constants::{
    DRONE_ENERGY_COST, DRONE_STATE_IDLE, DRONE_STATE_MINING, DRONE_STATE_RETURNING,
    DRONE_STATE_TO_ASTEROID, DRONE_STATE_UNLOADING,
};
use crate::schema::{DroneFlight, TravelSnapshot, Vector3};
use crate::systems::energy::consume_drone_energy;
use std::collections::BTreeMap;

const UNLOAD_ARRIVAL_DISTANCE: f32 = 1.0;
const TRAVEL_TIME_QUANTIZATION: f32 = 1000.0;

fn quantize_time(value: f32) -> f32 {
    ((value.max(0.0)) * TRAVEL_TIME_QUANTIZATION).round() / TRAVEL_TIME_QUANTIZATION
}

pub fn sys_movement(
    drone_flights: &mut Vec<DroneFlight>,
    drone_id_to_index: &BTreeMap<String, usize>,
    factory_id_to_index: &BTreeMap<String, usize>,
    asteroid_id_to_index: &BTreeMap<String, usize>,
    positions: &mut [f32],     // [x, y, z] * N
    states: &mut [f32],        // [state] * N
    battery: &mut [f32],       // [energy] * N
    target_asteroid_index: &mut [f32],  // [target_idx] * N
    target_factory_index: &mut [f32],   // [target_idx] * N
    factory_positions: &[f32], // [x, y, z] * M
    dt: f32,
    throttle_floor: f32,
    energy_drain_multiplier: f32,
) {
    if dt <= 0.0 {
        return;
    }
    let drain_rate = DRONE_ENERGY_COST * energy_drain_multiplier;

    let mut finished_indices = Vec::new();

    for (i, flight) in drone_flights.iter_mut().enumerate() {
        let drone_idx = match drone_id_to_index.get(&flight.drone_id) {
            Some(&idx) => idx,
            None => continue,
        };

        // Update state in SoA
        let state_val = match flight.state.as_str() {
            "toAsteroid" => DRONE_STATE_TO_ASTEROID,
            "returning" => DRONE_STATE_RETURNING,
            "mining" => DRONE_STATE_MINING,
            "unloading" => DRONE_STATE_UNLOADING,
            _ => DRONE_STATE_IDLE,
        };
        states[drone_idx] = state_val;

        let travel = &mut flight.travel;
        if travel.duration <= 0.0 {
            finished_indices.push(i);
            continue;
        }

        // Energy
        let consumption = consume_drone_energy(
            &mut battery[drone_idx],
            flight.max_battery,
            dt,
            throttle_floor,
            drain_rate,
        );

        let new_elapsed = (travel.elapsed + dt * consumption.fraction).min(travel.duration);
        travel.elapsed = quantize_time(new_elapsed);

        // Compute position
        let pos = compute_travel_position(travel);

        // Update SoA
        positions[drone_idx * 3] = pos[0];
        positions[drone_idx * 3 + 1] = pos[1];
        positions[drone_idx * 3 + 2] = pos[2];

        // Check arrival
        let mut arrived = false;

        // 1. Position-based (if returning to factory)
        if flight.state == "returning" {
            if let Some(factory_id) = &flight.target_factory_id {
                if let Some(&factory_idx) = factory_id_to_index.get(factory_id) {
                    // Update target_factory_index
                    target_factory_index[drone_idx] = factory_idx as f32;

                    let fx = factory_positions[factory_idx * 3];
                    let fy = factory_positions[factory_idx * 3 + 1];
                    let fz = factory_positions[factory_idx * 3 + 2];

                    let dx = pos[0] - fx;
                    let dy = pos[1] - fy;
                    let dz = pos[2] - fz;
                    let dist_sq = dx * dx + dy * dy + dz * dz;

                    if dist_sq < UNLOAD_ARRIVAL_DISTANCE * UNLOAD_ARRIVAL_DISTANCE {
                        arrived = true;
                        // Snap to factory position
                        positions[drone_idx * 3] = fx;
                        positions[drone_idx * 3 + 1] = fy;
                        positions[drone_idx * 3 + 2] = fz;
                    }
                }
            }
        }

        // 2. Time-based trigger
        if !arrived && travel.elapsed >= travel.duration - 1e-4 {
            arrived = true;
            // Snap to target
            positions[drone_idx * 3] = travel.to[0];
            positions[drone_idx * 3 + 1] = travel.to[1];
            positions[drone_idx * 3 + 2] = travel.to[2];
        }

        if arrived {
            // Update state to next state
            let next_state = if flight.state == "toAsteroid" {
                if let Some(asteroid_id) = &flight.target_asteroid_id {
                    if let Some(&idx) = asteroid_id_to_index.get(asteroid_id) {
                        target_asteroid_index[drone_idx] = idx as f32;
                    }
                }
                DRONE_STATE_MINING
            } else if flight.state == "returning" {
                DRONE_STATE_UNLOADING
            } else {
                DRONE_STATE_IDLE
            };
            states[drone_idx] = next_state;

            finished_indices.push(i);
        }
    }

    // Remove finished flights
    // Iterate in reverse to remove
    for idx in finished_indices.iter().rev() {
        drone_flights.remove(*idx);
    }
}

fn compute_travel_position(travel: &TravelSnapshot) -> Vector3 {
    let duration = if travel.duration > 0.0 {
        travel.duration
    } else {
        1.0
    };
    let t = (travel.elapsed / duration).clamp(0.0, 1.0);

    if let Some(control) = travel.control {
        let one_minus_t = 1.0 - t;
        let a = one_minus_t * one_minus_t;
        let b = 2.0 * one_minus_t * t;
        let c = t * t;

        [
            travel.from[0] * a + control[0] * b + travel.to[0] * c,
            travel.from[1] * a + control[1] * b + travel.to[1] * c,
            travel.from[2] * a + control[2] * b + travel.to[2] * c,
        ]
    } else {
        // Lerp
        [
            travel.from[0] + (travel.to[0] - travel.from[0]) * t,
            travel.from[1] + (travel.to[1] - travel.from[1]) * t,
            travel.from[2] + (travel.to[2] - travel.from[2]) * t,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_movement_linear() {
        let mut flights = vec![DroneFlight {
            drone_id: "d1".to_string(),
            state: "toAsteroid".to_string(),
            target_asteroid_id: None,
            target_region_id: None,
            target_factory_id: None,
            owner_factory_id: None,
            path_seed: 0,
            travel: TravelSnapshot {
                from: [0.0, 0.0, 0.0],
                to: [10.0, 0.0, 0.0],
                elapsed: 0.0,
                duration: 10.0,
                control: None,
            },
            cargo: 0.0,
            battery: 100.0,
            max_battery: 100.0,
            capacity: 40.0,
            mining_rate: 1.0,
            cargo_profile: None,
            charging: false,
        }];
        let mut drone_map = BTreeMap::new();
        drone_map.insert("d1".to_string(), 0);
        let factory_map = BTreeMap::new();
        let mut positions = vec![0.0, 0.0, 0.0];
        let mut battery = vec![100.0];
        let mut states = vec![0.0];
        let mut target_asteroid_index = vec![0.0];
        let mut target_factory_index = vec![0.0];
        let factory_positions = vec![];
        let asteroid_map = BTreeMap::new();

        sys_movement(
            &mut flights,
            &drone_map,
            &factory_map,
            &asteroid_map,
            &mut positions,
            &mut states,
            &mut battery,
            &mut target_asteroid_index,
            &mut target_factory_index,
            &factory_positions,
            1.0,
            0.0,
            1.0,
        );

        assert_eq!(flights.len(), 1);
        assert!(flights[0].travel.elapsed > 0.0);
        assert!(positions[0] > 0.0);
        assert!(positions[0] < 10.0);
    }
}
