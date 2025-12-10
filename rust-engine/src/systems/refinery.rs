use crate::buffers::MAX_REFINE_SLOTS;
use crate::constants::*;

pub fn sys_refinery(
    resources: &mut [f32],      // [ore, bars, metals, crystals, organics, ice, credits] * N
    upgrades: &[f32],           // [docking, refine, storage, energy, solar] * N
    refinery_state: &mut [f32], // [active, amount, progress, speed] * MAX_REFINE_SLOTS * N
    haulers_assigned: &[f32],   // [count] * N
    energy: &mut [f32],         // [energy] * N
    dt: f32,
    energy_drain_multiplier: f32,
    storage_capacity_multiplier: f32,
    production_speed_multiplier: f32,
    refinery_yield_multiplier: f32,
) {
    let factory_count = energy.len();
    let stride_res = 7;
    let stride_upg = 5;
    let stride_ref = MAX_REFINE_SLOTS * 4;

    for i in 0..factory_count {
        let res_idx = i * stride_res;
        let upg_idx = i * stride_upg;
        let ref_idx = i * stride_ref;

        let mut current_energy = energy[i];
        let refine_level = upgrades[upg_idx + 1] as i32;
        let storage_level = upgrades[upg_idx + 2] as i32;
        let energy_level = upgrades[upg_idx + 3] as i32;
        let solar_level = upgrades[upg_idx + 4] as i32;
        let hauler_count = haulers_assigned[i];

        let refine_slots = (FACTORY_REFINE_SLOTS as i32 + refine_level) as usize;
        let storage_capacity = (FACTORY_STORAGE_CAPACITY + (storage_level as f32 * 150.0)) * storage_capacity_multiplier;
        let energy_capacity = FACTORY_ENERGY_CAPACITY
            + (energy_level as f32 * 30.0)
            + (solar_level as f32 * FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL);

        // Idle drain
        let idle_drain = FACTORY_IDLE_ENERGY_PER_SEC * dt * energy_drain_multiplier;
        current_energy = (current_energy - idle_drain).max(0.0);

        // Hauler drain
        let hauler_drain = hauler_count * 0.5 * dt * energy_drain_multiplier;
        current_energy = (current_energy - hauler_drain).max(0.0);

        // Count active processes
        let mut active_count = 0;
        for s in 0..MAX_REFINE_SLOTS {
            if refinery_state[ref_idx + s * 4] > 0.5 {
                active_count += 1;
            }
        }

        // Start new processes
        let mut ore = resources[res_idx]; // Ore is at index 0

        while active_count < refine_slots && ore > 0.0 && current_energy > 0.0 {
            let slot_target = refine_slots.max(1) as f32;
            let batch_size = ore.min((storage_capacity / slot_target).max(10.0));

            // Find empty slot
            let mut slot_found = false;
            for s in 0..MAX_REFINE_SLOTS {
                let slot_offset = ref_idx + s * 4;
                if refinery_state[slot_offset] < 0.5 {
                    // Start process
                    refinery_state[slot_offset] = 1.0; // Active
                    refinery_state[slot_offset + 1] = batch_size; // Amount
                    refinery_state[slot_offset + 2] = 0.0; // Progress
                    refinery_state[slot_offset + 3] = 1.0 * production_speed_multiplier; // Speed multiplier

                    ore -= batch_size;
                    active_count += 1;
                    slot_found = true;
                    break;
                }
            }
            if !slot_found {
                break;
            }
        }
        resources[res_idx] = ore;

        // Enforce min one refining / energy scaling
        let energy_fraction = if energy_capacity > 0.0 {
            current_energy / energy_capacity
        } else {
            0.0
        };

        let low_energy = energy_fraction < 0.2;

        // Tick processes
        let mut bars_produced = 0.0;

        for s in 0..MAX_REFINE_SLOTS {
            let slot_offset = ref_idx + s * 4;
            if refinery_state[slot_offset] > 0.5 {
                let mut speed_mult = 1.0 * production_speed_multiplier;

                if low_energy {
                    // Find if this is the "first" active slot
                    let is_first = (0..s).all(|prev| refinery_state[ref_idx + prev * 4] < 0.5);
                    if is_first {
                        speed_mult *= (energy_fraction * 2.0).max(0.1);
                    } else {
                        speed_mult = 0.0;
                    }
                }
                refinery_state[slot_offset + 3] = speed_mult;

                let amount = refinery_state[slot_offset + 1];
                let mut progress = refinery_state[slot_offset + 2];

                let drain = FACTORY_ENERGY_PER_REFINE * dt * speed_mult * energy_drain_multiplier;
                let consumed = drain.min(current_energy);
                current_energy = (current_energy - consumed).max(0.0);

                let adjusted_dt = dt * speed_mult;
                let prev_progress = progress;
                progress = (progress + adjusted_dt / FACTORY_REFINE_TIME).min(1.0);
                let delta = (progress - prev_progress).max(0.0);

                refinery_state[slot_offset + 2] = progress;

                let refined_this_tick = amount * delta;
                bars_produced += refined_this_tick * refinery_yield_multiplier;

                if progress >= 1.0 {
                    refinery_state[slot_offset] = 0.0;
                    refinery_state[slot_offset + 1] = 0.0;
                    refinery_state[slot_offset + 2] = 0.0;
                    refinery_state[slot_offset + 3] = 0.0;
                }
            }
        }

        energy[i] = current_energy;
        resources[res_idx + 5] += bars_produced; // Bars are at index 5
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_refinery_basic() {
        let mut resources = vec![
            100.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, // Factory 1
        ];
        let upgrades = vec![
            0.0, 0.0, 0.0, 0.0, 0.0, // Factory 1
        ];
        let mut refinery_state = vec![0.0; MAX_REFINE_SLOTS * 4];
        let haulers_assigned = vec![0.0];
        let mut energy = vec![100.0];
        let dt = 1.0;

        sys_refinery(
            &mut resources,
            &upgrades,
            &mut refinery_state,
            &haulers_assigned,
            &mut energy,
            dt,
            1.0,
            1.0,
            1.0,
            1.0,
        );

        // Should have started processes
        assert!(refinery_state[0] > 0.5); // Active
        assert!(refinery_state[1] > 0.0); // Amount
        assert!(refinery_state[2] > 0.0); // Progress

        // Ore should be consumed
        assert!(resources[0] < 100.0);

        // Energy should be consumed (idle + refine)
        assert!(energy[0] < 100.0);
    }
}
