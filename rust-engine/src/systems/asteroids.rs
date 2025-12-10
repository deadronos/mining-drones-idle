use crate::rng::Mulberry32;
use crate::sinks::SinkBonuses;

pub fn sys_asteroids(
    asteroid_positions: &mut [f32],
    asteroid_ore: &mut [f32],
    asteroid_max_ore: &mut [f32],
    asteroid_resource_profile: &mut [f32],
    rng: &mut Mulberry32,
    sink_bonuses: &SinkBonuses,
    scanner_level: i32,
    _dt: f32,
) {
    let count = asteroid_positions.len() / 3;
    for i in 0..count {
        if asteroid_ore[i] <= 0.01 {
             respawn_asteroid(
                i,
                asteroid_positions,
                asteroid_ore,
                asteroid_max_ore,
                asteroid_resource_profile,
                rng,
                sink_bonuses,
                scanner_level
            );
        }
    }
}

fn respawn_asteroid(
    index: usize,
    positions: &mut [f32],
    ore: &mut [f32],
    max_ore: &mut [f32],
    profile: &mut [f32],
    rng: &mut Mulberry32,
    sink_bonuses: &SinkBonuses,
    scanner_level: i32,
) {
    // Position: randomOnRing(12, 48, 6)
    let r_min = 12.0;
    let r_max = 48.0;
    let h = 6.0;

    let angle = rng.next_f32() * std::f32::consts::TAU;
    let dist = r_min + rng.next_f32() * (r_max - r_min);
    let x = dist * angle.cos();
    let y = (rng.next_f32() * 2.0 - 1.0) * h;
    let z = dist * angle.sin();

    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    // Max Ore
    let base_richness = 80.0;
    let richness_bias = (1.0 + (scanner_level as f32) * 0.05) * sink_bonuses.asteroid_richness_multiplier;
    let richness = (0.8 + rng.next_f32() * 0.4) * richness_bias;
    let new_ore = base_richness * richness;

    max_ore[index] = new_ore;
    ore[index] = new_ore;

    // Resource Profile (simple random for now)
    let mut weights = [0.0; 5];
    let mut total = 0.0;
    for j in 0..5 {
        weights[j] = rng.next_f32();
        total += weights[j];
    }
    let p_idx = index * 5;
    for j in 0..5 {
        profile[p_idx + j] = weights[j] / total;
    }
}
