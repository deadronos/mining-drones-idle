use crate::constants::*;
use crate::schema::{Modules, Resources};
use std::collections::BTreeMap;

pub fn sys_power(
    resources: &mut Resources,
    modules: &Modules,
    factory_energy: &mut [f32], // [energy] * N
    factory_max_energy: &[f32], // [max_energy] * N (base capacity)
    factory_upgrades: &[f32],   // [docking, refine, storage, energy, solar] * N
    drone_battery: &mut [f32],  // [battery] * N
    drone_states: &[f32],       // [state] * N
    drone_owners: &BTreeMap<String, Option<String>>, // droneId -> ownerId
    drone_id_to_index: &BTreeMap<String, usize>,
    factory_id_to_index: &BTreeMap<String, usize>,
    dt: f32,
    energy_generation_multiplier: f32,
    energy_storage_multiplier: f32,
) {
    if dt <= 0.0 {
        return;
    }

    // 1. Global Generation
    let generation = SOLAR_BASE_GEN * (modules.solar as f32) * energy_generation_multiplier;
    let cap = (BASE_ENERGY_CAP + ENERGY_PER_SOLAR * (modules.solar as f32))
        * energy_storage_multiplier;

    resources.energy = (resources.energy + generation * dt).clamp(0.0, cap);
    let mut stored_global = resources.energy;

    // 2. Factory Solar Regen
    let factory_count = factory_energy.len();
    let stride_upg = 5;

    // We need to track factory energy changes to allow drone charging
    // But we can just update factory_energy in place.

    for i in 0..factory_count {
        let upg_idx = i * stride_upg;
        let solar_level = factory_upgrades[upg_idx + 4] as i32;
        let solar_array_level = modules.solar;

        let factory_regen = if solar_level > 0 {
            FACTORY_SOLAR_BASE_REGEN + (solar_level - 1) as f32 * FACTORY_SOLAR_REGEN_PER_LEVEL
        } else {
            0.0
        };

        let array_bonus = solar_array_level as f32 * SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL;
        let total_regen = factory_regen + array_bonus;

        if total_regen > 0.0 {
            let base_cap = factory_max_energy[i];
            let effective_cap = base_cap
                + (solar_array_level as f32 * SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL);

            let current = factory_energy[i];
            let gain = (total_regen * dt).min(effective_cap - current).max(0.0);
            factory_energy[i] += gain;
        }
    }

    // 3. Drone Charging
    let charge_rate = DRONE_ENERGY_COST * 2.0;

    // Iterate all drones
    for (drone_id, owner_id_opt) in drone_owners.iter() {
        let drone_idx = match drone_id_to_index.get(drone_id) {
            Some(&idx) => idx,
            None => continue,
        };

        let state = drone_states[drone_idx];
        let battery = drone_battery[drone_idx];

        // Check if candidate: idle (0.0) or unloading (4.0)
        let is_candidate = (state == DRONE_STATE_IDLE || state == DRONE_STATE_UNLOADING)
            && battery < DRONE_MAX_BATTERY - 1e-4;

        if !is_candidate {
            continue;
        }

        let deficit = DRONE_MAX_BATTERY - battery;
        let max_charge = deficit.min(charge_rate * dt);

        if max_charge <= 1e-6 {
            continue;
        }

        let mut remaining_need = max_charge;
        let mut charge_applied = 0.0;

        // Local-first
        if let Some(owner_id) = owner_id_opt {
            if let Some(&factory_idx) = factory_id_to_index.get(owner_id) {
                let available = factory_energy[factory_idx];
                let from_factory = remaining_need.min(available);
                if from_factory > 0.0 {
                    factory_energy[factory_idx] -= from_factory;
                    charge_applied += from_factory;
                    remaining_need -= from_factory;
                }
            }
        }

        // Global fallback
        if remaining_need > 1e-6 {
            let from_global = remaining_need.min(stored_global);
            if from_global > 0.0 {
                stored_global -= from_global;
                charge_applied += from_global;
            }
        }

        if charge_applied > 0.0 {
            drone_battery[drone_idx] = (battery + charge_applied).min(DRONE_MAX_BATTERY);
        }
    }

    resources.energy = stored_global;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{Modules, Resources};

    #[test]
    fn test_power_generation() {
        let mut resources = Resources {
            energy: 0.0,
            ..Default::default()
        };
        let modules = Modules {
            solar: 1,
            ..Default::default() // other fields 0
        };
        let mut factory_energy = vec![];
        let factory_max_energy = vec![];
        let factory_upgrades = vec![];
        let mut drone_battery = vec![];
        let drone_states = vec![];
        let drone_owners = BTreeMap::new();
        let drone_id_to_index = BTreeMap::new();
        let factory_id_to_index = BTreeMap::new();

        sys_power(
            &mut resources,
            &modules,
            &mut factory_energy,
            &factory_max_energy,
            &factory_upgrades,
            &mut drone_battery,
            &drone_states,
            &drone_owners,
            &drone_id_to_index,
            &factory_id_to_index,
            1.0,
            1.0,
            1.0,
        );

        // Base 7 * 1 * 1 = 7
        assert!((resources.energy - 7.0).abs() < 0.001);
    }
}
