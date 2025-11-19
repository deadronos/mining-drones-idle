use crate::buffers::EntityBufferLayout;
use crate::buffers::plan_layout;
use crate::error::SimulationError;
use crate::rng::Mulberry32;
use crate::schema::{Modules, Resources, SimulationSnapshot, StoreSettings};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq)]
pub struct TickResult {
    pub dt: f32,
    pub game_time: f32,
    pub rng_sample: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OfflineResult {
    pub elapsed: f32,
    pub steps: u32,
    pub snapshot_json: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum SimulationCommand {
    UpdateResources(Resources),
    UpdateModules(Modules),
    SetSettings(StoreSettings),
}

use std::collections::BTreeMap;

pub struct GameState {
    snapshot: SimulationSnapshot,
    rng: Mulberry32,
    layout: EntityBufferLayout,
    game_time: f32,
    data: Vec<u32>,
    drone_id_to_index: BTreeMap<String, usize>,
    factory_id_to_index: BTreeMap<String, usize>,
    asteroid_id_to_index: BTreeMap<String, usize>,
}

impl GameState {
    pub fn from_snapshot(snapshot: SimulationSnapshot) -> Result<Self, SimulationError> {
        snapshot.ensure_required()?;
        let rng_seed = snapshot.rng_seed.unwrap_or(1);

        let drone_count = snapshot.drone_owners.len();
        let factory_count = snapshot.factories.len();

        let layout = plan_layout(
            drone_count,
            asteroid_count(&snapshot),
            factory_count,
        )?;

        // Ensure size is multiple of 4
        let size_u32 = (layout.total_size_bytes + 3) / 4;
        let data = vec![0; size_u32];

        let mut drone_id_to_index = BTreeMap::new();
        for (i, (id, _)) in snapshot.drone_owners.iter().enumerate() {
            drone_id_to_index.insert(id.clone(), i);
        }

        let mut factory_id_to_index = BTreeMap::new();
        for (i, factory) in snapshot.factories.iter().enumerate() {
            factory_id_to_index.insert(factory.id.clone(), i);
        }

        let mut asteroid_id_to_index = BTreeMap::new();
        if let Some(asteroids) = snapshot.extra.get("asteroids").and_then(|v| v.as_array()) {
            for (i, asteroid) in asteroids.iter().enumerate() {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    asteroid_id_to_index.insert(id.to_string(), i);
                }
            }
        }

        Ok(Self {
            snapshot,
            rng: Mulberry32::new(rng_seed),
            layout,
            game_time: 0.0,
            data,
            drone_id_to_index,
            factory_id_to_index,
            asteroid_id_to_index,
        })
    }

    pub fn load_snapshot_str(&mut self, payload: &str) -> Result<(), SimulationError> {
        let snapshot: SimulationSnapshot =
            serde_json::from_str(payload).map_err(SimulationError::parse)?;
        snapshot.ensure_required()?;

        let drone_count = snapshot.drone_owners.len();
        let factory_count = snapshot.factories.len();

        self.layout = plan_layout(
            drone_count,
            asteroid_count(&snapshot),
            factory_count,
        )?;
        let size_u32 = (self.layout.total_size_bytes + 3) / 4;
        self.data = vec![0; size_u32];
        self.rng = Mulberry32::new(snapshot.rng_seed.unwrap_or(1));

        self.drone_id_to_index.clear();
        for (i, (id, _)) in snapshot.drone_owners.iter().enumerate() {
            self.drone_id_to_index.insert(id.clone(), i);
        }

        self.factory_id_to_index.clear();
        for (i, factory) in snapshot.factories.iter().enumerate() {
            self.factory_id_to_index.insert(factory.id.clone(), i);
        }

        self.asteroid_id_to_index.clear();
        if let Some(asteroids) = snapshot.extra.get("asteroids").and_then(|v| v.as_array()) {
            for (i, asteroid) in asteroids.iter().enumerate() {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    self.asteroid_id_to_index.insert(id.to_string(), i);
                }
            }
        }

        self.snapshot = snapshot;
        self.game_time = 0.0;
        Ok(())
    }

    pub fn export_snapshot_str(&self) -> Result<String, SimulationError> {
        serde_json::to_string(&self.snapshot).map_err(SimulationError::parse)
    }

    pub fn step(&mut self, dt: f32) -> TickResult {
        if dt.is_sign_negative() {
            return TickResult {
                dt: 0.0,
                game_time: self.game_time,
                rng_sample: self.rng.next_f32(),
            };
        }
        self.game_time += dt;

        // Run systems
        unsafe {
            let data_ptr = self.data.as_mut_ptr();

            // Helper to get slice
            let get_slice_mut = |section: &crate::buffers::BufferSection| -> &mut [f32] {
                let offset_u32 = section.offset_bytes / 4;
                let ptr = data_ptr.add(offset_u32) as *mut f32;
                std::slice::from_raw_parts_mut(ptr, section.length)
            };

            // Refinery System
            let resources = get_slice_mut(&self.layout.factories.resources);
            let upgrades = get_slice_mut(&self.layout.factories.upgrades);
            let refinery_state = get_slice_mut(&self.layout.factories.refinery_state);
            let energy = get_slice_mut(&self.layout.factories.energy);

            crate::systems::refinery::sys_refinery(
                resources,
                upgrades,
                refinery_state,
                energy,
                dt,
            );

            // Movement System
            let drone_positions = get_slice_mut(&self.layout.drones.positions);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_target_index = get_slice_mut(&self.layout.drones.target_index);
            let factory_positions = get_slice_mut(&self.layout.factories.positions);

            crate::systems::movement::sys_movement(
                &mut self.snapshot.drone_flights,
                &self.drone_id_to_index,
                &self.factory_id_to_index,
                &self.asteroid_id_to_index,
                drone_positions,
                drone_states,
                drone_battery,
                drone_target_index,
                factory_positions,
                dt,
                self.snapshot.settings.throttle_floor,
                1.0, // TODO: energy_drain_multiplier
            );

            // Power System
            let factory_energy = get_slice_mut(&self.layout.factories.energy);
            let factory_max_energy = get_slice_mut(&self.layout.factories.max_energy);
            let factory_upgrades = get_slice_mut(&self.layout.factories.upgrades);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_states = get_slice_mut(&self.layout.drones.states);

            crate::systems::power::sys_power(
                &mut self.snapshot.resources,
                &self.snapshot.modules,
                factory_energy,
                factory_max_energy,
                factory_upgrades,
                drone_battery,
                drone_states,
                &self.snapshot.drone_owners,
                &self.drone_id_to_index,
                &self.factory_id_to_index,
                dt,
                1.0, // energy_generation_multiplier
                1.0, // energy_storage_multiplier
            );

            // Mining System
            let drone_cargo = get_slice_mut(&self.layout.drones.cargo);
            let asteroid_max_ore = get_slice_mut(&self.layout.asteroids.max_ore);
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_target_index = get_slice_mut(&self.layout.drones.target_index);

            crate::systems::mining::sys_mining(
                drone_states,
                drone_cargo,
                drone_target_index,
                asteroid_max_ore,
                &self.snapshot.modules,
                dt,
                1.0, // mining_multiplier
            );
        }

        TickResult {
            dt,
            game_time: self.game_time,
            rng_sample: self.rng.next_f32(),
        }
    }

    pub fn apply_command(&mut self, command: SimulationCommand) -> Result<(), SimulationError> {
        match command {
            SimulationCommand::UpdateResources(resources) => {
                self.snapshot.resources = resources;
            }
            SimulationCommand::UpdateModules(modules) => {
                self.snapshot.modules = modules;
            }
            SimulationCommand::SetSettings(settings) => {
                self.snapshot.settings = settings;
            }
        }
        Ok(())
    }

    pub fn simulate_offline(
        &mut self,
        seconds: f32,
        step: f32,
    ) -> Result<OfflineResult, SimulationError> {
        if seconds <= 0.0 || step <= 0.0 {
            let snapshot_json = self.export_snapshot_str()?;
            return Ok(OfflineResult {
                elapsed: 0.0,
                steps: 0,
                snapshot_json,
            });
        }
        let iterations = (seconds / step).ceil() as u32;
        for _ in 0..iterations {
            self.step(step);
        }
        let snapshot_json = self.export_snapshot_str()?;
        Ok(OfflineResult {
            elapsed: iterations as f32 * step,
            steps: iterations,
            snapshot_json,
        })
    }

    pub fn snapshot(&self) -> &SimulationSnapshot {
        &self.snapshot
    }

    pub fn get_drone_cargo_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.drones.cargo.offset_bytes / 4;
        let length = self.layout.drones.cargo.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_drone_battery_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.drones.battery.offset_bytes / 4;
        let length = self.layout.drones.battery.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_asteroid_max_ore_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.asteroids.max_ore.offset_bytes / 4;
        let length = self.layout.asteroids.max_ore.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_factory_resources_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.factories.resources.offset_bytes / 4;
        let length = self.layout.factories.resources.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_factory_energy_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.factories.energy.offset_bytes / 4;
        let length = self.layout.factories.energy.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_factory_max_energy_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.factories.max_energy.offset_bytes / 4;
        let length = self.layout.factories.max_energy.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_factory_upgrades_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.factories.upgrades.offset_bytes / 4;
        let length = self.layout.factories.upgrades.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }

    pub fn get_factory_refinery_state_mut(&mut self) -> &mut [f32] {
        let offset = self.layout.factories.refinery_state.offset_bytes / 4;
        let length = self.layout.factories.refinery_state.length;
        let slice = &mut self.data[offset..offset + length];
        unsafe { std::slice::from_raw_parts_mut(slice.as_mut_ptr() as *mut f32, length) }
    }
}

fn asteroid_count(snapshot: &SimulationSnapshot) -> usize {
    snapshot
        .extra
        .get("asteroids")
        .and_then(|value| value.as_array())
        .map(|arr| arr.len())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{
        MetricsSettings, Modules, Prestige, Resources, SaveMeta, SimulationSnapshot, StoreSettings,
    };
    use std::collections::BTreeMap;

    fn sample_snapshot() -> SimulationSnapshot {
        SimulationSnapshot {
            resources: Resources {
                ore: 10.0,
                ice: 0.0,
                metals: 0.0,
                crystals: 0.0,
                organics: 0.0,
                bars: 0.0,
                energy: 0.0,
                credits: 0.0,
            },
            modules: Modules {
                drone_bay: 1,
                refinery: 1,
                storage: 0,
                solar: 0,
                scanner: 0,
                hauler_depot: 0,
                logistics_hub: 0,
                routing_protocol: 0,
            },
            prestige: Prestige { cores: 0 },
            save: SaveMeta {
                last_save: 0,
                version: "0.0.0".to_string(),
            },
            settings: StoreSettings {
                autosave_enabled: true,
                autosave_interval: 30,
                offline_cap_hours: 8,
                notation: "standard".to_string(),
                throttle_floor: 0.2,
                show_trails: true,
                show_hauler_ships: true,
                show_debug_panel: false,
                performance_profile: "high".to_string(),
                inspector_collapsed: false,
                metrics: MetricsSettings {
                    enabled: true,
                    interval_seconds: 5,
                    retention_seconds: 300,
                },
            },
            rng_seed: Some(7),
            drone_flights: vec![],
            factories: vec![],
            selected_factory_id: None,
            drone_owners: BTreeMap::new(),
            logistics_queues: None,
            spec_techs: None,
            spec_tech_spent: None,
            prestige_investments: None,
            extra: BTreeMap::new(),
        }
    }

    #[test]
    fn round_trips_snapshot_json() {
        let snapshot = sample_snapshot();
        let mut state =
            GameState::from_snapshot(snapshot.clone()).expect("snapshot should be valid");
        let json = state.export_snapshot_str().expect("should serialize");
        state
            .load_snapshot_str(&json)
            .expect("should parse and validate snapshot");
        assert_eq!(state.snapshot().resources.ore, snapshot.resources.ore);
        assert_eq!(
            state.snapshot().modules.drone_bay,
            snapshot.modules.drone_bay
        );
    }

    #[test]
    fn layout_tracks_entity_counts() {
        let mut snapshot = sample_snapshot();
        snapshot.drone_flights = vec![];
        snapshot.factories = vec![Default::default(), Default::default()];
        let state = GameState::from_snapshot(snapshot).expect("layout should compute");
        assert_eq!(state.layout.factories.positions.length, 6);
        assert!(state.layout.total_size_bytes > 0);
    }

    #[test]
    fn offline_simulation_accumulates_time() {
        let snapshot = sample_snapshot();
        let mut state = GameState::from_snapshot(snapshot).expect("snapshot should be valid");
        let result = state
            .simulate_offline(1.2, 0.5)
            .expect("offline sim should run");
        assert_eq!(result.steps, 3);
        assert!((result.elapsed - 1.5).abs() < 0.001);
        assert!(state.game_time > 0.0);
    }
}
