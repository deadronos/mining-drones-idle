use crate::constants::{DRONE_STATE_IDLE, DRONE_STATE_UNLOADING};
use crate::schema::Resources;

pub fn sys_unload(
    drone_states: &mut [f32],
    drone_cargo: &mut [f32],
    drone_cargo_profile: &mut [f32],
    drone_target_factory_index: &mut [f32],
    drone_owner_factory_index: &mut [f32],
    drone_positions: &mut [f32],
    factory_positions: &[f32],
    factory_resources: &mut [f32],
    global_resources: &mut Resources,
    _dt: f32,
) {
    let drone_count = drone_states.len();
    let factory_count = if !factory_resources.is_empty() { factory_resources.len() / 7 } else { 0 };

    for i in 0..drone_count {
        if drone_states[i] != DRONE_STATE_UNLOADING {
            continue;
        }

        let cargo = drone_cargo[i];

        // Determine target factory
        let target_idx = drone_target_factory_index[i];
        let mut factory_idx = if target_idx >= 0.0 {
            target_idx as usize
        } else {
            // Fallback to owner or 0
            let owner = drone_owner_factory_index[i];
            if owner >= 0.0 {
                owner as usize
            } else {
                0
            }
        };

        if factory_count > 0 && factory_idx >= factory_count {
            factory_idx = 0;
        }

        // Transfer cargo
        if cargo > 0.0 {
            let profile_base = i * 5;
            let ore = drone_cargo_profile[profile_base];
            let ice = drone_cargo_profile[profile_base + 1];
            let metals = drone_cargo_profile[profile_base + 2];
            let crystals = drone_cargo_profile[profile_base + 3];
            let organics = drone_cargo_profile[profile_base + 4];

            // Calculate remainder (ore) if profile doesn't sum to cargo
            let profile_sum = ore + ice + metals + crystals + organics;
            let remainder = (cargo - profile_sum).max(0.0);
            let total_ore = ore + remainder;

            if factory_count > 0 {
                let res_base = factory_idx * 7;
                factory_resources[res_base] += total_ore;
                factory_resources[res_base + 1] += ice;
                factory_resources[res_base + 2] += metals;
                factory_resources[res_base + 3] += crystals;
                factory_resources[res_base + 4] += organics;
            } else {
                global_resources.ore += total_ore;
                global_resources.ice += ice;
                global_resources.metals += metals;
                global_resources.crystals += crystals;
                global_resources.organics += organics;
            }
        }

        // Clear cargo
        drone_cargo[i] = 0.0;
        let profile_base = i * 5;
        drone_cargo_profile[profile_base] = 0.0;
        drone_cargo_profile[profile_base + 1] = 0.0;
        drone_cargo_profile[profile_base + 2] = 0.0;
        drone_cargo_profile[profile_base + 3] = 0.0;
        drone_cargo_profile[profile_base + 4] = 0.0;

        // Update state
        drone_states[i] = DRONE_STATE_IDLE;

        // Update owner
        drone_owner_factory_index[i] = factory_idx as f32;

        // Clear target
        drone_target_factory_index[i] = -1.0;

        // Snap position to factory
        if factory_count > 0 {
            let pos_base = factory_idx * 3;
            drone_positions[i * 3] = factory_positions[pos_base];
            drone_positions[i * 3 + 1] = factory_positions[pos_base + 1];
            drone_positions[i * 3 + 2] = factory_positions[pos_base + 2];
        }
    }
}
