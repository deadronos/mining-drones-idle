use crate::constants::{
    BASE_STORAGE, STORAGE_PER_LEVEL, FACTORY_HAULER_CAPACITY_PER_LEVEL,
    FACTORY_HAULER_SPEED_PER_LEVEL, FACTORY_HAULER_EFFICIENCY_PER_LEVEL,
};
use crate::schema::{
    FactorySnapshot, LogisticsQueues, Resources, Modules, FactoryResourceSnapshot,
    HaulerConfig, PendingTransfer, InboundSchedule, FactoryLogisticsState,
};

const WAREHOUSE_NODE_ID: &str = "warehouse";
const WAREHOUSE_STORAGE_MULTIPLIER: f32 = 8.0;

// Config constants
const BUFFER_SECONDS: f32 = 30.0;
const MIN_RESERVE_SECONDS: f32 = 5.0;
const HAULER_CAPACITY: f32 = 50.0;
const HAULER_SPEED: f32 = 1.0;
const PICKUP_OVERHEAD: f32 = 1.0;
const DROPOFF_OVERHEAD: f32 = 1.0;
const RESOURCE_TYPES: [&str; 6] = ["ore", "bars", "metals", "crystals", "organics", "ice"];

pub fn sys_logistics(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    resources: &mut Resources,
    modules: &Modules,
    game_time: f32,
    run_scheduler: bool,
) {
    process_completions(logistics_queues, factories, resources, modules, game_time);

    if run_scheduler {
        process_scheduler(logistics_queues, factories, resources, modules, game_time);
    }
}

fn process_completions(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    resources: &mut Resources,
    modules: &Modules,
    game_time: f32,
) {
    let mut completed_indices = Vec::new();
    let warehouse_capacity = (BASE_STORAGE + (modules.storage as f32) * STORAGE_PER_LEVEL) * WAREHOUSE_STORAGE_MULTIPLIER;

    // 1. Identify completed transfers
    for (i, transfer) in logistics_queues.pending_transfers.iter().enumerate() {
        if game_time >= transfer.eta {
            completed_indices.push(i);
        }
    }

    if completed_indices.is_empty() {
        return;
    }

    // 2. Process completions
    for &idx in completed_indices.iter().rev() {
        let transfer = &logistics_queues.pending_transfers[idx];
        let amount = transfer.amount;
        let resource_key = transfer.resource.as_str();
        let from_id = transfer.from_factory_id.clone();
        let to_id = transfer.to_factory_id.clone();
        let resource = resource_key.to_string();
        let eta = transfer.eta;

        if to_id == WAREHOUSE_NODE_ID {
            // Factory -> Warehouse
            if let Some(source_factory) = factories.iter_mut().find(|f| f.id == from_id) {
                if let Some(logistics) = &mut source_factory.logistics_state {
                    if let Some(reserved) = logistics.outbound_reservations.get_mut(&resource) {
                        *reserved = (*reserved - amount).max(0.0);
                    }
                }
                deduct_factory_resource(&mut source_factory.resources, &resource, amount);
                if resource == "ore" {
                    source_factory.current_storage = source_factory.resources.ore;
                }
                add_global_resource_bounded(resources, &resource, amount, warehouse_capacity);
            }
        } else if from_id == WAREHOUSE_NODE_ID {
             // Warehouse -> Factory
             if let Some(dest_factory) = factories.iter_mut().find(|f| f.id == to_id) {
                 deduct_global_resource(resources, &resource, amount);
                 add_factory_resource(&mut dest_factory.resources, &resource, amount);
                 if resource == "ore" {
                     dest_factory.current_storage = dest_factory.resources.ore;
                 }
                 if let Some(logistics) = &mut dest_factory.logistics_state {
                     if let Some(pos) = logistics.inbound_schedules.iter().position(|s|
                         s.from_factory_id == from_id &&
                         s.resource == resource &&
                         (s.eta - eta).abs() < 0.001
                     ) {
                         logistics.inbound_schedules.remove(pos);
                     }
                 }
             }
        } else {
            // Factory -> Factory
            let mut source_idx = None;
            let mut dest_idx = None;
            for (k, f) in factories.iter().enumerate() {
                if f.id == from_id { source_idx = Some(k); }
                if f.id == to_id { dest_idx = Some(k); }
            }
            if let (Some(s_idx), Some(d_idx)) = (source_idx, dest_idx) {
                if s_idx != d_idx {
                    if s_idx < d_idx {
                        let (left, right) = factories.split_at_mut(d_idx);
                        let source = &mut left[s_idx];
                        let dest = &mut right[0];
                        process_f2f(source, dest, &resource, amount, eta);
                    } else {
                        let (left, right) = factories.split_at_mut(s_idx);
                        let dest = &mut left[d_idx];
                        let source = &mut right[0];
                        process_f2f(source, dest, &resource, amount, eta);
                    }
                }
            }
        }
        logistics_queues.pending_transfers.remove(idx);
    }
}

fn process_f2f(source: &mut FactorySnapshot, dest: &mut FactorySnapshot, resource: &str, amount: f32, eta: f32) {
    if let Some(logistics) = &mut source.logistics_state {
        if let Some(reserved) = logistics.outbound_reservations.get_mut(resource) {
            *reserved = (*reserved - amount).max(0.0);
        }
    }
    deduct_factory_resource(&mut source.resources, resource, amount);
    if resource == "ore" { source.current_storage = source.resources.ore; }

    add_factory_resource(&mut dest.resources, resource, amount);
    if resource == "ore" { dest.current_storage = dest.resources.ore; }

    if let Some(logistics) = &mut dest.logistics_state {
         if let Some(pos) = logistics.inbound_schedules.iter().position(|s|
            s.from_factory_id == source.id &&
            s.resource == resource &&
            (s.eta - eta).abs() < 0.001
        ) {
            logistics.inbound_schedules.remove(pos);
        }
    }
}

// Scheduler Implementation

struct NeedEntry {
    factory_idx: usize,
    need: f32,
    config: HaulerConfig,
}

struct SurplusEntry {
    factory_idx: usize,
    surplus: f32,
    config: HaulerConfig,
}

fn process_scheduler(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    _resources: &Resources,
    modules: &Modules,
    game_time: f32,
) {
    // 1. Resolve Configs
    let mut resolved_configs = Vec::with_capacity(factories.len());
    for factory in factories.iter() {
        resolved_configs.push(resolve_hauler_config(factory, modules));
    }

    // 2. Schedule for each resource
    let mut transfers_to_create = Vec::new();

    // Iterate resources (simple version: F2F only)
    for resource in RESOURCE_TYPES.iter() {
        let mut needs = Vec::new();
        let mut surpluses = Vec::new();

        for (i, factory) in factories.iter().enumerate() {
            let config = &resolved_configs[i];

            // Calculate buffer target
            let target = compute_buffer_target(factory, resource);
            let current = get_factory_resource(&factory.resources, resource);

            // Adjust current by reservations/schedules
            let inbound = if let Some(logistics) = &factory.logistics_state {
                logistics.inbound_schedules.iter()
                    .filter(|s| s.resource == *resource)
                    .map(|s| s.amount)
                    .sum()
            } else { 0.0 };

            let outbound = if let Some(logistics) = &factory.logistics_state {
                logistics.outbound_reservations.get(*resource).cloned().unwrap_or(0.0)
            } else { 0.0 };

            let projected = current + inbound - outbound;

            // Need
            let need = (target - projected).max(0.0);
            if need > 0.0 {
                needs.push(NeedEntry { factory_idx: i, need, config: config.clone() });
            }

            // Surplus
            let min_reserve = compute_min_reserve(factory, resource);
            let surplus = (projected - target - min_reserve).max(0.0);
            if surplus > 0.0 && factory.haulers_assigned.unwrap_or(0) > 0 {
                surpluses.push(SurplusEntry { factory_idx: i, surplus, config: config.clone() });
            }
        }

        // Sort needs and surpluses
        needs.sort_by(|a, b| b.need.partial_cmp(&a.need).unwrap_or(std::cmp::Ordering::Equal));
        surpluses.sort_by(|a, b| b.surplus.partial_cmp(&a.surplus).unwrap_or(std::cmp::Ordering::Equal));

        // Match
        for need_entry in &mut needs {
            for surplus_entry in &mut surpluses {
                if need_entry.need <= 0.001 { break; }
                if surplus_entry.surplus <= 0.001 { continue; }

                // Check filters
                if !surplus_entry.config.resource_filters.is_empty() && !surplus_entry.config.resource_filters.contains(&resource.to_string()) {
                    continue;
                }
                if !need_entry.config.resource_filters.is_empty() && !need_entry.config.resource_filters.contains(&resource.to_string()) {
                    continue;
                }

                let capacity = surplus_entry.config.capacity;
                let amount = need_entry.need.min(surplus_entry.surplus).min(capacity);

                if amount < 1.0 { continue; } // Minimal transfer

                // Compute ETA
                let source_pos = factories[surplus_entry.factory_idx].position;
                let dest_pos = factories[need_entry.factory_idx].position;
                let distance = ((source_pos[0] - dest_pos[0]).powi(2) + (source_pos[1] - dest_pos[1]).powi(2) + (source_pos[2] - dest_pos[2]).powi(2)).sqrt();

                let travel_time = surplus_entry.config.pickup_overhead + (distance / surplus_entry.config.speed.max(0.1)) + surplus_entry.config.dropoff_overhead;
                let eta = game_time + travel_time;

                transfers_to_create.push(PendingTransfer {
                    id: format!("transfer-{}-{}", (game_time * 1000.0) as u64, transfers_to_create.len()),
                    from_factory_id: factories[surplus_entry.factory_idx].id.clone(),
                    to_factory_id: factories[need_entry.factory_idx].id.clone(),
                    resource: resource.to_string(),
                    amount,
                    status: "scheduled".to_string(),
                    eta,
                    departed_at: game_time,
                });

                need_entry.need -= amount;
                surplus_entry.surplus -= amount;
            }
        }
    }

    // Apply created transfers to state
    for transfer in transfers_to_create {
        // Find indices again (inefficient but safe for borrow checker)
        let mut source_idx = None;
        let mut dest_idx = None;
        for (k, f) in factories.iter().enumerate() {
            if f.id == transfer.from_factory_id { source_idx = Some(k); }
            if f.id == transfer.to_factory_id { dest_idx = Some(k); }
        }

        if let (Some(s_idx), Some(d_idx)) = (source_idx, dest_idx) {
            // Update source outbound
            let source = &mut factories[s_idx];
            if source.logistics_state.is_none() {
                source.logistics_state = Some(FactoryLogisticsState::default());
            }
            if let Some(logistics) = &mut source.logistics_state {
                *logistics.outbound_reservations.entry(transfer.resource.clone()).or_insert(0.0) += transfer.amount;
            }

            // Update dest inbound
            let dest = &mut factories[d_idx];
            if dest.logistics_state.is_none() {
                dest.logistics_state = Some(FactoryLogisticsState::default());
            }
            if let Some(logistics) = &mut dest.logistics_state {
                logistics.inbound_schedules.push(InboundSchedule {
                    from_factory_id: transfer.from_factory_id.clone(),
                    resource: transfer.resource.clone(),
                    amount: transfer.amount,
                    eta: transfer.eta,
                });
            }

            // Add to queue
            logistics_queues.pending_transfers.push(transfer);
        }
    }
}

fn resolve_hauler_config(factory: &FactorySnapshot, modules: &Modules) -> HaulerConfig {
    let base = factory.hauler_config.clone().unwrap_or(HaulerConfig {
        capacity: HAULER_CAPACITY,
        speed: HAULER_SPEED,
        pickup_overhead: PICKUP_OVERHEAD,
        dropoff_overhead: DROPOFF_OVERHEAD,
        resource_filters: vec![],
        mode: "auto".to_string(),
        priority: 5,
    });

    let mut config = base;

    // Apply factory upgrades
    let upgrades = &factory.hauler_upgrades;
    let cap_boost = upgrades.as_ref().and_then(|u| u.capacity_boost).unwrap_or(0) as f32;
    let speed_boost = upgrades.as_ref().and_then(|u| u.speed_boost).unwrap_or(0) as f32;
    let eff_boost = upgrades.as_ref().and_then(|u| u.efficiency_boost).unwrap_or(0) as f32;

    // Apply global modules
    let module_eff_boost = (modules.logistics_hub as f32) * 0.1;
    let module_speed_boost = (modules.hauler_depot as f32) * 0.05;
    let module_cap_boost = (modules.hauler_depot as f32) * 10.0;

    config.capacity += cap_boost * FACTORY_HAULER_CAPACITY_PER_LEVEL + module_cap_boost;
    config.speed += speed_boost * FACTORY_HAULER_SPEED_PER_LEVEL;
    config.speed *= 1.0 + module_speed_boost;

    let total_eff = (eff_boost * FACTORY_HAULER_EFFICIENCY_PER_LEVEL + module_eff_boost).min(0.9);
    config.pickup_overhead *= 1.0 - total_eff;
    config.dropoff_overhead *= 1.0 - total_eff;

    config
}

fn compute_buffer_target(factory: &FactorySnapshot, resource: &str) -> f32 {
    match resource {
        "ore" => {
            let ore_per_sec = 50.0 / 60.0;
            BUFFER_SECONDS * ore_per_sec * (factory.refine_slots as f32).max(1.0)
        }
        "bars" => 5.0,
        _ => 20.0,
    }
}

fn compute_min_reserve(_factory: &FactorySnapshot, _resource: &str) -> f32 {
    MIN_RESERVE_SECONDS * 5.0
}

fn get_factory_resource(res: &FactoryResourceSnapshot, key: &str) -> f32 {
    match key {
        "ore" => res.ore,
        "bars" => res.bars,
        "metals" => res.metals,
        "crystals" => res.crystals,
        "organics" => res.organics,
        "ice" => res.ice,
        "credits" => res.credits,
        _ => 0.0,
    }
}

// Helpers from previous impl
fn deduct_factory_resource(res: &mut FactoryResourceSnapshot, key: &str, amount: f32) {
    match key {
        "ore" => res.ore = (res.ore - amount).max(0.0),
        "bars" => res.bars = (res.bars - amount).max(0.0),
        "metals" => res.metals = (res.metals - amount).max(0.0),
        "crystals" => res.crystals = (res.crystals - amount).max(0.0),
        "organics" => res.organics = (res.organics - amount).max(0.0),
        "ice" => res.ice = (res.ice - amount).max(0.0),
        "credits" => res.credits = (res.credits - amount).max(0.0),
        _ => {}
    }
}

fn add_factory_resource(res: &mut FactoryResourceSnapshot, key: &str, amount: f32) {
    match key {
        "ore" => res.ore += amount,
        "bars" => res.bars += amount,
        "metals" => res.metals += amount,
        "crystals" => res.crystals += amount,
        "organics" => res.organics += amount,
        "ice" => res.ice += amount,
        "credits" => res.credits += amount,
        _ => {}
    }
}

fn deduct_global_resource(res: &mut Resources, key: &str, amount: f32) {
    match key {
        "ore" => res.ore = (res.ore - amount).max(0.0),
        "bars" => res.bars = (res.bars - amount).max(0.0),
        "metals" => res.metals = (res.metals - amount).max(0.0),
        "crystals" => res.crystals = (res.crystals - amount).max(0.0),
        "organics" => res.organics = (res.organics - amount).max(0.0),
        "ice" => res.ice = (res.ice - amount).max(0.0),
        "credits" => res.credits = (res.credits - amount).max(0.0),
        _ => {}
    }
}

fn add_global_resource_bounded(res: &mut Resources, key: &str, amount: f32, capacity: f32) {
    match key {
        "ore" | "bars" | "metals" | "crystals" | "organics" | "ice" => {
             let current = get_global_resource(res, key);
             let new_val = (current + amount).min(capacity);
             set_global_resource(res, key, new_val);
        }
        "credits" => res.credits += amount,
        _ => {}
    }
}

fn get_global_resource(res: &Resources, key: &str) -> f32 {
     match key {
        "ore" => res.ore,
        "bars" => res.bars,
        "metals" => res.metals,
        "crystals" => res.crystals,
        "organics" => res.organics,
        "ice" => res.ice,
        "credits" => res.credits,
        _ => 0.0,
    }
}

fn set_global_resource(res: &mut Resources, key: &str, val: f32) {
     match key {
        "ore" => res.ore = val,
        "bars" => res.bars = val,
        "metals" => res.metals = val,
        "crystals" => res.crystals = val,
        "organics" => res.organics = val,
        "ice" => res.ice = val,
        "credits" => res.credits = val,
        _ => {},
    }
}
