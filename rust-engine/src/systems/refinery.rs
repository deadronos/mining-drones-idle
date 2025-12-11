use crate::buffers::MAX_REFINE_SLOTS;
use crate::constants::*;

const MIN_BATCH_SIZE: f32 = 10.0;
const ENERGY_FLOOR_THRESHOLD: f32 = 0.2;
const MIN_SPEED: f32 = 0.1;

pub fn sys_refinery(
    resources: &mut [f32],                // [ore, bars, metals, crystals, organics, ice, credits] * N
    refinery_state: &mut [f32],           // [active, amount, progress, speed] * MAX_REFINE_SLOTS * N
    haulers_assigned: &[f32],             // [count] * N
    energy: &mut [f32],                   // [energy] * N
    idle_energy_per_sec: &[f32],          // per factory
    energy_per_refine: &[f32],            // per factory
    refine_slots: &[i32],                 // per factory
    storage_capacity: &[f32],             // per factory
    effective_energy_capacity: &[f32],    // per factory (includes solar array + modifiers)
    dt: f32,
    energy_drain_multiplier: f32,
    storage_capacity_multiplier: f32,
    production_speed_multiplier: f32,
    refinery_yield_multiplier: f32,
) {
    let factory_count = energy.len();
    let stride_res = 7;
    let stride_ref = MAX_REFINE_SLOTS * 4;

    for i in 0..factory_count {
        let res_idx = i * stride_res;
        let ref_idx = i * stride_ref;

        let mut current_energy = energy[i];
        let slots = refine_slots.get(i).cloned().unwrap_or(0).max(0) as usize;
        let slots_limit = slots.min(MAX_REFINE_SLOTS);
        let hauler_count = *haulers_assigned.get(i).unwrap_or(&0.0);
        let idle_drain_rate = *idle_energy_per_sec.get(i).unwrap_or(&FACTORY_IDLE_ENERGY_PER_SEC);
        let energy_per_refine = *energy_per_refine.get(i).unwrap_or(&FACTORY_ENERGY_PER_REFINE);
        let storage_cap = *storage_capacity.get(i).unwrap_or(&FACTORY_STORAGE_CAPACITY)
            * storage_capacity_multiplier;
        let effective_energy_cap = *effective_energy_capacity.get(i).unwrap_or(&FACTORY_ENERGY_CAPACITY);

        // Idle drain
        let idle_drain = idle_drain_rate * dt * energy_drain_multiplier;
        current_energy = (current_energy - idle_drain).max(0.0);

        // Hauler maintenance drain
        let hauler_drain = hauler_count * 0.5 * dt * energy_drain_multiplier;
        current_energy = (current_energy - hauler_drain).max(0.0);

        // Count active processes
        let mut active_count = 0;
        for s in 0..slots_limit {
            if refinery_state[ref_idx + s * 4] > 0.5 {
                active_count += 1;
            }
        }

        // Start new processes (local energy + storage gate)
        let mut ore = resources[res_idx]; // Ore is at index 0
        while active_count < slots_limit && ore > 0.0 && current_energy > 0.0 {
            let slot_target = slots_limit.max(1) as f32;
            let batch_size = ore.min((storage_cap / slot_target).max(MIN_BATCH_SIZE));

            // Find empty slot
            let mut slot_found = false;
            for s in 0..slots_limit {
                let slot_offset = ref_idx + s * 4;
                if refinery_state[slot_offset] < 0.5 {
                    // Start process
                    refinery_state[slot_offset] = 1.0; // Active
                    refinery_state[slot_offset + 1] = batch_size; // Amount
                    refinery_state[slot_offset + 2] = 0.0; // Progress
                    refinery_state[slot_offset + 3] = production_speed_multiplier.max(0.0); // Base speed multiplier

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

        // Enforce min-one refining semantics under low energy
        let energy_fraction = if effective_energy_cap > 0.0 {
            (current_energy / effective_energy_cap).max(0.0)
        } else {
            0.0
        };
        let low_energy = energy_fraction < ENERGY_FLOOR_THRESHOLD;

        // Tick processes
        let mut bars_produced = 0.0;
        let mut first_active_seen = false;

        for s in 0..slots_limit {
            let slot_offset = ref_idx + s * 4;
            if refinery_state[slot_offset] > 0.5 {
                let mut speed_mult = refinery_state[slot_offset + 3].max(0.0);

                if low_energy {
                    if !first_active_seen {
                        speed_mult = (energy_fraction * 2.0).max(MIN_SPEED);
                        first_active_seen = true;
                    } else {
                        speed_mult = 0.0;
                    }
                }

                refinery_state[slot_offset + 3] = speed_mult;

                let amount = refinery_state[slot_offset + 1];
                let mut progress = refinery_state[slot_offset + 2];

                let drain = energy_per_refine * dt * speed_mult * energy_drain_multiplier;
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

        let capped_energy = effective_energy_cap.max(0.0);
        energy[i] = current_energy.min(capped_energy);
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
        let idle_energy_per_sec = vec![FACTORY_IDLE_ENERGY_PER_SEC];
        let energy_per_refine = vec![FACTORY_ENERGY_PER_REFINE];
        let refine_slots = vec![FACTORY_REFINE_SLOTS as i32];
        let storage_capacity = vec![FACTORY_STORAGE_CAPACITY];
        let effective_energy_capacity = vec![FACTORY_ENERGY_CAPACITY];

        sys_refinery(
            &mut resources,
            &mut refinery_state,
            &haulers_assigned,
            &mut energy,
            &idle_energy_per_sec,
            &energy_per_refine,
            &refine_slots,
            &storage_capacity,
            &effective_energy_capacity,
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
