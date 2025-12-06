use crate::schema::SimulationSnapshot;
use serde_json::Value;

pub struct SinkBonuses {
    pub ore_yield_multiplier: f32,
    pub drone_speed_multiplier: f32,
    pub asteroid_richness_multiplier: f32,
    pub asteroid_spawn_multiplier: f32,
    pub refinery_yield_multiplier: f32,
    pub offline_progress_multiplier: f32,
}

pub fn get_sink_bonuses(snapshot: &SimulationSnapshot) -> SinkBonuses {
    let spec_techs = &snapshot.spec_techs;
    let prestige_investments = &snapshot.prestige_investments;

    let get_level = |json: &Option<Value>, key: &str| -> f32 {
        json.as_ref()
            .and_then(|v| v.get(key))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0) as f32
    };

    let ore_magnet = get_level(spec_techs, "oreMagnet");
    let crystal_resonance = get_level(spec_techs, "crystalResonance");
    let biotech_farming = get_level(spec_techs, "biotechFarming");
    let cryo_preservation = get_level(spec_techs, "cryoPreservation");

    let drone_velocity = get_level(prestige_investments, "droneVelocity");
    let asteroid_abundance = get_level(prestige_investments, "asteroidAbundance");
    let refinery_mastery = get_level(prestige_investments, "refineryMastery");
    let offline_efficiency = get_level(prestige_investments, "offlineEfficiency");

    // Constants from TS
    let ore_bonus = ore_magnet * 0.03;
    let crystal_bonus = crystal_resonance * 0.02;
    let biotech_bonus = biotech_farming * 0.03;
    let cryo_bonus = cryo_preservation * 0.05;

    let velocity_bonus = drone_velocity * 0.02;
    let spawn_bonus = asteroid_abundance * 0.02;
    let refinery_bonus = refinery_mastery * 0.01;
    let offline_bonus = offline_efficiency * 0.03;

    let clamp = |v: f32| if v.is_finite() { v.max(0.0) } else { 1.0 };

    SinkBonuses {
        ore_yield_multiplier: clamp(1.0 + ore_bonus),
        drone_speed_multiplier: clamp(1.0 + velocity_bonus),
        asteroid_richness_multiplier: clamp((1.0 + crystal_bonus) * (1.0 + spawn_bonus)),
        asteroid_spawn_multiplier: clamp(1.0 + spawn_bonus),
        refinery_yield_multiplier: clamp((1.0 + biotech_bonus) * (1.0 + refinery_bonus)),
        offline_progress_multiplier: clamp((1.0 + cryo_bonus) * (1.0 + offline_bonus)),
    }
}
