use wasm_bindgen::prelude::*;

use crate::{GameState, SimulationCommand, SimulationError};

fn to_js_error(err: SimulationError) -> JsValue {
    JsValue::from_str(&err.to_string())
}

#[wasm_bindgen]
pub struct WasmGameState {
    inner: GameState,
}

#[wasm_bindgen]
impl WasmGameState {
    #[wasm_bindgen(constructor)]
    pub fn new(snapshot_json: &str) -> Result<WasmGameState, JsValue> {
        let snapshot = serde_json::from_str(snapshot_json)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        let inner = GameState::from_snapshot(snapshot).map_err(to_js_error)?;
        Ok(WasmGameState { inner })
    }

    pub fn load_snapshot(&mut self, snapshot_json: &str) -> Result<(), JsValue> {
        self.inner
            .load_snapshot_str(snapshot_json)
            .map_err(to_js_error)
    }

    pub fn export_snapshot(&mut self) -> Result<String, JsValue> {
        self.inner.export_snapshot_str().map_err(to_js_error)
    }

    pub fn get_logistics_queues(&self) -> Result<String, JsValue> {
        self.inner.get_logistics_queues_str().map_err(to_js_error)
    }

    pub fn step(&mut self, dt: f32) -> f32 {
        self.inner.step(dt).game_time
    }

    pub fn apply_command(&mut self, command_json: &str) -> Result<(), JsValue> {
        let command: SimulationCommand = serde_json::from_str(command_json)
            .map_err(|err| JsValue::from_str(&err.to_string()))?;
        self.inner.apply_command(command).map_err(to_js_error)
    }

    pub fn simulate_offline(&mut self, seconds: f32, step: f32) -> Result<String, JsValue> {
        let result = self
            .inner
            .simulate_offline(seconds, step)
            .map_err(to_js_error)?;
        serde_json::to_string(&result).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    pub fn layout_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.layout).map_err(|err| JsValue::from_str(&err.to_string()))
    }

    pub fn data_ptr(&self) -> *const u8 {
        self.inner.data.as_ptr() as *const u8
    }
}

#[wasm_bindgen]
pub fn set_parity_debug(enabled: bool) {
    crate::parity_debug::set_enabled(enabled);
}
