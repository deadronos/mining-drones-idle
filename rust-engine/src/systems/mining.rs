use crate::constants::*;
use crate::schema::Modules;

pub fn sys_mining(
    drone_states: &mut [f32],
    drone_cargo: &mut [f32],
    drone_target_index: &[f32],
    _asteroid_max_ore: &[f32],
    modules: &Modules,
    dt: f32,
    mining_multiplier: f32,
) {
    if dt <= 0.0 {
        return;
    }

    // Base mining rate
    // TODO: Balance this.
    let base_rate = 5.0;
    let rate = base_rate * (1.0 + (modules.drone_bay as f32) * 0.1) * mining_multiplier;

    let drone_count = drone_states.len();
    for i in 0..drone_count {
        let state = drone_states[i];
        if state == DRONE_STATE_MINING {
            let _target_idx = drone_target_index[i] as usize;
            // We can use target_idx to check asteroid properties if needed.

            let current_cargo = drone_cargo[i];
            if current_cargo < DRONE_MAX_CARGO {
                let space = DRONE_MAX_CARGO - current_cargo;
                let mined = (rate * dt).min(space);
                drone_cargo[i] += mined;
            } else {
                // Full.
                // Ideally we switch state or trigger return.
                // For now, just stay full.
            }
        }
    }
}
