use crate::schema::Resources;
use serde_json::Value;

pub struct ResourceModifierSnapshot {
    pub metals_bonus: f32,
    pub crystals_bonus: f32,
    pub organics_bonus: f32,
    pub ice_bonus: f32,
    pub drone_capacity_multiplier: f32,
    pub drone_battery_multiplier: f32,
    pub storage_capacity_multiplier: f32,
    pub refinery_yield_multiplier: f32,
    pub drone_production_speed_multiplier: f32,
    pub energy_generation_multiplier: f32,
    pub energy_storage_multiplier: f32,
    pub energy_drain_multiplier: f32,
    pub drone_speed_multiplier: f32,
    pub drone_mining_speed_multiplier: f32,
}

struct ResourceBalanceEntry {
    cap: f32,
    scale: f32,
}

const RESOURCE_BALANCE_METALS: ResourceBalanceEntry = ResourceBalanceEntry { cap: 0.3, scale: 1000.0 };
const RESOURCE_BALANCE_CRYSTALS: ResourceBalanceEntry = ResourceBalanceEntry { cap: 0.25, scale: 5000.0 };
const RESOURCE_BALANCE_ORGANICS: ResourceBalanceEntry = ResourceBalanceEntry { cap: 0.4, scale: 8000.0 };
const RESOURCE_BALANCE_ICE: ResourceBalanceEntry = ResourceBalanceEntry { cap: 0.35, scale: 6000.0 };

const ORGANICS_ENERGY_REGEN_FACTOR: f32 = 0.6;
const ORGANICS_DRONE_OUTPUT_FACTOR: f32 = 1.2;
const ICE_DRAIN_REDUCTION_FACTOR: f32 = 0.5;

fn get_balance_with_prestige(base: &ResourceBalanceEntry, cores: i32) -> ResourceBalanceEntry {
    let cores_f = cores as f32;
    let cap_bonus = 1.005f32.powf(cores_f);
    let scale_reduction = 0.99f32.powf(cores_f);
    ResourceBalanceEntry {
        cap: base.cap * cap_bonus,
        scale: base.scale * scale_reduction,
    }
}

fn compute_bonus(amount: f32, balance: &ResourceBalanceEntry) -> f32 {
    let safe_amount = amount.max(0.0).min(1e6); // safeNumber logic
    let scale = if balance.scale > 0.0 { balance.scale } else { 1.0 };
    let cap = balance.cap;

    let primary_bonus = cap * (1.0 - (-safe_amount / scale).exp());

    let saturation_point = scale * 5.0;
    let overflow = (safe_amount - saturation_point).max(0.0);
    let overflow_bonus = (overflow / (scale * 10.0)) * cap;

    let total = primary_bonus + overflow_bonus;
    if total.is_finite() && total > 0.0 {
        total
    } else {
        0.0
    }
}

pub fn get_resource_modifiers(
    resources: &Resources,
    prestige_cores: i32,
    prestige_investments: Option<&Value>,
    spec_techs: Option<&Value>,
) -> ResourceModifierSnapshot {
    let metals_balance = get_balance_with_prestige(&RESOURCE_BALANCE_METALS, prestige_cores);
    let crystals_balance = get_balance_with_prestige(&RESOURCE_BALANCE_CRYSTALS, prestige_cores);
    let organics_balance = get_balance_with_prestige(&RESOURCE_BALANCE_ORGANICS, prestige_cores);
    let ice_balance = get_balance_with_prestige(&RESOURCE_BALANCE_ICE, prestige_cores);

    let metals_bonus = compute_bonus(resources.metals, &metals_balance);
    let crystals_bonus = compute_bonus(resources.crystals, &crystals_balance);
    let organics_bonus = compute_bonus(resources.organics, &organics_balance);
    let ice_bonus = compute_bonus(resources.ice, &ice_balance);

    let drone_battery_multiplier = (1.0 + metals_bonus).max(1.0);
    let drone_capacity_multiplier = (1.0 + metals_bonus).max(1.0);
    let storage_capacity_multiplier = (1.0 + metals_bonus).max(1.0);
    let refinery_yield_multiplier = (1.0 + crystals_bonus).max(1.0);
    let drone_production_speed_multiplier = (1.0 + ORGANICS_DRONE_OUTPUT_FACTOR * organics_bonus).max(1.0);
    let energy_generation_multiplier = (1.0 + ORGANICS_ENERGY_REGEN_FACTOR * organics_bonus).max(1.0);
    let energy_storage_multiplier = (1.0 + ice_bonus).max(1.0);
    let energy_drain_multiplier = (1.0 - ICE_DRAIN_REDUCTION_FACTOR * ice_bonus).max(1.0).clamp(0.5, 1.0);

    let drone_velocity_tier = prestige_investments
        .and_then(|v| v.get("droneVelocity"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0) as f32;

    let ore_magnet_level = spec_techs
        .and_then(|v| v.get("oreMagnet"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0) as f32;

    let drone_speed_multiplier = 1.0 + drone_velocity_tier * crate::constants::PRESTIGE_DRONE_VELOCITY_BONUS_PER_TIER;
    let drone_mining_speed_multiplier = 1.0 + ore_magnet_level * crate::constants::SPEC_TECH_ORE_MAGNET_BONUS_PER_LEVEL;

    ResourceModifierSnapshot {
        metals_bonus,
        crystals_bonus,
        organics_bonus,
        ice_bonus,
        drone_capacity_multiplier,
        drone_battery_multiplier,
        storage_capacity_multiplier,
        refinery_yield_multiplier,
        drone_production_speed_multiplier,
        energy_generation_multiplier,
        energy_storage_multiplier,
        energy_drain_multiplier,
        drone_speed_multiplier,
        drone_mining_speed_multiplier,
    }
}
