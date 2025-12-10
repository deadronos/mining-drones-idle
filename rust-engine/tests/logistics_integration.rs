use rust_engine::GameState;
use rust_engine::schema::{
    SimulationSnapshot, Resources, Modules, Prestige, SaveMeta, StoreSettings, MetricsSettings,
    FactorySnapshot, LogisticsQueues, PendingTransfer, FactoryResourceSnapshot
};
use std::collections::BTreeMap;

fn create_base_snapshot() -> SimulationSnapshot {
    SimulationSnapshot {
        resources: Resources::default(),
        modules: Modules { drone_bay: 1, ..Default::default() },
        prestige: Prestige { cores: 0 },
        save: SaveMeta { last_save: 0, version: "0.0.0".to_string() },
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
        rng_seed: Some(123),
        drone_flights: vec![],
        factories: vec![],
        selected_factory_id: None,
        drone_owners: BTreeMap::new(),
        logistics_queues: Some(LogisticsQueues::default()),
        spec_techs: None,
        spec_tech_spent: None,
        prestige_investments: None,
        game_time: 100.0, // Start at 100s
        extra: BTreeMap::new(),
    }
}

#[test]
fn test_logistics_transfer_completion() {
    let mut snapshot = create_base_snapshot();

    // Add 2 factories
    let f1 = FactorySnapshot {
        id: "f1".to_string(),
        resources: FactoryResourceSnapshot { ore: 100.0, ..Default::default() },
        position: [0.0, 0.0, 0.0],
        ..Default::default()
    };

    let f2 = FactorySnapshot {
        id: "f2".to_string(),
        resources: FactoryResourceSnapshot { ore: 0.0, ..Default::default() },
        position: [100.0, 0.0, 0.0],
        ..Default::default()
    };

    snapshot.factories = vec![f1, f2];

    // Create a pending transfer from f1 to f2
    // ETA is 105.0 (5 seconds from now)
    let transfer = PendingTransfer {
        id: "t1".to_string(),
        from_factory_id: "f1".to_string(),
        to_factory_id: "f2".to_string(),
        resource: "ore".to_string(),
        amount: 10.0,
        status: "scheduled".to_string(),
        eta: 105.0,
        departed_at: 100.0,
    };

    if let Some(q) = &mut snapshot.logistics_queues {
        q.pending_transfers.push(transfer);
    }

    let mut state = GameState::from_snapshot(snapshot).expect("Valid snapshot");

    // Step 1: Time 101.0. Transfer should still be there.
    state.step(1.0);
    assert_eq!(state.snapshot().logistics_queues.as_ref().unwrap().pending_transfers.len(), 1);

    // Step 2: Time 106.0. Transfer should be done.
    state.step(5.0);

    // Assert transfer removed
    assert_eq!(state.snapshot().logistics_queues.as_ref().unwrap().pending_transfers.len(), 0, "Transfer should be removed");

    // Assert resources transferred
    let f1_res = state.snapshot().factories[0].resources.ore;
    let f2_res = state.snapshot().factories[1].resources.ore;

    assert_eq!(f1_res, 90.0, "Source factory should have deducted resources");
    assert_eq!(f2_res, 10.0, "Dest factory should have received resources");

    // Check buffer values via accessors
    let buffer = state.get_factory_resources_mut();
    // Layout: ore, ice, metals, crystals, organics, bars, credits (7 floats)
    assert_eq!(buffer[0], 90.0, "Buffer F1 Ore mismatch");
    assert_eq!(buffer[7], 10.0, "Buffer F2 Ore mismatch");
}
