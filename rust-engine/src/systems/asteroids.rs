use std::f32::consts::TAU;

use crate::rng::Mulberry32;
use crate::sinks::SinkBonuses;
use crate::systems::drone_ai::AsteroidMetadata;

const BASE_ASTEROID_RICHNESS: f32 = 80.0;
const POSITION_RING_MIN: f32 = 12.0;
const POSITION_RING_MAX: f32 = 48.0;
const POSITION_RING_HEIGHT: f32 = 6.0;
const SCANNER_RICHNESS_PER_LEVEL: f32 = 0.05;
const FRACTURE_TIMER_MIN: f32 = 24.0;
const FRACTURE_TIMER_MAX: f32 = 64.0;
const MIN_SEED: u32 = 1;

#[derive(Clone, Copy)]
struct ResourceWeights {
    ore: f32,
    metals: f32,
    crystals: f32,
    organics: f32,
    ice: f32,
}

#[derive(Clone, Copy)]
struct HazardDefinition {
    weight: f32,
}

#[derive(Clone, Copy)]
struct BiomeDefinition {
    gravity_multiplier: f32,
    resource_weights: ResourceWeights,
    hazard_profile: &'static [HazardDefinition],
}

const fn biome_definitions() -> [BiomeDefinition; 4] {
    [
        BiomeDefinition {
            gravity_multiplier: 0.9,
            resource_weights: ResourceWeights {
                ore: 0.6,
                metals: 0.2,
                crystals: 0.1,
                organics: 0.05,
                ice: 1.0,
            },
            hazard_profile: &[
                HazardDefinition { weight: 2.0 }, // ionStorm (medium)
                HazardDefinition { weight: 1.0 }, // microQuakes (low)
            ],
        },
        BiomeDefinition {
            gravity_multiplier: 1.25,
            resource_weights: ResourceWeights {
                ore: 1.0,
                metals: 1.2,
                crystals: 0.15,
                organics: 0.05,
                ice: 0.1,
            },
            hazard_profile: &[
                HazardDefinition { weight: 3.0 }, // solarFlare (medium)
                HazardDefinition { weight: 2.0 }, // microQuakes (high)
            ],
        },
        BiomeDefinition {
            gravity_multiplier: 1.05,
            resource_weights: ResourceWeights {
                ore: 0.7,
                metals: 0.3,
                crystals: 1.3,
                organics: 0.05,
                ice: 0.15,
            },
            hazard_profile: &[
                HazardDefinition { weight: 1.0 }, // solarFlare (low)
                HazardDefinition { weight: 2.0 }, // ionStorm (high)
            ],
        },
        BiomeDefinition {
            gravity_multiplier: 0.82,
            resource_weights: ResourceWeights {
                ore: 0.5,
                metals: 0.15,
                crystals: 0.1,
                organics: 1.2,
                ice: 0.35,
            },
            hazard_profile: &[
                HazardDefinition { weight: 3.0 }, // sporeBurst (medium)
                HazardDefinition { weight: 1.0 }, // ionStorm (low)
            ],
        },
    ]
}

fn clamp_gravity(value: f32) -> f32 {
    value.clamp(0.5, 1.5)
}

fn random_range(rng: &mut Mulberry32, min: f32, max: f32) -> f32 {
    min + rng.next_f32() * (max - min)
}

fn normalize_resource_weights(weights: ResourceWeights) -> ResourceWeights {
    let entries = [
        ("ore", weights.ore),
        ("metals", weights.metals),
        ("crystals", weights.crystals),
        ("organics", weights.organics),
        ("ice", weights.ice),
    ];
    let total: f32 = entries.iter().map(|(_, v)| v.max(0.0)).sum();
    if !total.is_finite() || total <= 0.0 {
        return ResourceWeights {
            ore: 1.0,
            metals: 0.0,
            crystals: 0.0,
            organics: 0.0,
            ice: 0.0,
        };
    }

    ResourceWeights {
        ore: weights.ore.max(0.0) / total,
        metals: weights.metals.max(0.0) / total,
        crystals: weights.crystals.max(0.0) / total,
        organics: weights.organics.max(0.0) / total,
        ice: weights.ice.max(0.0) / total,
    }
}

fn choose_biome(rng: &mut Mulberry32) -> BiomeDefinition {
    let definitions = biome_definitions();
    let mut total: f32 = 0.0;
    let mut weighted = Vec::with_capacity(definitions.len());
    for def in definitions.iter() {
        total += 1.0;
        weighted.push((def, 1.0));
    }
    let mut roll = rng.next_f32() * total.max(0.0001);
    let mut chosen = *definitions.last().unwrap_or(&definitions[0]);
    for (def, weight) in weighted {
        roll -= weight;
        if roll <= 0.0 {
            chosen = *def;
            break;
        }
    }
    chosen
}

fn roll_hazard(rng: &mut Mulberry32, biome: &BiomeDefinition) {
    let mut total = 0.0;
    let mut weighted = Vec::with_capacity(biome.hazard_profile.len());
    for hazard in biome.hazard_profile {
        let weight = hazard.weight.max(0.0);
        total += weight;
        weighted.push(weight);
    }
    if weighted.is_empty() || total <= 0.0 {
        return;
    }
    // Consume one RNG sample to mirror TS hazard roll.
    let mut roll = rng.next_f32() * total;
    for weight in weighted {
        roll -= weight;
        if roll <= 0.0 {
            break;
        }
    }
}

fn pick_biome_profile(rng: &mut Mulberry32) -> (ResourceWeights, f32) {
    let biome = choose_biome(rng);
    let normalized = normalize_resource_weights(biome.resource_weights);
    roll_hazard(rng, &biome);
    // Fracture timer + seed draw to match TS createAsteroidBiomeState
    let _fracture_timer = random_range(rng, FRACTURE_TIMER_MIN, FRACTURE_TIMER_MAX);
    let seed_scaled = (rng.next_f32() * 0xffff_ffffu32 as f32).floor() as u32;
    let _fracture_seed = seed_scaled.max(MIN_SEED);
    (normalized, clamp_gravity(biome.gravity_multiplier))
}

fn dominant_resource(profile: &ResourceWeights) -> &'static str {
    let entries = [
        ("ore", profile.ore),
        ("metals", profile.metals),
        ("crystals", profile.crystals),
        ("organics", profile.organics),
        ("ice", profile.ice),
    ];
    let mut best = entries[0];
    for entry in entries.iter().skip(1) {
        if entry.1 > best.1 {
            best = *entry;
        }
    }
    best.0
}

pub fn sys_asteroids(
    asteroid_positions: &mut [f32],
    asteroid_ore: &mut [f32],
    asteroid_max_ore: &mut [f32],
    asteroid_resource_profile: &mut [f32],
    asteroid_metadata: &mut [AsteroidMetadata],
    rng: &mut Mulberry32,
    sink_bonuses: &SinkBonuses,
    scanner_level: i32,
    _dt: f32,
) {
    let count = asteroid_positions.len() / 3;
    for i in 0..count {
        if asteroid_ore.get(i).copied().unwrap_or(0.0) <= 0.01 {
            respawn_asteroid(
                i,
                asteroid_positions,
                asteroid_ore,
                asteroid_max_ore,
                asteroid_resource_profile,
                asteroid_metadata,
                rng,
                sink_bonuses,
                scanner_level,
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
    metadata: &mut [AsteroidMetadata],
    rng: &mut Mulberry32,
    sink_bonuses: &SinkBonuses,
    scanner_level: i32,
) {
    // Position: randomOnRing(12, 48, 6)
    let dist = random_range(rng, POSITION_RING_MIN, POSITION_RING_MAX);
    let angle = random_range(rng, 0.0, TAU);
    let y = random_range(rng, -POSITION_RING_HEIGHT, POSITION_RING_HEIGHT);

    positions[index * 3] = dist * angle.cos();
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = dist * angle.sin();

    // Max Ore
    let richness_bias = (1.0 + (scanner_level as f32) * SCANNER_RICHNESS_PER_LEVEL)
        * sink_bonuses.asteroid_richness_multiplier;
    let richness = random_range(rng, 0.8, 1.2) * richness_bias.max(0.0);
    let new_ore = BASE_ASTEROID_RICHNESS * richness;

    max_ore[index] = new_ore;
    ore[index] = new_ore;

    // Radius draw (not stored) to mirror TS createAsteroid randomness
    let _radius = random_range(rng, 0.6, 1.4);

    let (weights, gravity_multiplier) = pick_biome_profile(rng);
    let p_idx = index * 5;
    profile[p_idx] = weights.ore;
    profile[p_idx + 1] = weights.ice;
    profile[p_idx + 2] = weights.metals;
    profile[p_idx + 3] = weights.crystals;
    profile[p_idx + 4] = weights.organics;

    if let Some(entry) = metadata.get_mut(index) {
        entry.gravity_multiplier = gravity_multiplier;
        entry.regions.clear();
    }

    // Consume remaining draws for rotation/spin parity
    let _rotation = random_range(rng, 0.0, TAU);
    let _spin = random_range(rng, -0.4, 0.4);

    // Keep dominant resource calculated for potential future parity checks
    let _ = dominant_resource(&weights);
}
