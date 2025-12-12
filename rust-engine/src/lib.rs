//! Core library for the Rust-based simulation engine.
//! Provides game state management, memory layout planning for WASM interop,
//! and simulation systems for movement, mining, and refining.

pub mod api;
pub mod buffers;
pub mod constants;
pub mod error;
pub mod modifiers;
pub mod parity_debug;
pub mod rng;
pub mod schema;
pub mod sinks;
pub mod systems;

#[cfg(feature = "wasm")]
pub mod wasm;

pub use api::{GameState, OfflineResult, SimulationCommand, TickResult};
pub use buffers::{
    AsteroidBuffers, BufferSection, DroneBuffers, EntityBufferLayout, FactoryBuffers, plan_layout,
};
pub use error::SimulationError;
pub use rng::Mulberry32;
pub use schema::{
    DroneFlight, FactoryResourceSnapshot, FactorySnapshot, FactoryUpgradeSnapshot, LogisticsQueues,
    MetricsSettings, Modules, Resources, SimulationSnapshot, StoreSettings, TravelSnapshot,
};
