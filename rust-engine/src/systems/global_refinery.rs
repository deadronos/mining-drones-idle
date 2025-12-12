use crate::schema::{Resources, Modules};
use crate::constants::{
    ORE_CONVERSION_PER_SECOND, ORE_PER_BAR, BASE_REFINERY_RATE,
};

pub fn sys_global_refinery(
    resources: &mut Resources,
    modules: &Modules,
    prestige_cores: i32,
    dt: f32,
    refinery_yield_multiplier: f32,
) {
    if dt <= 0.0 || modules.refinery <= 0 {
        return;
    }

    let ore_available = resources.ore;
    if ore_available <= 0.0 {
        return;
    }

    // Prestige bonus: 1 + 0.05 * min(cores, 100) + 0.02 * max(0, cores - 100)
    let capped = prestige_cores.min(100) as f32;
    let overflow = (prestige_cores - 100).max(0) as f32;
    let prestige_mult = 1.0 + 0.05 * capped + 0.02 * overflow;

    // Refinery mult: 1.1 ^ level
    let refinery_mult = 1.1f32.powi(modules.refinery);

    let ore_consumed = (ore_available).min(ORE_CONVERSION_PER_SECOND * dt);

    if ore_consumed <= 0.0 {
        return;
    }

    let bars_produced = (ore_consumed / ORE_PER_BAR) *
        BASE_REFINERY_RATE *
        refinery_mult *
        prestige_mult *
        refinery_yield_multiplier;

    resources.ore = (resources.ore - ore_consumed).max(0.0);
    resources.bars += bars_produced;
}
