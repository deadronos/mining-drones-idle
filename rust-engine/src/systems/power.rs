use crate::constants::*;
use crate::schema::{Modules, Resources};
use std::collections::BTreeMap;

pub fn sys_power(
    resources: &mut Resources,
    modules: &Modules,
    factory_energy: &mut [f32],
    factory_max_energy: &[f32],
    factory_upgrades: &[f32],
    drone_battery: &mut [f32],
    drone_max_battery: &[f32],
    drone_states: &[f32],
    drone_owner_factory_index: &[f32],
    drone_charging: &mut [f32],
    _drone_id_to_index: &BTreeMap<String, usize>,
    _factory_id_to_index: &BTreeMap<String, usize>,
    dt: f32,
    energy_generation_multiplier: f32,
    energy_storage_multiplier: f32,
) {
    // 1. Global Energy Generation
    let global_gen = SOLAR_BASE_GEN * (modules.solar as f32 + 1.0) * energy_generation_multiplier;
    let global_cap = (BASE_ENERGY_CAP + modules.solar as f32 * ENERGY_PER_SOLAR) * energy_storage_multiplier;

    resources.energy = (resources.energy + global_gen * dt).min(global_cap).max(0.0);

    // 2. Factory Solar Generation
    let factory_count = factory_energy.len();
    let stride_upg = 5;
    let solar_array_level = modules.solar as f32;
    let array_bonus_regen = SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL * solar_array_level;
    let array_bonus_cap = SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL * solar_array_level;

    for i in 0..factory_count {
        let upg_idx = i * stride_upg;
        let solar_level = factory_upgrades[upg_idx + 4]; // Solar is index 4

        let factory_regen = FACTORY_SOLAR_BASE_REGEN + FACTORY_SOLAR_REGEN_PER_LEVEL * solar_level;
        let total_regen = factory_regen + array_bonus_regen;

        let base_cap = factory_max_energy[i];
        let effective_cap = (base_cap + array_bonus_cap) * energy_storage_multiplier;

        let current = factory_energy[i];
        let available_space = (effective_cap - current).max(0.0);
        let gain = (total_regen * dt).min(available_space);

        factory_energy[i] = current + gain;
    }

    // 3. Drone Charging
    let drone_count = drone_battery.len();
    let charge_rate = DRONE_ENERGY_COST * 2.0;

    for i in 0..drone_count {
        let state = drone_states[i];
        let battery = drone_battery[i];
        let max_battery = drone_max_battery[i];

        let is_candidate = (state == DRONE_STATE_IDLE || state == DRONE_STATE_UNLOADING) && battery < max_battery - 0.0001;

        if !is_candidate {
            drone_charging[i] = 0.0;
            continue;
        }

        let deficit = max_battery - battery;
        let max_charge = (charge_rate * dt).min(deficit);

        if max_charge <= 0.000001 {
            drone_charging[i] = 0.0;
            continue;
        }

        let mut charge_applied = 0.0;
        let mut remaining_need = max_charge;

        // Try factory first
        let owner_idx = drone_owner_factory_index[i];
        if owner_idx >= 0.0 {
            let f_idx = owner_idx as usize;
            if f_idx < factory_count {
                let available = factory_energy[f_idx];
                let from_factory = remaining_need.min(available);

                if from_factory > 0.0 {
                    factory_energy[f_idx] -= from_factory;
                    charge_applied += from_factory;
                    remaining_need -= from_factory;
                }
            }
        }

        // Try global
        if remaining_need > 0.000001 {
            let available = resources.energy;
            let from_global = remaining_need.min(available);

            if from_global > 0.0 {
                resources.energy -= from_global;
                charge_applied += from_global;
            }
        }

        if charge_applied > 0.0 {
            drone_battery[i] = (battery + charge_applied).min(max_battery);
            drone_charging[i] = 1.0;
        } else {
            drone_charging[i] = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{Modules, Resources};
    use std::collections::BTreeMap;

    #[test]
    fn test_power_generation() {
        let mut resources = Resources::default();
        let modules = Modules::default();
        let mut factory_energy = vec![0.0];
        let factory_max_energy = vec![100.0];
        let factory_upgrades = vec![0.0, 0.0, 0.0, 0.0, 0.0];
        let mut drone_battery = vec![24.0];
        let drone_max_battery = vec![24.0];
        let drone_states = vec![0.0];
        let drone_owner_factory_index = vec![0.0];
        let mut drone_charging = vec![0.0];
        let drone_id_to_index = BTreeMap::new();
        let factory_id_to_index = BTreeMap::new();
        let dt = 1.0;

        sys_power(
            &mut resources,
            &modules,
            &mut factory_energy,
            &factory_max_energy,
            &factory_upgrades,
            &mut drone_battery,
            &drone_max_battery,
            &drone_states,
            &drone_owner_factory_index,
            &mut drone_charging,
            &drone_id_to_index,
            &factory_id_to_index,
            dt,
            1.0,
            1.0,
        );

        assert!(resources.energy > 0.0);
        assert!(factory_energy[0] > 0.0);
    }
}
