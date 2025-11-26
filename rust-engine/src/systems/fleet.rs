use crate::constants::{
    DRONE_MAX_BATTERY, DRONE_MAX_CARGO, DRONE_MINING_RATE, DRONE_SPEED,
};
use crate::modifiers::ResourceModifierSnapshot;
use crate::schema::Modules;

pub fn sys_fleet(
    battery: &mut [f32],
    max_battery: &mut [f32],
    capacity: &mut [f32],
    mining_rate: &mut [f32],
    cargo: &mut [f32],
    cargo_profile: &mut [f32], // 5 floats per drone
    modules: &Modules,
    modifiers: &ResourceModifierSnapshot,
) {
    let drone_count = battery.len();

    // Calculate base stats
    let speed_bonus = 1.0 + (modules.drone_bay as f32 - 1.0).max(0.0) * 0.05;
    let _base_speed = DRONE_SPEED * speed_bonus;
    // let target_speed = base_speed * modifiers.drone_production_speed_multiplier;

    let capacity_base = DRONE_MAX_CARGO + (modules.storage as f32) * 5.0;
    let target_capacity = capacity_base * modifiers.drone_capacity_multiplier;

    let mining_base = DRONE_MINING_RATE + (modules.refinery as f32) * 0.5;
    let target_mining_rate = mining_base * modifiers.drone_production_speed_multiplier;

    let target_max_battery = DRONE_MAX_BATTERY * modifiers.drone_battery_multiplier;

    for i in 0..drone_count {
        // Update capacity
        if cargo[i] > target_capacity {
            let scale = if target_capacity > 0.0 { target_capacity / cargo[i] } else { 0.0 };
            if scale <= 0.0 {
                cargo[i] = 0.0;
                for j in 0..5 {
                    cargo_profile[i * 5 + j] = 0.0;
                }
            } else {
                cargo[i] = target_capacity;
                for j in 0..5 {
                    cargo_profile[i * 5 + j] *= scale;
                }
            }
        }
        capacity[i] = target_capacity;

        // Update mining rate
        mining_rate[i] = target_mining_rate;

        // Update battery
        let was_uninitialized = max_battery[i] == 0.0;
        let previous_max = if !was_uninitialized { max_battery[i] } else { DRONE_MAX_BATTERY };
        let fraction = if previous_max > 0.0 { battery[i] / previous_max } else { 0.0 };

        max_battery[i] = target_max_battery;

        if was_uninitialized {
            battery[i] = target_max_battery;
        } else {
            // Scale battery to new max, preserving percentage
            battery[i] = (fraction * target_max_battery).min(target_max_battery).max(0.0);
        }
    }
}
