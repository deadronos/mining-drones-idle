use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::error::SimulationError;

pub type Vector3 = [f32; 3];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TravelSnapshot {
    pub from: Vector3,
    pub to: Vector3,
    pub elapsed: f32,
    pub duration: f32,
    #[serde(default)]
    pub control: Option<Vector3>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DroneFlight {
    #[serde(rename = "droneId")]
    pub drone_id: String,
    pub state: String,
    #[serde(rename = "targetAsteroidId")]
    pub target_asteroid_id: Option<String>,
    #[serde(rename = "targetRegionId")]
    pub target_region_id: Option<String>,
    #[serde(rename = "targetFactoryId")]
    pub target_factory_id: Option<String>,
    #[serde(rename = "ownerFactoryId")]
    pub owner_factory_id: Option<String>,
    #[serde(rename = "pathSeed")]
    pub path_seed: u32,
    pub travel: TravelSnapshot,
    #[serde(default)]
    pub cargo: f32,
    #[serde(default)]
    pub battery: f32,
    #[serde(default, rename = "maxBattery")]
    pub max_battery: f32,
    #[serde(default)]
    pub capacity: f32,
    #[serde(default, rename = "miningRate")]
    pub mining_rate: f32,
    #[serde(default, rename = "cargoProfile")]
    pub cargo_profile: Option<Resources>,
    #[serde(default)]
    pub charging: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct FactoryResourceSnapshot {
    pub ore: f32,
    pub bars: f32,
    pub metals: f32,
    pub crystals: f32,
    pub organics: f32,
    pub ice: f32,
    pub credits: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct FactoryUpgradeSnapshot {
    pub docking: i32,
    pub refine: i32,
    pub storage: i32,
    pub energy: i32,
    pub solar: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct FactorySnapshot {
    pub id: String,
    pub position: Vector3,
    #[serde(default)]
    pub docking_capacity: i32,
    #[serde(default)]
    pub refine_slots: i32,
    #[serde(default)]
    pub idle_energy_per_sec: f32,
    #[serde(default)]
    pub energy_per_refine: f32,
    #[serde(default)]
    pub storage_capacity: f32,
    #[serde(default)]
    pub current_storage: f32,
    #[serde(default)]
    pub queued_drones: Vec<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub energy: f32,
    #[serde(default)]
    pub energy_capacity: f32,
    #[serde(default)]
    pub resources: FactoryResourceSnapshot,
    #[serde(default)]
    pub upgrades: FactoryUpgradeSnapshot,
    #[serde(default)]
    pub haulers_assigned: Option<i32>,
    #[serde(default)]
    pub hauler_config: Option<serde_json::Value>,
    #[serde(default)]
    pub hauler_upgrades: Option<serde_json::Value>,
    #[serde(default)]
    pub logistics_state: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct LogisticsQueues {
    #[serde(default)]
    pub pending_transfers: Vec<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct Resources {
    pub ore: f32,
    pub ice: f32,
    pub metals: f32,
    pub crystals: f32,
    pub organics: f32,
    pub bars: f32,
    pub energy: f32,
    pub credits: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct Modules {
    #[serde(rename = "droneBay")]
    pub drone_bay: i32,
    pub refinery: i32,
    pub storage: i32,
    pub solar: i32,
    pub scanner: i32,
    #[serde(rename = "haulerDepot")]
    pub hauler_depot: i32,
    #[serde(rename = "logisticsHub")]
    pub logistics_hub: i32,
    #[serde(rename = "routingProtocol")]
    pub routing_protocol: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Prestige {
    pub cores: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SaveMeta {
    #[serde(rename = "lastSave")]
    pub last_save: i64,
    pub version: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct StoreSettings {
    #[serde(rename = "autosaveEnabled")]
    pub autosave_enabled: bool,
    #[serde(rename = "autosaveInterval")]
    pub autosave_interval: i32,
    #[serde(rename = "offlineCapHours")]
    pub offline_cap_hours: i32,
    pub notation: String,
    #[serde(rename = "throttleFloor")]
    pub throttle_floor: f32,
    #[serde(rename = "showTrails")]
    pub show_trails: bool,
    #[serde(rename = "showHaulerShips")]
    pub show_hauler_ships: bool,
    #[serde(rename = "showDebugPanel")]
    pub show_debug_panel: bool,
    #[serde(rename = "performanceProfile")]
    pub performance_profile: String,
    #[serde(rename = "inspectorCollapsed")]
    pub inspector_collapsed: bool,
    pub metrics: MetricsSettings,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
pub struct MetricsSettings {
    pub enabled: bool,
    #[serde(rename = "intervalSeconds")]
    pub interval_seconds: i32,
    #[serde(rename = "retentionSeconds")]
    pub retention_seconds: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SimulationSnapshot {
    pub resources: Resources,
    pub modules: Modules,
    pub prestige: Prestige,
    pub save: SaveMeta,
    pub settings: StoreSettings,
    #[serde(default, rename = "rngSeed")]
    pub rng_seed: Option<u32>,
    #[serde(default, rename = "droneFlights")]
    pub drone_flights: Vec<DroneFlight>,
    #[serde(default)]
    pub factories: Vec<FactorySnapshot>,
    #[serde(default, rename = "selectedFactoryId")]
    pub selected_factory_id: Option<String>,
    #[serde(default, rename = "droneOwners")]
    pub drone_owners: BTreeMap<String, Option<String>>,
    #[serde(default, rename = "logisticsQueues")]
    pub logistics_queues: Option<LogisticsQueues>,
    #[serde(default, rename = "specTechs")]
    pub spec_techs: Option<serde_json::Value>,
    #[serde(default, rename = "specTechSpent")]
    pub spec_tech_spent: Option<serde_json::Value>,
    #[serde(default, rename = "prestigeInvestments")]
    pub prestige_investments: Option<serde_json::Value>,
    #[serde(flatten, default)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

impl SimulationSnapshot {
    pub fn ensure_required(&self) -> Result<(), SimulationError> {
        let resources = [
            self.resources.ore,
            self.resources.ice,
            self.resources.metals,
            self.resources.crystals,
            self.resources.organics,
            self.resources.bars,
            self.resources.energy,
            self.resources.credits,
        ];
        if resources.iter().any(|value| !value.is_finite()) {
            return Err(SimulationError::MissingField("resources"));
        }
        let modules = [
            self.modules.drone_bay,
            self.modules.refinery,
            self.modules.storage,
            self.modules.solar,
            self.modules.scanner,
            self.modules.hauler_depot,
            self.modules.logistics_hub,
            self.modules.routing_protocol,
        ];
        if modules.iter().all(|value| *value == 0) {
            return Err(SimulationError::MissingField("modules"));
        }
        if self.save.version.is_empty() {
            return Err(SimulationError::MissingField("save"));
        }
        if self.settings.metrics.interval_seconds <= 0 {
            return Err(SimulationError::MissingField("settings.metrics"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_large_path_seed() {
        let json = r#"{
            "droneId": "d1",
            "state": "idle",
            "pathSeed": 3132762181,
            "travel": {
                "from": [0.0, 0.0, 0.0],
                "to": [0.0, 0.0, 0.0],
                "elapsed": 0.0,
                "duration": 0.0
            }
        }"#;
        let flight: DroneFlight = serde_json::from_str(json).expect("should deserialize");
        assert_eq!(flight.path_seed, 3132762181);
    }
}
