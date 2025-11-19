use serde::{Deserialize, Serialize};

use crate::error::SimulationError;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct BufferSection {
    pub offset_bytes: usize,
    pub length: usize,
}

impl BufferSection {
    fn advance(&self, stride_bytes: usize) -> Result<usize, SimulationError> {
        self.length
            .checked_mul(stride_bytes)
            .and_then(|delta| self.offset_bytes.checked_add(delta))
            .ok_or_else(|| {
                SimulationError::InvalidLayout(
                    "buffer layout exceeds addressable range".to_string(),
                )
            })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DroneBuffers {
    pub positions: BufferSection,
    pub velocities: BufferSection,
    pub states: BufferSection,
    pub cargo: BufferSection,
    pub battery: BufferSection,
    pub target_index: BufferSection, // Add this
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AsteroidBuffers {
    pub positions: BufferSection,
    pub ore_remaining: BufferSection,
    pub max_ore: BufferSection,
}

pub const MAX_REFINE_SLOTS: usize = 16;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct FactoryBuffers {
    pub positions: BufferSection,
    pub orientations: BufferSection,
    pub activity: BufferSection,
    pub resources: BufferSection,
    pub energy: BufferSection,
    pub max_energy: BufferSection,
    pub upgrades: BufferSection,
    pub refinery_state: BufferSection,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntityBufferLayout {
    pub drones: DroneBuffers,
    pub asteroids: AsteroidBuffers,
    pub factories: FactoryBuffers,
    pub total_size_bytes: usize,
}

pub fn plan_layout(
    drone_count: usize,
    asteroid_count: usize,
    factory_count: usize,
) -> Result<EntityBufferLayout, SimulationError> {
    let mut offset = 0usize;

    let drone_positions = BufferSection {
        offset_bytes: offset,
        length: drone_count * 3,
    };
    offset = drone_positions.advance(4)?;
    let drone_velocities = BufferSection {
        offset_bytes: offset,
        length: drone_count * 3,
    };
    offset = drone_velocities.advance(4)?;
    let drone_states = BufferSection {
        offset_bytes: offset,
        length: drone_count,
    };
    offset = drone_states.advance(4)?;
    let drone_cargo = BufferSection {
        offset_bytes: offset,
        length: drone_count,
    };
    offset = drone_cargo.advance(4)?;
    let drone_battery = BufferSection {
        offset_bytes: offset,
        length: drone_count,
    };
    offset = drone_battery.advance(4)?;
    let drone_target_index = BufferSection {
        offset_bytes: offset,
        length: drone_count,
    };
    offset = drone_target_index.advance(4)?;

    let asteroid_positions = BufferSection {
        offset_bytes: offset,
        length: asteroid_count * 3,
    };
    offset = asteroid_positions.advance(4)?;
    let asteroid_ore_remaining = BufferSection {
        offset_bytes: offset,
        length: asteroid_count,
    };
    offset = asteroid_ore_remaining.advance(4)?;
    let asteroid_max_ore = BufferSection {
        offset_bytes: offset,
        length: asteroid_count,
    };
    offset = asteroid_max_ore.advance(4)?;

    let factory_positions = BufferSection {
        offset_bytes: offset,
        length: factory_count * 3,
    };
    offset = factory_positions.advance(4)?;
    let factory_orientations = BufferSection {
        offset_bytes: offset,
        length: factory_count * 4,
    };
    offset = factory_orientations.advance(4)?;
    let factory_activity = BufferSection {
        offset_bytes: offset,
        length: factory_count,
    };
    offset = factory_activity.advance(4)?;
    let factory_resources = BufferSection {
        offset_bytes: offset,
        length: factory_count * 7,
    };
    offset = factory_resources.advance(4)?;
    let factory_energy = BufferSection {
        offset_bytes: offset,
        length: factory_count,
    };
    offset = factory_energy.advance(4)?;
    let factory_max_energy = BufferSection {
        offset_bytes: offset,
        length: factory_count,
    };
    offset = factory_max_energy.advance(4)?;
    let factory_upgrades = BufferSection {
        offset_bytes: offset,
        length: factory_count * 5,
    };
    offset = factory_upgrades.advance(4)?;
    let factory_refinery_state = BufferSection {
        offset_bytes: offset,
        length: factory_count * MAX_REFINE_SLOTS * 4,
    };
    offset = factory_refinery_state.advance(4)?;

    Ok(EntityBufferLayout {
        drones: DroneBuffers {
            positions: drone_positions,
            velocities: drone_velocities,
            states: drone_states,
            cargo: drone_cargo,
            battery: drone_battery,
            target_index: drone_target_index,
        },
        asteroids: AsteroidBuffers {
            positions: asteroid_positions,
            ore_remaining: asteroid_ore_remaining,
            max_ore: asteroid_max_ore,
        },
        factories: FactoryBuffers {
            positions: factory_positions,
            orientations: factory_orientations,
            activity: factory_activity,
            resources: factory_resources,
            energy: factory_energy,
            max_energy: factory_max_energy,
            upgrades: factory_upgrades,
            refinery_state: factory_refinery_state,
        },
        total_size_bytes: offset,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_monotonic_offsets() {
        let layout = plan_layout(2, 1, 1).expect("layout should be valid");
        assert!(layout.drones.positions.offset_bytes < layout.drones.velocities.offset_bytes);
        assert!(layout.drones.velocities.offset_bytes < layout.drones.states.offset_bytes);
        assert!(layout.drones.states.offset_bytes < layout.drones.cargo.offset_bytes);
        assert!(layout.drones.cargo.offset_bytes < layout.drones.battery.offset_bytes);
        assert!(layout.drones.battery.offset_bytes < layout.drones.target_index.offset_bytes);

        assert!(
            layout.asteroids.positions.offset_bytes < layout.asteroids.ore_remaining.offset_bytes
        );
        assert!(
            layout.asteroids.ore_remaining.offset_bytes < layout.asteroids.max_ore.offset_bytes
        );

        assert!(
            layout.factories.positions.offset_bytes < layout.factories.orientations.offset_bytes
        );
        assert!(
            layout.factories.orientations.offset_bytes < layout.factories.activity.offset_bytes
        );
        assert!(
            layout.factories.activity.offset_bytes < layout.factories.resources.offset_bytes
        );
        assert!(
            layout.factories.resources.offset_bytes < layout.factories.energy.offset_bytes
        );
        assert!(
            layout.factories.energy.offset_bytes < layout.factories.max_energy.offset_bytes
        );
        assert!(
            layout.factories.max_energy.offset_bytes < layout.factories.upgrades.offset_bytes
        );
        assert!(
            layout.factories.upgrades.offset_bytes < layout.factories.refinery_state.offset_bytes
        );
        assert!(layout.total_size_bytes >= layout.factories.refinery_state.advance(4).unwrap());
    }

    #[test]
    fn respects_entity_counts_for_lengths() {
        let layout = plan_layout(3, 4, 5).expect("layout should be valid");
        assert_eq!(layout.drones.positions.length, 9);
        assert_eq!(layout.drones.states.length, 3);
        assert_eq!(layout.drones.cargo.length, 3);
        assert_eq!(layout.drones.battery.length, 3);
        assert_eq!(layout.drones.target_index.length, 3);

        assert_eq!(layout.asteroids.positions.length, 12);
        assert_eq!(layout.asteroids.ore_remaining.length, 4);
        assert_eq!(layout.asteroids.max_ore.length, 4);

        assert_eq!(layout.factories.orientations.length, 20);
        assert_eq!(layout.factories.activity.length, 5);
        assert_eq!(layout.factories.resources.length, 35);
        assert_eq!(layout.factories.energy.length, 5);
        assert_eq!(layout.factories.max_energy.length, 5);
        assert_eq!(layout.factories.upgrades.length, 25);
        assert_eq!(layout.factories.refinery_state.length, 5 * MAX_REFINE_SLOTS * 4);
    }
}
