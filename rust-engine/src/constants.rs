// Factory Configuration
pub const FACTORY_REFINE_SLOTS: usize = 2;
pub const FACTORY_REFINE_TIME: f32 = 10.0;
pub const FACTORY_ENERGY_PER_REFINE: f32 = 2.0;
pub const FACTORY_IDLE_ENERGY_PER_SEC: f32 = 1.0;
pub const FACTORY_STORAGE_CAPACITY: f32 = 300.0;
pub const FACTORY_ENERGY_CAPACITY: f32 = 80.0;
pub const FACTORY_INITIAL_ENERGY: f32 = 40.0;
pub const FACTORY_INITIAL_DOCKING_CAPACITY: usize = 3;

// Factory Upgrades
pub const FACTORY_SOLAR_MAX_ENERGY_PER_LEVEL: f32 = 10.0;
pub const FACTORY_SOLAR_BASE_REGEN: f32 = 1.25;
pub const FACTORY_SOLAR_REGEN_PER_LEVEL: f32 = 0.5;
pub const FACTORY_UPGRADE_GROWTH: f32 = 1.35;

// Global Modules
pub const SOLAR_ARRAY_LOCAL_MAX_ENERGY_PER_LEVEL: f32 = 3.0;
pub const SOLAR_ARRAY_LOCAL_REGEN_PER_LEVEL: f32 = 0.25;

// General Balance
pub const SOLAR_BASE_GEN: f32 = 7.0;
pub const BASE_ENERGY_CAP: f32 = 100.0;
pub const ENERGY_PER_SOLAR: f32 = 25.0;
pub const ORE_PER_BAR: f32 = 10.0;
pub const ORE_CONVERSION_PER_SECOND: f32 = 10.0;
pub const BASE_STORAGE: f32 = 400.0;
pub const STORAGE_PER_LEVEL: f32 = 100.0;

// Drone Balance
pub const DRONE_MAX_BATTERY: f32 = 24.0;
pub const DRONE_ENERGY_COST: f32 = 0.9;
pub const DRONE_MAX_CARGO: f32 = 40.0;
pub const DRONE_SPEED: f32 = 14.0;
pub const DRONE_MINING_RATE: f32 = 6.0;

// Drone States (f32 for buffer compatibility)
pub const DRONE_STATE_IDLE: f32 = 0.0;
pub const DRONE_STATE_TO_ASTEROID: f32 = 1.0;
pub const DRONE_STATE_MINING: f32 = 2.0;
pub const DRONE_STATE_RETURNING: f32 = 3.0;
pub const DRONE_STATE_UNLOADING: f32 = 4.0;

// Factory Placement
pub const FACTORY_MIN_DISTANCE: f32 = 10.0;
pub const FACTORY_MAX_DISTANCE: f32 = 50.0;
pub const FACTORY_PLACEMENT_ATTEMPTS: usize = 100;

// Upgrade Growth
pub const UPGRADE_GROWTH: f32 = 1.15;
