use crate::constants::{DRONE_STATE_IDLE, DRONE_STATE_UNLOADING};
use crate::schema::Resources;
use std::collections::BTreeMap;

pub fn sys_unload(
    drone_states: &mut [f32],
    drone_cargo: &mut [f32],
    drone_owners: &BTreeMap<String, Option<String>>,
    drone_id_to_index: &BTreeMap<String, usize>,
    factory_id_to_index: &BTreeMap<String, usize>,
    factory_resources: &mut [f32], // [ore, ice, metals, crystals, organics, bars, credits] * N
    global_resources: &mut Resources,
    dt: f32,
) {
    if dt <= 0.0 {
        return;
    }

    // Iterate all drones
    for (drone_id, &drone_idx) in drone_id_to_index.iter() {
        let owner_id_opt = drone_owners.get(drone_id).and_then(|opt| opt.as_ref());

        let state = drone_states[drone_idx];
        if state != DRONE_STATE_UNLOADING {
            continue;
        }

        let cargo = drone_cargo[drone_idx];
        if cargo <= 0.0 {
            // Already empty, switch to IDLE
            drone_states[drone_idx] = DRONE_STATE_IDLE;
            continue;
        }

        // Transfer cargo
        // In TS, this is instant or per-frame.
        // We'll do instant transfer for now to match TS behavior in createUnloadSystem
        // which transfers all cargo at once when state is 'unloading'.

        // Find target factory
        // In Rust, we don't track targetFactoryId in SoA yet, but we have owner_id_opt.
        // If owner_id is set, we unload there. If not, we unload to first factory or global.

        let mut unloaded = false;

        if let Some(owner_id) = owner_id_opt {
            if let Some(&factory_idx) = factory_id_to_index.get(owner_id) {
                // Transfer to factory
                // Factory resources layout: [ore, ice, metals, crystals, organics, bars, credits]
                // Drone cargo is generic "cargo" in Rust for now, assuming Ore.
                // TODO: Support cargo profile in Rust. For now, assume Ore.
                let res_idx = factory_idx * 7;
                factory_resources[res_idx] += cargo;
                unloaded = true;
            }
        }

        if !unloaded {
            // Fallback to first factory
            if !factory_resources.is_empty() {
                factory_resources[0] += cargo;
                unloaded = true;
            } else {
                // Fallback to global resources
                global_resources.ore += cargo;
                unloaded = true;
            }
        }

        if unloaded {
            drone_cargo[drone_idx] = 0.0;
            drone_states[drone_idx] = DRONE_STATE_IDLE;
        }
    }
}
