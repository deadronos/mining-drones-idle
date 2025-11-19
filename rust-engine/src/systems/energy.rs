use crate::constants::DRONE_MAX_BATTERY;

pub fn compute_drone_energy_fraction(battery: f32, throttle_floor: f32) -> f32 {
    if DRONE_MAX_BATTERY <= 0.0 {
        return 1.0;
    }
    let normalized = battery / DRONE_MAX_BATTERY;
    if !normalized.is_finite() {
        return 1.0;
    }
    normalized.clamp(throttle_floor, 1.0)
}

pub struct EnergyConsumption {
    pub fraction: f32,
    pub consumed: f32,
}

pub fn consume_drone_energy(
    battery: &mut f32,
    dt: f32,
    throttle_floor: f32,
    rate: f32,
) -> EnergyConsumption {
    let fraction = compute_drone_energy_fraction(*battery, throttle_floor);
    if dt <= 0.0 || rate <= 0.0 {
        return EnergyConsumption {
            fraction,
            consumed: 0.0,
        };
    }
    let consumed = (*battery).min((rate * dt * fraction).max(0.0));
    if consumed > 0.0 {
        *battery = (*battery - consumed).max(0.0);
        if *battery <= 1e-4 {
            *battery = 0.0;
        }
    }
    EnergyConsumption { fraction, consumed }
}
