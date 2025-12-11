use crate::buffers::EntityBufferLayout;
use crate::buffers::plan_layout;
use crate::constants::SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL;
use crate::error::SimulationError;
use crate::modifiers::get_resource_modifiers;
use crate::rng::Mulberry32;
use crate::schema::{Modules, Resources, SimulationSnapshot, StoreSettings};
use crate::systems::drone_ai::{self, AsteroidMetadata};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp;
use std::collections::BTreeMap;

/// Result of a single simulation tick.
#[derive(Clone, Debug, PartialEq)]
pub struct TickResult {
    /// The time delta used for this tick.
    pub dt: f32,
    /// The current total game time.
    pub game_time: f32,
    /// A sample from the RNG for verification.
    pub rng_sample: f32,
}

/// Result of an offline simulation run.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OfflineResult {
    /// Total simulated time in seconds.
    pub elapsed: f32,
    /// Number of steps executed.
    pub steps: u32,
    /// The final state serialized to JSON.
    pub snapshot_json: String,
}

/// Commands accepted by the simulation engine to modify state.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum SimulationCommand {
    /// Overwrites the global resource state.
    UpdateResources(Resources),
    /// Overwrites the global module state.
    UpdateModules(Modules),
    /// Overwrites the global settings.
    SetSettings(StoreSettings),

    /// Purchases a new module level, deducting costs.
    BuyModule {
        #[serde(rename = "moduleType")]
        module_type: String,
        #[serde(rename = "factoryId")]
        factory_id: Option<String>,
    },

    /// Performs a prestige reset, converting bars to cores.
    DoPrestige,

    /// Purchases an upgrade for a specific factory.
    PurchaseFactoryUpgrade {
        #[serde(rename = "factoryId")]
        factory_id: String,
        #[serde(rename = "upgradeType")]
        upgrade_type: String,
        #[serde(rename = "costVariant")]
        cost_variant: Option<String>,
    },

    /// Modifies the number of haulers assigned to a factory.
    AssignHauler {
        #[serde(rename = "factoryId")]
        factory_id: String,
        count: i32,
    },

    /// Imports a full game state from a JSON string.
    ImportPayload {
        #[serde(rename = "snapshotJson")]
        snapshot_json: String,
    },

    /// Spawns a new drone at the specified factory.
    SpawnDrone {
        #[serde(rename = "factoryId")]
        factory_id: String,
    },

    /// Marks an asteroid as depleted/recycled.
    RecycleAsteroid {
        #[serde(rename = "asteroidId")]
        asteroid_id: String,
    },
}

/// The core game state managed by the Rust engine.
/// Holds the current snapshot, RNG, memory layout, and entity buffers.
pub struct GameState {
    snapshot: SimulationSnapshot,
    rng: Mulberry32,
    /// Layout describing how entity data is mapped in the linear memory buffer.
    pub layout: EntityBufferLayout,
    game_time: f32,
    logistics_tick: f32,
    /// The linear memory buffer containing entity data (SoA layout).
    pub data: Vec<u32>,
    drone_id_to_index: BTreeMap<String, usize>,
    drone_index_to_id: Vec<String>,
    factory_id_to_index: BTreeMap<String, usize>,
    asteroid_id_to_index: BTreeMap<String, usize>,
    asteroid_metadata: Vec<AsteroidMetadata>,
}

impl GameState {
    /// Creates a new GameState from a simulation snapshot.
    /// Initializes the memory layout and populates buffers.
    pub fn from_snapshot(mut snapshot: SimulationSnapshot) -> Result<Self, SimulationError> {
        snapshot.schema_version = crate::schema::SCHEMA_VERSION.to_string();
        snapshot.ensure_required()?;
        let rng_seed = snapshot.rng_seed.unwrap_or(1);

        let drone_bay_level = snapshot.modules.drone_bay;
        let total_drone_count = cmp::max(1, drone_bay_level as usize);

        let factory_count = snapshot.factories.len();
        let asteroid_count = asteroid_count(&snapshot);

        let layout = plan_layout(
            total_drone_count,
            asteroid_count,
            factory_count,
        )?;

        // Ensure size is multiple of 4
        let size_u32 = layout.total_size_bytes.div_ceil(4);
        let data = vec![0; size_u32];

        let mut drone_id_to_index = BTreeMap::new();
        let mut next_index = 0;

        // 1. Map existing flights
        for flight in &snapshot.drone_flights {
            if next_index < total_drone_count {
                drone_id_to_index.insert(flight.drone_id.clone(), next_index);
                next_index += 1;
            }
        }

        // 2. Map other known owners
        for drone_id in snapshot.drone_owners.keys() {
            if !drone_id_to_index.contains_key(drone_id)
                && next_index < total_drone_count {
                    drone_id_to_index.insert(drone_id.clone(), next_index);
                    next_index += 1;
                }
        }

        // 3. Fill remaining slots
        while next_index < total_drone_count {
            let id = format!("drone-rust-{}", next_index);
            drone_id_to_index.insert(id, next_index);
            next_index += 1;
        }

        let mut factory_id_to_index = BTreeMap::new();
        for (i, factory) in snapshot.factories.iter().enumerate() {
            factory_id_to_index.insert(factory.id.clone(), i);
        }

        let mut asteroid_id_to_index = BTreeMap::new();
        if let Some(asteroids) = asteroid_array(&snapshot.extra) {
            for (i, asteroid) in asteroids.iter().enumerate() {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    asteroid_id_to_index.insert(id.to_string(), i);
                }
            }
        }

        let drone_index_to_id = build_drone_index_to_id(&drone_id_to_index, total_drone_count);
        let asteroid_metadata = drone_ai::extract_asteroid_metadata(&snapshot, &asteroid_id_to_index);

        let mut state = Self {
            game_time: snapshot.game_time,
            snapshot,
            rng: Mulberry32::new(rng_seed),
            layout,
            logistics_tick: 0.0,
            data,
            drone_id_to_index,
            drone_index_to_id,
            factory_id_to_index,
            asteroid_id_to_index,
            asteroid_metadata,
        };

        burn_rng_for_asteroids(&mut state.rng, asteroid_count);
        state.initialize_data_from_snapshot();
        Ok(state)
    }

    /// Loads a new state from a JSON string payload.
    /// Re-initializes layout and buffers to match the new snapshot.
    pub fn load_snapshot_str(&mut self, payload: &str) -> Result<(), SimulationError> {
        let mut snapshot: SimulationSnapshot =
            serde_json::from_str(payload).map_err(SimulationError::parse)?;
        snapshot.schema_version = crate::schema::SCHEMA_VERSION.to_string();
        snapshot.ensure_required()?;

        let drone_bay_level = snapshot.modules.drone_bay;
        let total_drone_count = cmp::max(1, drone_bay_level as usize);

        let factory_count = snapshot.factories.len();
        let asteroid_count = asteroid_count(&snapshot);

        self.layout = plan_layout(
            total_drone_count,
            asteroid_count,
            factory_count,
        )?;
        let size_u32 = self.layout.total_size_bytes.div_ceil(4);
        self.data = vec![0; size_u32];
        self.rng = Mulberry32::new(snapshot.rng_seed.unwrap_or(1));

        self.drone_id_to_index.clear();
        let mut next_index = 0;

        for flight in &snapshot.drone_flights {
            if next_index < total_drone_count {
                self.drone_id_to_index.insert(flight.drone_id.clone(), next_index);
                next_index += 1;
            }
        }

        for drone_id in snapshot.drone_owners.keys() {
            if !self.drone_id_to_index.contains_key(drone_id)
                && next_index < total_drone_count {
                    self.drone_id_to_index.insert(drone_id.clone(), next_index);
                    next_index += 1;
                }
        }

        while next_index < total_drone_count {
            let id = format!("drone-rust-{}", next_index);
            self.drone_id_to_index.insert(id, next_index);
            next_index += 1;
        }

        self.factory_id_to_index.clear();
        for (i, factory) in snapshot.factories.iter().enumerate() {
            self.factory_id_to_index.insert(factory.id.clone(), i);
        }

        self.asteroid_id_to_index.clear();
        if let Some(asteroids) = asteroid_array(&snapshot.extra) {
            for (i, asteroid) in asteroids.iter().enumerate() {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    self.asteroid_id_to_index.insert(id.to_string(), i);
                }
            }
        }

        self.game_time = snapshot.game_time;
        self.snapshot = snapshot;
        self.drone_index_to_id = build_drone_index_to_id(&self.drone_id_to_index, total_drone_count);
        self.asteroid_metadata =
            drone_ai::extract_asteroid_metadata(&self.snapshot, &self.asteroid_id_to_index);
        burn_rng_for_asteroids(&mut self.rng, asteroid_count);
        self.initialize_data_from_snapshot();
        Ok(())
    }

    fn initialize_data_from_snapshot(&mut self) {
        // Initialize globals
        self.sync_globals_to_buffer();

        // Initialize factories
        let factories = &self.snapshot.factories;
        let factory_map = &self.factory_id_to_index;
        let layout = &self.layout;
        let data = &mut self.data;

        for factory in factories {
            if let Some(&index) = factory_map.get(&factory.id) {
                let offset = layout.factories.positions.offset_bytes / 4 + index * 3;
                data[offset] = factory.position[0].to_bits();
                data[offset + 1] = factory.position[1].to_bits();
                data[offset + 2] = factory.position[2].to_bits();

                let offset = layout.factories.resources.offset_bytes / 4 + index * 7;
                data[offset] = factory.resources.ore.to_bits();
                data[offset + 1] = factory.resources.ice.to_bits();
                data[offset + 2] = factory.resources.metals.to_bits();
                data[offset + 3] = factory.resources.crystals.to_bits();
                data[offset + 4] = factory.resources.organics.to_bits();
                data[offset + 5] = factory.resources.bars.to_bits();
                data[offset + 6] = factory.resources.credits.to_bits();

                let offset = layout.factories.energy.offset_bytes / 4 + index;
                data[offset] = factory.energy.to_bits();

                let offset = layout.factories.max_energy.offset_bytes / 4 + index;
                data[offset] = factory.energy_capacity.to_bits();

                let offset = layout.factories.upgrades.offset_bytes / 4 + index * 5;
                data[offset] = (factory.upgrades.docking as f32).to_bits();
                data[offset + 1] = (factory.upgrades.refine as f32).to_bits();
                data[offset + 2] = (factory.upgrades.storage as f32).to_bits();
                data[offset + 3] = (factory.upgrades.energy as f32).to_bits();
                data[offset + 4] = (factory.upgrades.solar as f32).to_bits();

                let offset = layout.factories.haulers_assigned.offset_bytes / 4 + index;
                data[offset] = (factory.haulers_assigned.unwrap_or(0) as f32).to_bits();
            }
        }

        // Initialize drones (defaults)
        let drone_map = &self.drone_id_to_index;

        for (drone_id, &index) in drone_map {
             let mut owner_idx = 0;
             if let Some(Some(factory_id)) = self.snapshot.drone_owners.get(drone_id) {
                 if let Some(&idx) = factory_map.get(factory_id) {
                     owner_idx = idx;
                 }
             }

             let mut fx = 0.0;
             let mut fy = 0.0;
             let mut fz = 0.0;

             if layout.factories.positions.length > 0 {
                 let f_offset = layout.factories.positions.offset_bytes / 4 + owner_idx * 3;
                 fx = f32::from_bits(data[f_offset]);
                 fy = f32::from_bits(data[f_offset + 1]);
                 fz = f32::from_bits(data[f_offset + 2]);
             }

             let offset = layout.drones.positions.offset_bytes / 4 + index * 3;
             data[offset] = fx.to_bits();
             data[offset + 1] = fy.to_bits();
             data[offset + 2] = fz.to_bits();

             let offset = layout.drones.owner_factory_index.offset_bytes / 4 + index;
             data[offset] = (owner_idx as f32).to_bits();

             let offset = layout.drones.target_region_index.offset_bytes / 4 + index;
             data[offset] = (-1.0f32).to_bits();

             let offset = layout.drones.target_factory_index.offset_bytes / 4 + index;
             data[offset] = (-1.0f32).to_bits();

             let offset = layout.drones.target_asteroid_index.offset_bytes / 4 + index;
             data[offset] = (-1.0f32).to_bits();
        }

        // Initialize drones (flights)
        let flights = &self.snapshot.drone_flights;
        let asteroid_map = &self.asteroid_id_to_index;

        for flight in flights {
            if let Some(&index) = drone_map.get(&flight.drone_id) {
                let offset = layout.drones.positions.offset_bytes / 4 + index * 3;
                data[offset] = flight.travel.from[0].to_bits();
                data[offset + 1] = flight.travel.from[1].to_bits();
                data[offset + 2] = flight.travel.from[2].to_bits();

                let offset = layout.drones.states.offset_bytes / 4 + index;
                let state_val: f32 = match flight.state.as_str() {
                    "idle" => 0.0,
                    "toAsteroid" => 1.0,
                    "mining" => 2.0,
                    "returning" => 3.0,
                    "unloading" => 4.0,
                    _ => 0.0,
                };
                data[offset] = state_val.to_bits();

                let offset = layout.drones.cargo.offset_bytes / 4 + index;
                data[offset] = flight.cargo.to_bits();

                let offset = layout.drones.battery.offset_bytes / 4 + index;
                data[offset] = flight.battery.to_bits();

                let offset = layout.drones.max_battery.offset_bytes / 4 + index;
                data[offset] = flight.max_battery.to_bits();

                let offset = layout.drones.capacity.offset_bytes / 4 + index;
                data[offset] = flight.capacity.to_bits();

                let offset = layout.drones.mining_rate.offset_bytes / 4 + index;
                data[offset] = flight.mining_rate.to_bits();

                let offset = layout.drones.charging.offset_bytes / 4 + index;
                data[offset] = (if flight.charging { 1.0f32 } else { 0.0f32 }).to_bits();

                let offset = layout.drones.target_asteroid_index.offset_bytes / 4 + index;
                let mut target_idx = -1.0;
                if let Some(target_id) = &flight.target_asteroid_id {
                    if let Some(&idx) = asteroid_map.get(target_id) {
                        target_idx = idx as f32;
                    }
                }
                data[offset] = target_idx.to_bits();

                let offset = layout.drones.target_factory_index.offset_bytes / 4 + index;
                let mut target_idx = -1.0;
                if let Some(target_id) = &flight.target_factory_id {
                    if let Some(&idx) = factory_map.get(target_id) {
                        target_idx = idx as f32;
                    }
                }
                data[offset] = target_idx.to_bits();

                let offset = layout.drones.owner_factory_index.offset_bytes / 4 + index;
                let mut owner_idx = -1.0;
                if let Some(owner_id) = &flight.owner_factory_id {
                    if let Some(&idx) = factory_map.get(owner_id) {
                        owner_idx = idx as f32;
                    }
                }
                data[offset] = owner_idx.to_bits();

                let offset = layout.drones.target_region_index.offset_bytes / 4 + index;
                data[offset] = (-1.0f32).to_bits();

                if let Some(profile) = &flight.cargo_profile {
                    let base_offset = layout.drones.cargo_profile.offset_bytes / 4 + index * 5;
                    data[base_offset] = profile.ore.to_bits();
                    data[base_offset + 1] = profile.ice.to_bits();
                    data[base_offset + 2] = profile.metals.to_bits();
                    data[base_offset + 3] = profile.crystals.to_bits();
                    data[base_offset + 4] = profile.organics.to_bits();
                }
            }
        }

        // Initialize asteroids
        if let Some(asteroids) = asteroid_array(&self.snapshot.extra) {
            for asteroid in asteroids {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    if let Some(&index) = asteroid_map.get(id) {
                        if let Some(pos) = asteroid.get("position").and_then(|v| v.as_array()) {
                            if pos.len() >= 3 {
                                let offset = layout.asteroids.positions.offset_bytes / 4 + index * 3;
                                data[offset] = (pos[0].as_f64().unwrap_or(0.0) as f32).to_bits();
                                data[offset + 1] = (pos[1].as_f64().unwrap_or(0.0) as f32).to_bits();
                                data[offset + 2] = (pos[2].as_f64().unwrap_or(0.0) as f32).to_bits();
                            }
                        }

                        if let Some(ore) = asteroid.get("oreRemaining").and_then(|v| v.as_f64()) {
                            let offset = layout.asteroids.ore_remaining.offset_bytes / 4 + index;
                            data[offset] = (ore as f32).to_bits();
                        }

                        if let Some(max_ore) = asteroid.get("maxOre").and_then(|v| v.as_f64()) {
                            let offset = layout.asteroids.max_ore.offset_bytes / 4 + index;
                            data[offset] = (max_ore as f32).to_bits();
                        }

                        // Initialize resource profile
                        if let Some(profile) = asteroid.get("resourceProfile").and_then(|v| v.as_object()) {
                            let base_offset = layout.asteroids.resource_profile.offset_bytes / 4 + index * 5;
                            let ore = profile.get("ore").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            let ice = profile.get("ice").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            let metals = profile.get("metals").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            let crystals = profile.get("crystals").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                            let organics = profile.get("organics").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;

                            data[base_offset] = ore.to_bits();
                            data[base_offset + 1] = ice.to_bits();
                            data[base_offset + 2] = metals.to_bits();
                            data[base_offset + 3] = crystals.to_bits();
                            data[base_offset + 4] = organics.to_bits();
                        } else {
                            // Default to 100% ore if missing
                            let base_offset = layout.asteroids.resource_profile.offset_bytes / 4 + index * 5;
                            data[base_offset] = (1.0f32).to_bits();
                            data[base_offset + 1] = (0.0f32).to_bits();
                            data[base_offset + 2] = (0.0f32).to_bits();
                            data[base_offset + 3] = (0.0f32).to_bits();
                            data[base_offset + 4] = (0.0f32).to_bits();
                        }
                    }
                }
            }
        }
    }

    /// Serializes the current internal state back to a JSON snapshot string.
    pub fn export_snapshot_str(&mut self) -> Result<String, SimulationError> {
        self.sync_data_to_snapshot();
        serde_json::to_string(&self.snapshot).map_err(SimulationError::parse)
    }

    /// Serializes the logistics queues to a JSON string.
    pub fn get_logistics_queues_str(&self) -> Result<String, SimulationError> {
        let queues = self.snapshot.logistics_queues.as_ref().cloned().unwrap_or_default();
        serde_json::to_string(&queues).map_err(SimulationError::parse)
    }

    /// Syncs buffer data back to the snapshot.
    pub fn sync_data_to_snapshot(&mut self) {
        // Sync factories
        for (i, factory) in self.snapshot.factories.iter_mut().enumerate() {
            if i >= self.layout.factories.resources.length { break; }

            // Resources
            let offset = self.layout.factories.resources.offset_bytes / 4 + i * 7;
            factory.resources.ore = f32::from_bits(self.data[offset]);
            factory.resources.ice = f32::from_bits(self.data[offset + 1]);
            factory.resources.metals = f32::from_bits(self.data[offset + 2]);
            factory.resources.crystals = f32::from_bits(self.data[offset + 3]);
            factory.resources.organics = f32::from_bits(self.data[offset + 4]);
            factory.resources.bars = f32::from_bits(self.data[offset + 5]);
            factory.resources.credits = f32::from_bits(self.data[offset + 6]);

            // Energy
            let offset = self.layout.factories.energy.offset_bytes / 4 + i;
            factory.energy = f32::from_bits(self.data[offset]);

            let offset = self.layout.factories.max_energy.offset_bytes / 4 + i;
            factory.energy_capacity = f32::from_bits(self.data[offset]);

            // Upgrades
            let offset = self.layout.factories.upgrades.offset_bytes / 4 + i * 5;
            factory.upgrades.docking = f32::from_bits(self.data[offset]) as i32;
            factory.upgrades.refine = f32::from_bits(self.data[offset + 1]) as i32;
            factory.upgrades.storage = f32::from_bits(self.data[offset + 2]) as i32;
            factory.upgrades.energy = f32::from_bits(self.data[offset + 3]) as i32;
            factory.upgrades.solar = f32::from_bits(self.data[offset + 4]) as i32;

            // Haulers
            let offset = self.layout.factories.haulers_assigned.offset_bytes / 4 + i;
            factory.haulers_assigned = Some(f32::from_bits(self.data[offset]) as i32);
        }

        // Sync drone flights
        for flight in self.snapshot.drone_flights.iter_mut() {
            if let Some(&idx) = self.drone_id_to_index.get(&flight.drone_id) {
                // Battery
                let offset = self.layout.drones.battery.offset_bytes / 4 + idx;
                flight.battery = f32::from_bits(self.data[offset]);

                // Cargo
                let offset = self.layout.drones.cargo.offset_bytes / 4 + idx;
                flight.cargo = f32::from_bits(self.data[offset]);

                // Max Battery, Capacity, Mining Rate
                let offset = self.layout.drones.max_battery.offset_bytes / 4 + idx;
                flight.max_battery = f32::from_bits(self.data[offset]);

                let offset = self.layout.drones.capacity.offset_bytes / 4 + idx;
                flight.capacity = f32::from_bits(self.data[offset]);

                let offset = self.layout.drones.mining_rate.offset_bytes / 4 + idx;
                flight.mining_rate = f32::from_bits(self.data[offset]);

                // Cargo Profile
                if let Some(profile) = &mut flight.cargo_profile {
                    let base_offset = self.layout.drones.cargo_profile.offset_bytes / 4 + idx * 5;
                    profile.ore = f32::from_bits(self.data[base_offset]);
                    profile.ice = f32::from_bits(self.data[base_offset + 1]);
                    profile.metals = f32::from_bits(self.data[base_offset + 2]);
                    profile.crystals = f32::from_bits(self.data[base_offset + 3]);
                    profile.organics = f32::from_bits(self.data[base_offset + 4]);
                }
            }
        }

        // Sync asteroid data (ore, position, maxOre, profile)
        if let Some(asteroids) = asteroid_array_mut(&mut self.snapshot.extra) {
            for asteroid in asteroids {
                if let Some(id) = asteroid.get("id").and_then(|v| v.as_str()) {
                    if let Some(&idx) = self.asteroid_id_to_index.get(id) {
                        let ore_offset = self.layout.asteroids.ore_remaining.offset_bytes / 4 + idx;
                        let ore = f32::from_bits(self.data[ore_offset]);

                        let pos_offset = self.layout.asteroids.positions.offset_bytes / 4 + idx * 3;
                        let px = f32::from_bits(self.data[pos_offset]);
                        let py = f32::from_bits(self.data[pos_offset + 1]);
                        let pz = f32::from_bits(self.data[pos_offset + 2]);

                        let max_ore_offset = self.layout.asteroids.max_ore.offset_bytes / 4 + idx;
                        let max_ore = f32::from_bits(self.data[max_ore_offset]);

                        let prof_offset = self.layout.asteroids.resource_profile.offset_bytes / 4 + idx * 5;

                        if let Some(obj) = asteroid.as_object_mut() {
                            obj.insert("oreRemaining".to_string(), serde_json::Value::from(ore));
                            obj.insert("maxOre".to_string(), serde_json::Value::from(max_ore));
                            obj.insert("position".to_string(), serde_json::json!([px, py, pz]));

                            let p0 = f32::from_bits(self.data[prof_offset]);
                            let p1 = f32::from_bits(self.data[prof_offset + 1]);
                            let p2 = f32::from_bits(self.data[prof_offset + 2]);
                            let p3 = f32::from_bits(self.data[prof_offset + 3]);
                            let p4 = f32::from_bits(self.data[prof_offset + 4]);

                            obj.insert("resourceProfile".to_string(), serde_json::json!({
                                "ore": p0,
                                "ice": p1,
                                "metals": p2,
                                "crystals": p3,
                                "organics": p4
                            }));
                        }
                    }
                }
            }
        }
    }

    /// Rebuilds the internal state (layout and buffers) from the current snapshot.
    /// This is used when the number of entities changes (e.g. buying modules).
    fn rebuild_state(&mut self) -> Result<(), SimulationError> {
        self.sync_data_to_snapshot();
        let new_state = GameState::from_snapshot(self.snapshot.clone())?;
        *self = new_state;
        Ok(())
    }

    /// Advances the simulation by dt seconds.
    /// Runs all systems (refinery, movement, power, mining, unload, AI).
    pub fn step(&mut self, dt: f32) -> TickResult {
        if dt.is_sign_negative() {
            return TickResult {
                dt: 0.0,
                game_time: self.game_time,
                rng_sample: self.rng.next_f32(),
            };
        }
        self.game_time += dt;

        let modifiers = get_resource_modifiers(
            &self.snapshot.resources,
            self.snapshot.prestige.cores,
            self.snapshot.prestige_investments.as_ref(),
            self.snapshot.spec_techs.as_ref(),
        );
        let sink_bonuses = crate::sinks::get_sink_bonuses(&self.snapshot);

        // SAFETY: All buffer sections are validated during layout planning.
        // The unsafe helper creates non-overlapping slices for each system call.
        // This is necessary because Rust's borrow checker cannot verify that
        // different BufferSections point to non-overlapping memory regions.
        unsafe {
            let data_ptr = self.data.as_mut_ptr();

            // Encapsulated helper to get mutable f32 slice from buffer section
            let get_slice_mut = |section: &crate::buffers::BufferSection| -> &mut [f32] {
                let offset_u32 = section.offset_bytes / 4;
                let ptr = data_ptr.add(offset_u32) as *mut f32;
                std::slice::from_raw_parts_mut(ptr, section.length)
            };

            // Global Refinery (Legacy/Module based)
            crate::systems::global_refinery::sys_global_refinery(
                &mut self.snapshot.resources,
                &self.snapshot.modules,
                self.snapshot.prestige.cores,
                dt,
                modifiers.refinery_yield_multiplier,
            );

            // Refinery System
            let resources = get_slice_mut(&self.layout.factories.resources);
            let refinery_state = get_slice_mut(&self.layout.factories.refinery_state);
            let haulers_assigned = get_slice_mut(&self.layout.factories.haulers_assigned);
            let energy = get_slice_mut(&self.layout.factories.energy);

            let idle_energy_per_sec: Vec<f32> = self
                .snapshot
                .factories
                .iter()
                .map(|f| f.idle_energy_per_sec)
                .collect();
            let energy_per_refine: Vec<f32> = self
                .snapshot
                .factories
                .iter()
                .map(|f| f.energy_per_refine)
                .collect();
            let refine_slots: Vec<i32> = self
                .snapshot
                .factories
                .iter()
                .map(|f| f.refine_slots)
                .collect();
            let storage_capacity: Vec<f32> = self
                .snapshot
                .factories
                .iter()
                .map(|f| f.storage_capacity)
                .collect();
            let effective_energy_capacity: Vec<f32> = self
                .snapshot
                .factories
                .iter()
                .map(|f| {
                    let bonus = SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL * self.snapshot.modules.solar as f32;
                    (f.energy_capacity + bonus) * modifiers.energy_storage_multiplier
                })
                .collect();

            crate::systems::refinery::sys_refinery(
                resources,
                refinery_state,
                haulers_assigned,
                energy,
                &idle_energy_per_sec,
                &energy_per_refine,
                &refine_slots,
                &storage_capacity,
                &effective_energy_capacity,
                dt,
                modifiers.energy_drain_multiplier,
                modifiers.storage_capacity_multiplier,
                modifiers.drone_production_speed_multiplier,
                modifiers.refinery_yield_multiplier,
            );

            // Movement System
            let drone_positions = get_slice_mut(&self.layout.drones.positions);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_target_asteroid_index = get_slice_mut(&self.layout.drones.target_asteroid_index);
            let drone_target_factory_index = get_slice_mut(&self.layout.drones.target_factory_index);
            let factory_positions = get_slice_mut(&self.layout.factories.positions);

            crate::systems::movement::sys_movement(
                &mut self.snapshot.drone_flights,
                &self.drone_id_to_index,
                &self.factory_id_to_index,
                &self.asteroid_id_to_index,
                drone_positions,
                drone_states,
                drone_battery,
                drone_target_asteroid_index,
                drone_target_factory_index,
                factory_positions,
                dt,
                self.snapshot.settings.throttle_floor,
                modifiers.energy_drain_multiplier,
            );

            // Power System
            let factory_energy = get_slice_mut(&self.layout.factories.energy);
            let factory_max_energy = get_slice_mut(&self.layout.factories.max_energy);
            let factory_upgrades = get_slice_mut(&self.layout.factories.upgrades);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_max_battery = get_slice_mut(&self.layout.drones.max_battery);
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_owner_factory_index = get_slice_mut(&self.layout.drones.owner_factory_index);
            let drone_charging = get_slice_mut(&self.layout.drones.charging);

            crate::systems::power::sys_power(
                &mut self.snapshot.resources,
                &self.snapshot.modules,
                factory_energy,
                factory_max_energy,
                factory_upgrades,
                drone_battery,
                drone_max_battery,
                drone_states,
                drone_owner_factory_index,
                drone_target_factory_index,
                drone_charging,
                &self.drone_id_to_index,
                &self.factory_id_to_index,
                dt,
                modifiers.energy_generation_multiplier,
                modifiers.energy_storage_multiplier,
            );

            // Mining System
            let drone_cargo = get_slice_mut(&self.layout.drones.cargo);
            let drone_cargo_profile = get_slice_mut(&self.layout.drones.cargo_profile);
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_target_asteroid_index = get_slice_mut(&self.layout.drones.target_asteroid_index);
            let drone_capacity = get_slice_mut(&self.layout.drones.capacity);
            let drone_mining_rate = get_slice_mut(&self.layout.drones.mining_rate);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_max_battery = get_slice_mut(&self.layout.drones.max_battery);
            let asteroid_ore_remaining = get_slice_mut(&self.layout.asteroids.ore_remaining);
            let asteroid_resource_profile = get_slice_mut(&self.layout.asteroids.resource_profile);

            crate::systems::mining::sys_mining(
                drone_states,
                drone_cargo,
                drone_cargo_profile,
                drone_target_asteroid_index,
                drone_capacity,
                drone_mining_rate,
                drone_battery,
                drone_max_battery,
                asteroid_ore_remaining,
                asteroid_resource_profile,
                dt,
                self.snapshot.settings.throttle_floor,
                modifiers.energy_drain_multiplier,
                sink_bonuses.ore_yield_multiplier,
            );

            // Unload System
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_cargo = get_slice_mut(&self.layout.drones.cargo);
            let drone_cargo_profile = get_slice_mut(&self.layout.drones.cargo_profile);
            let drone_target_factory_index = get_slice_mut(&self.layout.drones.target_factory_index);
            let drone_owner_factory_index = get_slice_mut(&self.layout.drones.owner_factory_index);
            let drone_target_region_index = get_slice_mut(&self.layout.drones.target_region_index);
            let drone_positions = get_slice_mut(&self.layout.drones.positions);
            let factory_positions = get_slice_mut(&self.layout.factories.positions);
            let factory_resources = get_slice_mut(&self.layout.factories.resources);

            crate::systems::unload::sys_unload(
                drone_states,
                drone_cargo,
                drone_cargo_profile,
                drone_target_factory_index,
                drone_owner_factory_index,
                drone_target_region_index,
                drone_positions,
                factory_positions,
                factory_resources,
                &mut self.snapshot.resources,
                &mut self.snapshot.factories,
                &self.drone_index_to_id,
                dt,
            );

            // Drone AI System
            let drone_states = get_slice_mut(&self.layout.drones.states);
            let drone_cargo = get_slice_mut(&self.layout.drones.cargo);
            let drone_positions = get_slice_mut(&self.layout.drones.positions);
            let drone_target_asteroid_index = get_slice_mut(&self.layout.drones.target_asteroid_index);
            let drone_target_factory_index = get_slice_mut(&self.layout.drones.target_factory_index);
            let drone_target_region_index = get_slice_mut(&self.layout.drones.target_region_index);
            let drone_owner_factory_index = get_slice_mut(&self.layout.drones.owner_factory_index);
            let factory_positions = get_slice_mut(&self.layout.factories.positions);
            let asteroid_positions = get_slice_mut(&self.layout.asteroids.positions);
            let asteroid_ore = get_slice_mut(&self.layout.asteroids.ore_remaining);
            let drone_battery = get_slice_mut(&self.layout.drones.battery);
            let drone_max_battery = get_slice_mut(&self.layout.drones.max_battery);
            let drone_capacity = get_slice_mut(&self.layout.drones.capacity);
            let drone_mining_rate = get_slice_mut(&self.layout.drones.mining_rate);

            crate::systems::drone_ai::sys_drone_ai(
                &mut self.snapshot.drone_flights,
                drone_states,
                drone_cargo,
                drone_positions,
                drone_battery,
                drone_max_battery,
                drone_capacity,
                drone_mining_rate,
                drone_target_asteroid_index,
                drone_target_factory_index,
                drone_target_region_index,
                drone_owner_factory_index,
                &self.drone_index_to_id,
                &self.drone_id_to_index,
                &self.factory_id_to_index,
                &self.asteroid_id_to_index,
                &mut self.snapshot.factories,
                factory_positions,
                asteroid_positions,
                &self.asteroid_metadata,
                asteroid_ore,
                &mut self.rng,
                &modifiers,
                &self.snapshot.modules,
                &sink_bonuses,
            );

            // Asteroid Lifecycle System
            let asteroid_positions = get_slice_mut(&self.layout.asteroids.positions);
            let asteroid_ore = get_slice_mut(&self.layout.asteroids.ore_remaining);
            let asteroid_max_ore = get_slice_mut(&self.layout.asteroids.max_ore);
            let asteroid_resource_profile = get_slice_mut(&self.layout.asteroids.resource_profile);

            crate::systems::asteroids::sys_asteroids(
                asteroid_positions,
                asteroid_ore,
                asteroid_max_ore,
                asteroid_resource_profile,
                &mut self.asteroid_metadata,
                &mut self.rng,
                &sink_bonuses,
                self.snapshot.modules.scanner,
                dt,
            );
        }

        self.sync_data_to_snapshot();

        // Logistics System
        if let Some(logistics_queues) = &mut self.snapshot.logistics_queues {
            self.logistics_tick += dt;
            let run_scheduler = self.logistics_tick >= 2.0;
            if run_scheduler {
                self.logistics_tick -= 2.0;
            }

            crate::systems::logistics::sys_logistics(
                logistics_queues,
                &mut self.snapshot.factories,
                &mut self.snapshot.resources,
                &self.snapshot.modules,
                &modifiers,
                self.game_time,
                run_scheduler,
            );
        }

        for i in 0..self.snapshot.factories.len() {
            self.sync_factory_to_buffer(i);
        }

        self.sync_globals_to_buffer();

        TickResult {
            dt,
            game_time: self.game_time,
            rng_sample: self.rng.next_f32(),
        }
    }

    // ... rest of file ...
    /// Applies a SimulationCommand to modify the state.
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
            SimulationCommand::BuyModule { module_type, factory_id: _ } => {
                self.handle_buy_module(&module_type)?;
            }
            SimulationCommand::DoPrestige => {
                self.handle_prestige()?;
            }
            SimulationCommand::PurchaseFactoryUpgrade {
                factory_id,
                upgrade_type,
                cost_variant,
            } => {
                self.handle_factory_upgrade(&factory_id, &upgrade_type, cost_variant.as_deref())?;
            }
            SimulationCommand::AssignHauler { factory_id, count } => {
                self.handle_assign_hauler(&factory_id, count)?;
            }
            SimulationCommand::ImportPayload { snapshot_json } => {
                self.load_snapshot_str(&snapshot_json)?;
            }
            SimulationCommand::SpawnDrone { factory_id } => {
                self.handle_spawn_drone(&factory_id)?;
            }
            SimulationCommand::RecycleAsteroid { asteroid_id } => {
                self.handle_recycle_asteroid(&asteroid_id)?;
            }
        }
        self.sync_globals_to_buffer();
        Ok(())
    }

    /// Runs the simulation for a specified duration in offline mode.
    /// Useful for catch-up mechanics.
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
        let sink_bonuses = crate::sinks::get_sink_bonuses(&self.snapshot);
        let mut elapsed = 0.0f32;
        let mut steps = 0u32;

        while elapsed < seconds {
            let dt = (seconds - elapsed).min(step);
            if dt <= 0.0 {
                break;
            }

            let modifiers = get_resource_modifiers(
                &self.snapshot.resources,
                self.snapshot.prestige.cores,
                self.snapshot.prestige_investments.as_ref(),
                self.snapshot.spec_techs.as_ref(),
            );
            let ore_before = self.snapshot.resources.ore;
            let bars_before = self.snapshot.resources.bars;

            crate::systems::global_refinery::sys_global_refinery(
                &mut self.snapshot.resources,
                &self.snapshot.modules,
                self.snapshot.prestige.cores,
                dt,
                modifiers.refinery_yield_multiplier * sink_bonuses.refinery_yield_multiplier,
            );

            let bars_delta = self.snapshot.resources.bars - bars_before;
            if bars_delta > 0.0 && sink_bonuses.offline_progress_multiplier > 1.0 {
                let bonus = bars_delta * (sink_bonuses.offline_progress_multiplier - 1.0);
                self.snapshot.resources.bars += bonus;
            }

            let _ore_delta = ore_before - self.snapshot.resources.ore;
            elapsed += dt;
            steps += 1;
        }

        self.game_time += elapsed;
        self.sync_globals_to_buffer();
        let snapshot_json = self.export_snapshot_str()?;
        Ok(OfflineResult { elapsed, steps, snapshot_json })
    }

    /// Returns a reference to the current snapshot.
    pub fn snapshot(&self) -> &SimulationSnapshot {
        &self.snapshot
    }

    /// Accessor for drone cargo buffer (for WASM interop).
    pub fn get_drone_cargo_mut(&mut self) -> &mut [f32] {
        self.layout.drones.cargo.as_f32_slice_mut(&mut self.data)
            .expect("drone cargo buffer should be valid")
    }

    /// Accessor for drone battery buffer (for WASM interop).
    pub fn get_drone_battery_mut(&mut self) -> &mut [f32] {
        self.layout.drones.battery.as_f32_slice_mut(&mut self.data)
            .expect("drone battery buffer should be valid")
    }

    /// Accessor for asteroid max ore buffer (for WASM interop).
    pub fn get_asteroid_max_ore_mut(&mut self) -> &mut [f32] {
        self.layout.asteroids.max_ore.as_f32_slice_mut(&mut self.data)
            .expect("asteroid max_ore buffer should be valid")
    }

    /// Accessor for asteroid ore remaining buffer (for WASM interop).
    pub fn get_asteroid_ore_remaining_mut(&mut self) -> &mut [f32] {
        self.layout.asteroids.ore_remaining.as_f32_slice_mut(&mut self.data)
            .expect("asteroid ore_remaining buffer should be valid")
    }

    /// Accessor for factory resources buffer (for WASM interop).
    pub fn get_factory_resources_mut(&mut self) -> &mut [f32] {
        self.layout.factories.resources.as_f32_slice_mut(&mut self.data)
            .expect("factory resources buffer should be valid")
    }

    /// Accessor for factory energy buffer (for WASM interop).
    pub fn get_factory_energy_mut(&mut self) -> &mut [f32] {
        self.layout.factories.energy.as_f32_slice_mut(&mut self.data)
            .expect("factory energy buffer should be valid")
    }

    /// Accessor for factory max energy buffer (for WASM interop).
    pub fn get_factory_max_energy_mut(&mut self) -> &mut [f32] {
        self.layout.factories.max_energy.as_f32_slice_mut(&mut self.data)
            .expect("factory max_energy buffer should be valid")
    }

    /// Accessor for factory upgrades buffer (for WASM interop).
    pub fn get_factory_upgrades_mut(&mut self) -> &mut [f32] {
        self.layout.factories.upgrades.as_f32_slice_mut(&mut self.data)
            .expect("factory upgrades buffer should be valid")
    }

    /// Accessor for factory refinery state buffer (for WASM interop).
    pub fn get_factory_refinery_state_mut(&mut self) -> &mut [f32] {
        self.layout.factories.refinery_state.as_f32_slice_mut(&mut self.data)
            .expect("factory refinery_state buffer should be valid")
    }

    // Command handlers

    fn calculate_exponential_cost(base: f32, growth: f32, level: i32) -> f32 {
        (base * growth.powi(level.max(0))).ceil()
    }

    fn compute_prestige_gain(bars: f32) -> i32 {
        if bars <= 0.0 {
            return 0;
        }
        (bars / 1000.0).powf(0.6).floor() as i32
    }

    fn handle_buy_module(&mut self, module_type: &str) -> Result<(), SimulationError> {
        let (current_level, base_cost) = match module_type {
            "droneBay" => (self.snapshot.modules.drone_bay, 4.0),
            "refinery" => (self.snapshot.modules.refinery, 8.0),
            "storage" => (self.snapshot.modules.storage, 3.0),
            "solar" => (self.snapshot.modules.solar, 4.0),
            "scanner" => (self.snapshot.modules.scanner, 12.0),
            "haulerDepot" => (self.snapshot.modules.hauler_depot, 60.0),
            "logisticsHub" => (self.snapshot.modules.logistics_hub, 80.0),
            "routingProtocol" => (self.snapshot.modules.routing_protocol, 100.0),
            _ => return Ok(()), // Unknown module, ignore
        };

        let cost = Self::calculate_exponential_cost(
            base_cost,
            crate::constants::UPGRADE_GROWTH,
            current_level,
        );
        if self.snapshot.resources.bars < cost {
            return Ok(()); // Not enough bars
        }

        self.snapshot.resources.bars -= cost;
        match module_type {
            "droneBay" => {
                self.snapshot.modules.drone_bay += 1;
                self.rebuild_state()?;
            }
            "refinery" => self.snapshot.modules.refinery += 1,
            "storage" => self.snapshot.modules.storage += 1,
            "solar" => self.snapshot.modules.solar += 1,
            "scanner" => self.snapshot.modules.scanner += 1,
            "haulerDepot" => self.snapshot.modules.hauler_depot += 1,
            "logisticsHub" => self.snapshot.modules.logistics_hub += 1,
            "routingProtocol" => self.snapshot.modules.routing_protocol += 1,
            _ => {}
        }
        Ok(())
    }

    fn handle_spawn_drone(&mut self, factory_id: &str) -> Result<(), SimulationError> {
        // 1. Increase capacity if needed (or assume command implies capacity increase/force)
        // To be safe, we increment drone_bay.
        self.snapshot.modules.drone_bay += 1;

        // 2. Assign owner in snapshot
        let drone_id = format!("drone-spawned-{}", self.rng.next_u32());
        self.snapshot.drone_owners.insert(drone_id, Some(factory_id.to_string()));

        // 3. Rebuild state
        self.rebuild_state()?;
        Ok(())
    }

    fn handle_prestige(&mut self) -> Result<(), SimulationError> {
        let threshold = crate::constants::PRESTIGE_THRESHOLD;

        if self.snapshot.resources.bars < threshold {
            return Ok(());
        }

        let gain = Self::compute_prestige_gain(self.snapshot.resources.bars);

        self.snapshot.prestige.cores += gain;

        // Reset resources to initial state
        self.snapshot.resources = Resources {
            ore: 0.0,
            ice: 0.0,
            metals: 0.0,
            crystals: 0.0,
            organics: 0.0,
            bars: 0.0,
            energy: crate::constants::BASE_ENERGY_CAP,
            credits: 0.0,
        };

        // Reset modules to initial state
        self.snapshot.modules = Modules {
            drone_bay: 1,
            refinery: 0,
            storage: 0,
            solar: 0,
            scanner: 0,
            hauler_depot: 0,
            logistics_hub: 0,
            routing_protocol: 0,
        };

        // Clear drone flights and owners
        self.snapshot.drone_flights.clear();
        self.snapshot.drone_owners.clear();

        // Note: Factory reset is handled by TypeScript layer since
        // factory creation involves position randomization

        self.rebuild_state()?;
        Ok(())
    }

    fn handle_factory_upgrade(
        &mut self,
        factory_id: &str,
        upgrade_type: &str,
        cost_variant: Option<&str>,
    ) -> Result<(), SimulationError> {
        let factory_idx = match self.factory_id_to_index.get(factory_id) {
            Some(&idx) => idx,
            None => return Ok(()), // Factory not found
        };

        if factory_idx >= self.snapshot.factories.len() {
            return Ok(());
        }

        let factory = &self.snapshot.factories[factory_idx];
        let current_level = match upgrade_type {
            "docking" => factory.upgrades.docking,
            "refine" => factory.upgrades.refine,
            "storage" => factory.upgrades.storage,
            "energy" => factory.upgrades.energy,
            "solar" => factory.upgrades.solar,
            _ => return Ok(()), // Unknown upgrade
        };

        let growth = crate::constants::FACTORY_UPGRADE_GROWTH;
        let mut cost_entries: Vec<(&str, f32)> = Vec::new();

        match cost_variant {
            Some("metals") if upgrade_type == "docking" => cost_entries.push((
                "metals",
                Self::calculate_exponential_cost(50.0, growth, current_level),
            )),
            Some("organics") if upgrade_type == "refine" => {
                cost_entries.push((
                    "organics",
                    Self::calculate_exponential_cost(25.0, growth, current_level),
                ));
                cost_entries.push((
                    "metals",
                    Self::calculate_exponential_cost(25.0, growth, current_level),
                ));
            }
            Some("organics") if upgrade_type == "storage" => cost_entries.push((
                "organics",
                Self::calculate_exponential_cost(20.0, growth, current_level),
            )),
            Some("ice") if upgrade_type == "energy" => {
                cost_entries.push((
                    "ice",
                    Self::calculate_exponential_cost(30.0, growth, current_level),
                ));
                cost_entries.push((
                    "metals",
                    Self::calculate_exponential_cost(15.0, growth, current_level),
                ));
            }
            Some("crystals") if upgrade_type == "solar" => {
                cost_entries.push((
                    "crystals",
                    Self::calculate_exponential_cost(25.0, growth, current_level),
                ));
                cost_entries.push((
                    "metals",
                    Self::calculate_exponential_cost(10.0, growth, current_level),
                ));
            }
            Some(_) => return Ok(()), // Unknown variant for this upgrade
            _ => cost_entries.push((
                "bars",
                Self::calculate_exponential_cost(13.0, growth, current_level),
            )),
        }

        // Ensure affordability
        for (resource, cost) in &cost_entries {
            let available = match *resource {
                "bars" => factory.resources.bars,
                "metals" => factory.resources.metals,
                "organics" => factory.resources.organics,
                "ice" => factory.resources.ice,
                "crystals" => factory.resources.crystals,
                _ => 0.0,
            };
            if available < *cost {
                return Ok(());
            }
        }

        // Deduct costs
        let factory = &mut self.snapshot.factories[factory_idx];
        for (resource, cost) in &cost_entries {
            match *resource {
                "bars" => factory.resources.bars -= cost,
                "metals" => factory.resources.metals -= cost,
                "organics" => factory.resources.organics -= cost,
                "ice" => factory.resources.ice -= cost,
                "crystals" => factory.resources.crystals -= cost,
                _ => {}
            }
        }

        // Apply the upgrade effect
        match upgrade_type {
            "docking" => {
                factory.docking_capacity += 1;
                factory.upgrades.docking += 1;
            }
            "refine" => {
                factory.refine_slots += 1;
                factory.upgrades.refine += 1;
            }
            "storage" => {
                factory.storage_capacity += 150.0;
                factory.upgrades.storage += 1;
            }
            "energy" => {
                factory.energy_capacity += 30.0;
                factory.upgrades.energy += 1;
                factory.energy = factory.energy.min(factory.energy_capacity);
            }
            "solar" => {
                factory.upgrades.solar += 1;
                factory.energy_capacity += crate::constants::FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL;
            }
            _ => {}
        }

        // Clear fulfilled upgrade requests for this upgrade type
        factory.upgrade_requests.retain(|req| req.upgrade != upgrade_type);

        // Update buffer data
        self.sync_factory_to_buffer(factory_idx);

        Ok(())
    }

    fn handle_assign_hauler(&mut self, factory_id: &str, count: i32) -> Result<(), SimulationError> {
        let factory_idx = match self.factory_id_to_index.get(factory_id) {
            Some(&idx) => idx,
            None => return Ok(()),
        };

        if factory_idx >= self.snapshot.factories.len() {
            return Ok(());
        }

        let factory = &mut self.snapshot.factories[factory_idx];
        let current = factory.haulers_assigned.unwrap_or(0);
        let target_count = (current + count).max(0);

        if target_count == current {
            return Ok(());
        }

        if target_count > current {
            let mut total_cost = 0.0;
            for level in current..target_count {
                total_cost += Self::calculate_exponential_cost(10.0, crate::constants::UPGRADE_GROWTH, level);
            }
            if factory.resources.bars < total_cost {
                return Ok(());
            }
            factory.resources.bars -= total_cost;
        }

        factory.haulers_assigned = Some(target_count);
        self.sync_factory_to_buffer(factory_idx);

        Ok(())
    }

    fn handle_recycle_asteroid(&mut self, asteroid_id: &str) -> Result<(), SimulationError> {
        if let Some(&idx) = self.asteroid_id_to_index.get(asteroid_id) {
            // Set ore remaining to 0
            let offset = self.layout.asteroids.ore_remaining.offset_bytes / 4 + idx;
            self.data[offset] = 0.0f32.to_bits();
            if let Some(value) = self.snapshot.extra.get_mut("asteroids") {
                if let Some(array) = value.as_array_mut() {
                    for asteroid in array.iter_mut() {
                        if asteroid
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|v| v == asteroid_id)
                            .unwrap_or(false)
                        {
                            if let Some(obj) = asteroid.as_object_mut() {
                                obj.insert("oreRemaining".to_string(), serde_json::json!(0.0));
                            }
                            break;
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn sync_globals_to_buffer(&mut self) {
        let offset = self.layout.globals.resources.offset_bytes / 4;
        let r = &self.snapshot.resources;
        self.data[offset] = r.ore.to_bits();
        self.data[offset + 1] = r.ice.to_bits();
        self.data[offset + 2] = r.metals.to_bits();
        self.data[offset + 3] = r.crystals.to_bits();
        self.data[offset + 4] = r.organics.to_bits();
        self.data[offset + 5] = r.bars.to_bits();
        self.data[offset + 6] = r.energy.to_bits();
        self.data[offset + 7] = r.credits.to_bits();
    }

    fn sync_factory_to_buffer(&mut self, factory_idx: usize) {
        if factory_idx >= self.snapshot.factories.len() {
            return;
        }

        let factory = &self.snapshot.factories[factory_idx];

        // Sync resources
        let offset = self.layout.factories.resources.offset_bytes / 4 + factory_idx * 7;
        self.data[offset] = factory.resources.ore.to_bits();
        self.data[offset + 1] = factory.resources.ice.to_bits();
        self.data[offset + 2] = factory.resources.metals.to_bits();
        self.data[offset + 3] = factory.resources.crystals.to_bits();
        self.data[offset + 4] = factory.resources.organics.to_bits();
        self.data[offset + 5] = factory.resources.bars.to_bits();
        self.data[offset + 6] = factory.resources.credits.to_bits();

        // Sync energy
        let offset = self.layout.factories.energy.offset_bytes / 4 + factory_idx;
        self.data[offset] = factory.energy.to_bits();

        let offset = self.layout.factories.max_energy.offset_bytes / 4 + factory_idx;
        self.data[offset] = factory.energy_capacity.to_bits();

        // Sync upgrades
        let offset = self.layout.factories.upgrades.offset_bytes / 4 + factory_idx * 5;
        self.data[offset] = (factory.upgrades.docking as f32).to_bits();
        self.data[offset + 1] = (factory.upgrades.refine as f32).to_bits();
        self.data[offset + 2] = (factory.upgrades.storage as f32).to_bits();
        self.data[offset + 3] = (factory.upgrades.energy as f32).to_bits();
        self.data[offset + 4] = (factory.upgrades.solar as f32).to_bits();

        // Sync haulers
        let offset = self.layout.factories.haulers_assigned.offset_bytes / 4 + factory_idx;
        self.data[offset] = (factory.haulers_assigned.unwrap_or(0) as f32).to_bits();
    }
}

fn asteroid_array(extra: &BTreeMap<String, Value>) -> Option<&Vec<Value>> {
    extra
        .get("asteroids")
        .and_then(|value| value.as_array())
        .or_else(|| {
            extra
                .get("extra")
                .and_then(|value| value.as_object())
                .and_then(|obj| obj.get("asteroids"))
                .and_then(|value| value.as_array())
        })
}

fn asteroid_array_mut(extra: &mut BTreeMap<String, Value>) -> Option<&mut Vec<Value>> {
    if extra.contains_key("asteroids") {
        if let Some(Value::Array(arr)) = extra.get_mut("asteroids") {
            return Some(arr);
        }
        return None;
    }

    if let Some(Value::Object(map)) = extra.get_mut("extra") {
        if let Some(Value::Array(arr)) = map.get_mut("asteroids") {
            return Some(arr);
        }
    }

    None
}

fn asteroid_count(snapshot: &SimulationSnapshot) -> usize {
    asteroid_array(&snapshot.extra)
        .map(|arr| arr.len())
        .unwrap_or(0)
}

const ASTEROID_RNG_CALLS_PER_SPAWN: usize = 11;

fn burn_rng_for_asteroids(rng: &mut Mulberry32, asteroid_count: usize) {
    let burns = asteroid_count.saturating_mul(ASTEROID_RNG_CALLS_PER_SPAWN);
    for _ in 0..burns {
        rng.next_f32();
    }
}

fn build_drone_index_to_id(
    drone_id_to_index: &BTreeMap<String, usize>,
    total_drone_count: usize,
) -> Vec<String> {
    let mut drone_index_to_id = vec![String::new(); total_drone_count];
    for (id, &idx) in drone_id_to_index.iter() {
        if idx < drone_index_to_id.len() {
            drone_index_to_id[idx] = id.clone();
        }
    }
    drone_index_to_id
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
            schema_version: SCHEMA_VERSION.to_string(),
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
            game_time: 0.0,
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
