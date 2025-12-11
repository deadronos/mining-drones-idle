use crate::constants::*;
use crate::systems::energy::consume_drone_energy;

const ORE_QUANTIZATION: f32 = 100.0; // 0.01-unit steps

fn quantize_ore(value: f32) -> f32 {
    let scaled = (value * ORE_QUANTIZATION).round();
    (scaled / ORE_QUANTIZATION).max(0.0)
}

pub fn sys_mining(
    drone_states: &mut [f32],
    drone_cargo: &mut [f32],
    drone_cargo_profile: &mut [f32],
    drone_target_asteroid_index: &[f32],
    drone_capacity: &[f32],
    drone_mining_rate: &[f32],
    drone_battery: &mut [f32],
    drone_max_battery: &[f32],
    asteroid_ore_remaining: &mut [f32],
    asteroid_resource_profile: &[f32],
    dt: f32,
    throttle_floor: f32,
    energy_drain_multiplier: f32,
    ore_yield_multiplier: f32,
) {
    if dt <= 0.0 {
        return;
    }

    let drain_rate = DRONE_ENERGY_COST * energy_drain_multiplier;
    let drone_count = drone_states.len();

    for i in 0..drone_count {
        let state = drone_states[i];
        if state != DRONE_STATE_MINING {
            continue;
        }

        let target_idx = drone_target_asteroid_index[i];
        if target_idx < 0.0 {
            drone_states[i] = DRONE_STATE_RETURNING;
            continue;
        }
        let asteroid_idx = target_idx as usize;

        if asteroid_idx >= asteroid_ore_remaining.len() {
             drone_states[i] = DRONE_STATE_RETURNING;
             continue;
        }

        let capacity = drone_capacity[i];
        let current_cargo = drone_cargo[i];
        let capacity_left = (capacity - current_cargo).max(0.0);

        if capacity_left <= 0.0 {
            drone_states[i] = DRONE_STATE_RETURNING;
            continue;
        }

        let fraction = consume_drone_energy(
            &mut drone_battery[i],
            drone_max_battery[i],
            dt,
            throttle_floor,
            drain_rate,
        );

        if fraction.fraction <= 0.0 {
            continue;
        }

        let base_extraction = drone_mining_rate[i] * fraction.fraction * dt;
        let boosted_extraction = base_extraction * ore_yield_multiplier;
        let ore_remaining = asteroid_ore_remaining[asteroid_idx];
        let mined = boosted_extraction.min(capacity_left).min(ore_remaining);

        if mined <= 0.0 {
            drone_states[i] = DRONE_STATE_RETURNING;
            continue;
        }

        let profile_offset = asteroid_idx * 5;
        let drone_profile_offset = i * 5;

        for j in 0..5 {
            let share = mined * asteroid_resource_profile[profile_offset + j];
            if share > 0.0 {
                drone_cargo_profile[drone_profile_offset + j] += share;
            }
        }

        drone_cargo[i] += mined;
        asteroid_ore_remaining[asteroid_idx] =
            quantize_ore(asteroid_ore_remaining[asteroid_idx] - mined);

        if drone_cargo[i] >= capacity - 0.01 || asteroid_ore_remaining[asteroid_idx] <= 0.01 {
            drone_states[i] = DRONE_STATE_RETURNING;
        }
    }
}
