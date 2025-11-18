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

#[derive(Debug)]
pub struct GameState {
    snapshot: SimulationSnapshot,
    rng: Mulberry32,
    pub layout: EntityBufferLayout,
    pub game_time: f32,
}

impl GameState {
    pub fn from_snapshot(snapshot: SimulationSnapshot) -> Result<Self, SimulationError> {
        snapshot.ensure_required()?;
        let rng_seed = snapshot.rng_seed.unwrap_or(1);
        let layout = plan_layout(
            snapshot.drone_flights.len(),
            asteroid_count(&snapshot),
            snapshot.factories.len(),
        )?;
        Ok(Self {
            snapshot,
            rng: Mulberry32::new(rng_seed),
            layout,
            game_time: 0.0,
        })
    }

    pub fn load_snapshot_str(&mut self, payload: &str) -> Result<(), SimulationError> {
        let snapshot: SimulationSnapshot =
            serde_json::from_str(payload).map_err(SimulationError::parse)?;
        snapshot.ensure_required()?;
        self.layout = plan_layout(
            snapshot.drone_flights.len(),
            asteroid_count(&snapshot),
            snapshot.factories.len(),
        )?;
        self.rng = Mulberry32::new(snapshot.rng_seed.unwrap_or(1));
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
