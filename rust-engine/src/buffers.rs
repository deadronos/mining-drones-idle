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
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AsteroidBuffers {
    pub positions: BufferSection,
    pub ore_remaining: BufferSection,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct FactoryBuffers {
    pub positions: BufferSection,
    pub orientations: BufferSection,
    pub activity: BufferSection,
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

    Ok(EntityBufferLayout {
        drones: DroneBuffers {
            positions: drone_positions,
            velocities: drone_velocities,
            states: drone_states,
        },
        asteroids: AsteroidBuffers {
            positions: asteroid_positions,
            ore_remaining: asteroid_ore_remaining,
        },
        factories: FactoryBuffers {
            positions: factory_positions,
            orientations: factory_orientations,
            activity: factory_activity,
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
        assert!(
            layout.asteroids.positions.offset_bytes < layout.asteroids.ore_remaining.offset_bytes
        );
        assert!(
            layout.factories.positions.offset_bytes < layout.factories.orientations.offset_bytes
        );
        assert!(
            layout.factories.orientations.offset_bytes < layout.factories.activity.offset_bytes
        );
        assert!(layout.total_size_bytes >= layout.factories.activity.advance(4).unwrap());
    }

    #[test]
    fn respects_entity_counts_for_lengths() {
        let layout = plan_layout(3, 4, 5).expect("layout should be valid");
        assert_eq!(layout.drones.positions.length, 9);
        assert_eq!(layout.drones.states.length, 3);
        assert_eq!(layout.asteroids.positions.length, 12);
        assert_eq!(layout.asteroids.ore_remaining.length, 4);
        assert_eq!(layout.factories.orientations.length, 20);
        assert_eq!(layout.factories.activity.length, 5);
    }
}
