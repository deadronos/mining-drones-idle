use core::sync::atomic::{AtomicBool, Ordering};

static PARITY_DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn set_enabled(enabled: bool) {
    PARITY_DEBUG_ENABLED.store(enabled, Ordering::Relaxed);
}

pub fn enabled() -> bool {
    PARITY_DEBUG_ENABLED.load(Ordering::Relaxed)
}

#[cfg(feature = "wasm")]
mod console {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = console, js_name = warn)]
        fn console_warn(s: &str);
    }

    pub fn log(s: &str) {
        console_warn(s);
    }
}

#[cfg(not(feature = "wasm"))]
mod console {
    pub fn log(s: &str) {
        eprintln!("{}", s);
    }
}

pub fn log_json(label: &str, payload: &serde_json::Value) {
    if !enabled() {
        return;
    }

    let mut message = String::new();
    message.push_str("[parity][rust][");
    message.push_str(label);
    message.push(']');
    message.push(' ');
    message.push_str(&payload.to_string());

    console::log(&message);
}
