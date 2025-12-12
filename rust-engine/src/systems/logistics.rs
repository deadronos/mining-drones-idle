use std::collections::BTreeMap;

use crate::constants::{
    BASE_STORAGE,
    FACTORY_HAULER_CAPACITY_PER_LEVEL,
    FACTORY_HAULER_EFFICIENCY_PER_LEVEL,
    FACTORY_HAULER_SPEED_PER_LEVEL,
    HAULER_DEPOT_CAPACITY_PER_LEVEL,
    HAULER_DEPOT_SPEED_MULT_PER_LEVEL,
    LOGISTICS_BUFFER_SECONDS,
    LOGISTICS_DROPOFF_OVERHEAD,
    LOGISTICS_HAULER_CAPACITY,
    LOGISTICS_HAULER_SPEED,
    LOGISTICS_HUB_OVERHEAD_REDUCTION_PER_LEVEL,
    LOGISTICS_MIN_RESERVE_SECONDS,
    LOGISTICS_PICKUP_OVERHEAD,
    ROUTING_PROTOCOL_MATCHING_BONUS_PER_LEVEL,
    STORAGE_PER_LEVEL,
    WAREHOUSE_STORAGE_MULTIPLIER,
};
use crate::modifiers::ResourceModifierSnapshot;
use crate::schema::{
    FactoryLogisticsState,
    FactoryResourceSnapshot,
    FactorySnapshot,
    FactoryUpgradeRequestSnapshot,
    InboundSchedule,
    LogisticsQueues,
    Modules,
    PendingTransfer,
    Resources,
};

const WAREHOUSE_NODE_ID: &str = "warehouse";
const WAREHOUSE_POSITION: [f32; 3] = [0.0, 0.0, 0.0];
const RESOURCE_TYPES: [&str; 6] = ["ore", "bars", "metals", "crystals", "organics", "ice"];
const ETA_MATCH_EPS: f32 = 0.001;
const MIN_AMOUNT_EPS: f32 = 0.001;

#[allow(dead_code)]
#[derive(Clone)]
struct ResolvedHaulerConfig {
    capacity: f32,
    speed: f32,
    pickup_overhead: f32,
    dropoff_overhead: f32,
    resource_filters: Vec<String>,
    mode: String,
    priority: i32,
    routing_efficiency_bonus: f32,
}

impl ResolvedHaulerConfig {
    fn matches_resource(&self, resource: &str) -> bool {
        self.resource_filters.is_empty()
            || self
                .resource_filters
                .iter()
                .any(|entry| entry == resource)
    }
}

pub fn sys_logistics(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    resources: &mut Resources,
    modules: &Modules,
    modifiers: &ResourceModifierSnapshot,
    game_time: f32,
    run_scheduler: bool,
) {
    let warehouse_capacity = compute_warehouse_capacity(modules, modifiers);

    if run_scheduler {
        process_scheduler(
            logistics_queues,
            factories,
            resources,
            modules,
            warehouse_capacity,
            game_time,
        );
    }

    process_completions(
        logistics_queues,
        factories,
        resources,
        warehouse_capacity,
        game_time,
    );
}

fn process_completions(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    resources: &mut Resources,
    warehouse_capacity: f32,
    game_time: f32,
) {
    let mut completed_indices = Vec::new();

    for (idx, transfer) in logistics_queues.pending_transfers.iter().enumerate() {
        if transfer.status == "scheduled" && game_time >= transfer.eta {
            completed_indices.push(idx);
        }
    }

    for idx in completed_indices.into_iter().rev() {
        let transfer = logistics_queues
            .pending_transfers
            .get(idx)
            .cloned()
            .unwrap_or_else(|| PendingTransfer {
                id: String::new(),
                from_factory_id: String::new(),
                to_factory_id: String::new(),
                resource: String::new(),
                amount: 0.0,
                status: String::new(),
                eta: 0.0,
                departed_at: 0.0,
            });

        if transfer.to_factory_id == WAREHOUSE_NODE_ID {
            if let Some(source_factory) = factories
                .iter_mut()
                .find(|factory| factory.id == transfer.from_factory_id)
            {
                release_reservation(source_factory, &transfer.resource, transfer.amount);
                deduct_factory_resource(&mut source_factory.resources, &transfer.resource, transfer.amount);
                if transfer.resource == "ore" {
                    source_factory.current_storage = source_factory.resources.ore;
                }

                let current = get_global_resource(resources, &transfer.resource);
                let updated = (current + transfer.amount).min(warehouse_capacity);
                set_global_resource(resources, &transfer.resource, updated);
            }
        } else if transfer.from_factory_id == WAREHOUSE_NODE_ID {
            if let Some(dest_factory) = factories
                .iter_mut()
                .find(|factory| factory.id == transfer.to_factory_id)
            {
                let current = get_global_resource(resources, &transfer.resource);
                let updated = (current - transfer.amount).max(0.0);
                set_global_resource(resources, &transfer.resource, updated);

                add_factory_resource(&mut dest_factory.resources, &transfer.resource, transfer.amount);
                if transfer.resource == "ore" {
                    dest_factory.current_storage = dest_factory.resources.ore;
                }

                update_upgrade_requests_on_delivery(dest_factory, &transfer.resource, transfer.amount);
                remove_inbound_schedule(dest_factory, &transfer.from_factory_id, &transfer.resource, Some(transfer.eta));
            }
        } else {
            let mut source_idx = None;
            let mut dest_idx = None;

            for (i, factory) in factories.iter().enumerate() {
                if factory.id == transfer.from_factory_id {
                    source_idx = Some(i);
                }
                if factory.id == transfer.to_factory_id {
                    dest_idx = Some(i);
                }
            }

            if let (Some(s_idx), Some(d_idx)) = (source_idx, dest_idx) {
                if s_idx != d_idx {
                    let (left, right) = if s_idx < d_idx {
                        factories.split_at_mut(d_idx)
                    } else {
                        factories.split_at_mut(s_idx)
                    };

                    if s_idx < d_idx {
                        let source = &mut left[s_idx];
                        let dest = &mut right[0];
                        execute_arrival(source, dest, &transfer.resource, transfer.amount);
                    } else {
                        let dest = &mut left[d_idx];
                        let source = &mut right[0];
                        execute_arrival(source, dest, &transfer.resource, transfer.amount);
                    }
                }
            }
        }

        logistics_queues.pending_transfers.remove(idx);
    }
}

fn process_scheduler(
    logistics_queues: &mut LogisticsQueues,
    factories: &mut [FactorySnapshot],
    resources: &Resources,
    modules: &Modules,
    warehouse_capacity: f32,
    game_time: f32,
) {
    let resolved_configs: Vec<ResolvedHaulerConfig> = factories
        .iter()
        .map(|factory| resolve_factory_hauler_config(factory, modules))
        .collect();

    let mut warehouse_inbound: BTreeMap<String, f32> = BTreeMap::new();
    let mut warehouse_outbound: BTreeMap<String, f32> = BTreeMap::new();

    for transfer in &logistics_queues.pending_transfers {
        if transfer.to_factory_id == WAREHOUSE_NODE_ID {
            *warehouse_inbound.entry(transfer.resource.clone()).or_default() += transfer.amount;
        }
        if transfer.from_factory_id == WAREHOUSE_NODE_ID {
            *warehouse_outbound.entry(transfer.resource.clone()).or_default() += transfer.amount;
        }
    }

    let network_has_haulers = factories
        .iter()
        .any(|factory| factory.haulers_assigned.unwrap_or(0) > 0);

    for resource in RESOURCE_TYPES {
        let warehouse_stock = get_global_resource(resources, resource);
        let inbound = *warehouse_inbound.get(resource).unwrap_or(&0.0);
        let outbound = *warehouse_outbound.get(resource).unwrap_or(&0.0);

        let mut warehouse_space = (warehouse_capacity - warehouse_stock - inbound).max(0.0);
        let mut warehouse_available = (warehouse_stock - outbound).max(0.0);

        schedule_factory_to_factory_transfers(
            factories,
            resource,
            &resolved_configs,
            logistics_queues,
            game_time,
        );

        if !network_has_haulers {
            continue;
        }

        if warehouse_space > MIN_AMOUNT_EPS {
            schedule_factory_to_warehouse_transfers(
                factories,
                resource,
                &resolved_configs,
                logistics_queues,
                &mut warehouse_space,
                game_time,
            );
        }

        if warehouse_available > MIN_AMOUNT_EPS {
            schedule_warehouse_to_factory_transfers(
                factories,
                resource,
                &resolved_configs,
                logistics_queues,
                &mut warehouse_available,
                game_time,
            );
        }

        if warehouse_available > MIN_AMOUNT_EPS {
            schedule_upgrade_requests(
                factories,
                resource,
                &resolved_configs,
                logistics_queues,
                &mut warehouse_available,
                game_time,
            );
        }
    }
}

fn schedule_factory_to_factory_transfers(
    factories: &mut [FactorySnapshot],
    resource: &str,
    resolved_configs: &[ResolvedHaulerConfig],
    logistics_queues: &mut LogisticsQueues,
    game_time: f32,
) {
    let proposals = match_surplus_to_need(factories, resource, resolved_configs, game_time);

    for proposal in proposals {
        if proposal.amount <= MIN_AMOUNT_EPS {
            continue;
        }

        if reserve_outbound(
            &mut factories[proposal.from_idx],
            resource,
            proposal.amount,
        ) {
            let transfer = PendingTransfer {
                id: generate_transfer_id(logistics_queues.pending_transfers.len(), game_time),
                from_factory_id: factories[proposal.from_idx].id.clone(),
                to_factory_id: factories[proposal.to_idx].id.clone(),
                resource: resource.to_string(),
                amount: proposal.amount,
                status: "scheduled".to_string(),
                eta: proposal.eta,
                departed_at: game_time,
            };
            logistics_queues.pending_transfers.push(transfer);
        }
    }
}

fn schedule_factory_to_warehouse_transfers(
    factories: &mut [FactorySnapshot],
    resource: &str,
    resolved_configs: &[ResolvedHaulerConfig],
    logistics_queues: &mut LogisticsQueues,
    warehouse_space: &mut f32,
    game_time: f32,
) {
    for (idx, factory) in factories.iter_mut().enumerate() {
        if *warehouse_space <= MIN_AMOUNT_EPS {
            break;
        }
        if factory.haulers_assigned.unwrap_or(0) <= 0 {
            continue;
        }

        let config = &resolved_configs[idx];
        let target = compute_buffer_target(factory, resource);
        let current = get_factory_resource(&factory.resources, resource);
        let reserved_outbound = factory
            .logistics_state
            .as_ref()
            .and_then(|ls| ls.outbound_reservations.get(resource))
            .cloned()
            .unwrap_or(0.0);
        let min_reserve = compute_min_reserve(factory, resource);

        let mut available = (current - target - min_reserve - reserved_outbound).max(0.0);

        while available > MIN_AMOUNT_EPS && *warehouse_space > MIN_AMOUNT_EPS {
            let transfer_amount = available
                .min(config.capacity)
                .min(*warehouse_space);
            if transfer_amount <= MIN_AMOUNT_EPS {
                break;
            }

            if !reserve_outbound(factory, resource, transfer_amount) {
                break;
            }

            let eta = game_time + compute_travel_time(&factory.position, &WAREHOUSE_POSITION, config);
            let transfer = PendingTransfer {
                id: generate_transfer_id(logistics_queues.pending_transfers.len(), game_time),
                from_factory_id: factory.id.clone(),
                to_factory_id: WAREHOUSE_NODE_ID.to_string(),
                resource: resource.to_string(),
                amount: transfer_amount,
                status: "scheduled".to_string(),
                eta,
                departed_at: game_time,
            };

            logistics_queues.pending_transfers.push(transfer);

            *warehouse_space = (*warehouse_space - transfer_amount).max(0.0);
            available -= transfer_amount;
        }
    }
}

fn schedule_warehouse_to_factory_transfers(
    factories: &mut [FactorySnapshot],
    resource: &str,
    resolved_configs: &[ResolvedHaulerConfig],
    logistics_queues: &mut LogisticsQueues,
    warehouse_available: &mut f32,
    game_time: f32,
) {
    for (idx, factory) in factories.iter_mut().enumerate() {
        if *warehouse_available <= MIN_AMOUNT_EPS {
            break;
        }

        let config = &resolved_configs[idx];
        let target = compute_buffer_target(factory, resource);
        let current = get_factory_resource(&factory.resources, resource);
        let reserved_inbound: f32 = factory
            .logistics_state
            .as_ref()
            .map(|ls| {
                ls.inbound_schedules
                    .iter()
                    .filter(|schedule| schedule.resource == resource)
                    .map(|schedule| schedule.amount)
                    .sum()
            })
            .unwrap_or(0.0);

        let mut remaining_need = (target - current - reserved_inbound).max(0.0);

        while remaining_need > MIN_AMOUNT_EPS && *warehouse_available > MIN_AMOUNT_EPS {
            let transfer_amount = remaining_need
                .min(config.capacity)
                .min(*warehouse_available);
            if transfer_amount <= MIN_AMOUNT_EPS {
                break;
            }

            let eta = game_time + compute_travel_time(&WAREHOUSE_POSITION, &factory.position, config);
            let transfer = PendingTransfer {
                id: generate_transfer_id(logistics_queues.pending_transfers.len(), game_time),
                from_factory_id: WAREHOUSE_NODE_ID.to_string(),
                to_factory_id: factory.id.clone(),
                resource: resource.to_string(),
                amount: transfer_amount,
                status: "scheduled".to_string(),
                eta,
                departed_at: game_time,
            };

            add_inbound_schedule(factory, &transfer.from_factory_id, resource, transfer_amount, eta);
            logistics_queues.pending_transfers.push(transfer);

            *warehouse_available = (*warehouse_available - transfer_amount).max(0.0);
            remaining_need -= transfer_amount;
        }
    }
}

fn schedule_upgrade_requests(
    factories: &mut [FactorySnapshot],
    resource: &str,
    resolved_configs: &[ResolvedHaulerConfig],
    logistics_queues: &mut LogisticsQueues,
    warehouse_available: &mut f32,
    game_time: f32,
) {
    let mut requests: Vec<(usize, usize, i64)> = Vec::new();

    for (factory_idx, factory) in factories.iter().enumerate() {
        for (req_idx, request) in factory.upgrade_requests.iter().enumerate() {
            if request.status == "pending" || request.status == "partially_fulfilled" {
                requests.push((factory_idx, req_idx, request.created_at));
            }
        }
    }

    requests.sort_by_key(|(_, _, created_at)| *created_at);

    for (factory_idx, req_idx, _) in requests {
        if *warehouse_available <= MIN_AMOUNT_EPS {
            break;
        }

        let factory = &mut factories[factory_idx];
        let config = &resolved_configs[factory_idx];
        let request = factory
            .upgrade_requests
            .get(req_idx)
            .cloned()
            .unwrap_or_else(FactoryUpgradeRequestSnapshot::default);

        let needed = get_factory_resource(&request.resource_needed, resource);
        if needed <= 0.0 {
            continue;
        }
        let fulfilled = get_factory_resource(&request.fulfilled_amount, resource);
        let remaining_need = (needed - fulfilled).max(0.0);
        if remaining_need <= MIN_AMOUNT_EPS {
            continue;
        }

        let transfer_amount = remaining_need
            .min(config.capacity)
            .min(*warehouse_available);
        if transfer_amount <= MIN_AMOUNT_EPS {
            continue;
        }

        let eta = game_time + compute_travel_time(&WAREHOUSE_POSITION, &factory.position, config);
        let transfer = PendingTransfer {
            id: generate_transfer_id(logistics_queues.pending_transfers.len(), game_time),
            from_factory_id: WAREHOUSE_NODE_ID.to_string(),
            to_factory_id: factory.id.clone(),
            resource: resource.to_string(),
            amount: transfer_amount,
            status: "scheduled".to_string(),
            eta,
            departed_at: game_time,
        };

        add_inbound_schedule(factory, &transfer.from_factory_id, resource, transfer_amount, eta);
        logistics_queues.pending_transfers.push(transfer);

        *warehouse_available = (*warehouse_available - transfer_amount).max(0.0);
    }
}

struct ProposedTransfer {
    from_idx: usize,
    to_idx: usize,
    amount: f32,
    eta: f32,
}

fn match_surplus_to_need(
    factories: &[FactorySnapshot],
    resource: &str,
    resolved_configs: &[ResolvedHaulerConfig],
    game_time: f32,
) -> Vec<ProposedTransfer> {
    let mut transfers = Vec::new();

    if factories.len() < 2 {
        return transfers;
    }

    let network_has_haulers = factories
        .iter()
        .any(|factory| factory.haulers_assigned.unwrap_or(0) > 0);
    if !network_has_haulers {
        return transfers;
    }

    struct NeedEntry {
        idx: usize,
        need: f32,
        config: ResolvedHaulerConfig,
    }

    struct SurplusEntry {
        idx: usize,
        surplus: f32,
        config: ResolvedHaulerConfig,
    }

    let mut needs: Vec<NeedEntry> = Vec::new();
    let mut surpluses: Vec<SurplusEntry> = Vec::new();

    for (idx, factory) in factories.iter().enumerate() {
        let target = compute_buffer_target(factory, resource);
        let current = get_factory_resource(&factory.resources, resource);
        let need = (target - current).max(0.0);
        if need > MIN_AMOUNT_EPS {
            needs.push(NeedEntry {
                idx,
                need,
                config: resolved_configs[idx].clone(),
            });
        }

        if factory.haulers_assigned.unwrap_or(0) <= 0 {
            continue;
        }

        let min_reserve = compute_min_reserve(factory, resource);
        let surplus = (current - target - min_reserve).max(0.0);
        if surplus > MIN_AMOUNT_EPS {
            surpluses.push(SurplusEntry {
                idx,
                surplus,
                config: resolved_configs[idx].clone(),
            });
        }
    }

    needs.sort_by(|a, b| b.need.partial_cmp(&a.need).unwrap_or(std::cmp::Ordering::Equal));
    surpluses.sort_by(|a, b| b.surplus.partial_cmp(&a.surplus).unwrap_or(std::cmp::Ordering::Equal));

    for need_entry in needs.iter_mut() {
        for surplus_entry in surpluses.iter_mut() {
            if need_entry.need <= MIN_AMOUNT_EPS {
                break;
            }
            if surplus_entry.surplus <= MIN_AMOUNT_EPS {
                continue;
            }

            if !need_entry.config.matches_resource(resource) || !surplus_entry.config.matches_resource(resource) {
                continue;
            }

            let transfer_amount = need_entry
                .need
                .min(surplus_entry.surplus)
                .min(surplus_entry.config.capacity);
            if transfer_amount <= MIN_AMOUNT_EPS {
                continue;
            }

            let eta = game_time
                + compute_travel_time(
                    &factories[surplus_entry.idx].position,
                    &factories[need_entry.idx].position,
                    &surplus_entry.config,
                );

            transfers.push(ProposedTransfer {
                from_idx: surplus_entry.idx,
                to_idx: need_entry.idx,
                amount: transfer_amount,
                eta,
            });

            need_entry.need -= transfer_amount;
            surplus_entry.surplus -= transfer_amount;
        }
    }

    transfers
}

fn compute_warehouse_capacity(
    modules: &Modules,
    modifiers: &ResourceModifierSnapshot,
) -> f32 {
    let base = BASE_STORAGE + modules.storage as f32 * STORAGE_PER_LEVEL;
    base * WAREHOUSE_STORAGE_MULTIPLIER * modifiers.storage_capacity_multiplier
}

fn compute_buffer_target(factory: &FactorySnapshot, resource: &str) -> f32 {
    match resource {
        "ore" => {
            let ore_per_minute = 50.0;
            let ore_per_second = ore_per_minute / 60.0;
            LOGISTICS_BUFFER_SECONDS * ore_per_second * (factory.refine_slots as f32).max(1.0)
        }
        "bars" => 5.0,
        "metals" | "crystals" | "organics" | "ice" => 20.0,
        _ => 15.0,
    }
}

fn compute_min_reserve(_factory: &FactorySnapshot, _resource: &str) -> f32 {
    LOGISTICS_MIN_RESERVE_SECONDS * 5.0
}

fn compute_travel_time(
    source: &[f32; 3],
    dest: &[f32; 3],
    config: &ResolvedHaulerConfig,
) -> f32 {
    let dx = source[0] - dest[0];
    let dy = source[1] - dest[1];
    let dz = source[2] - dest[2];
    let distance = (dx * dx + dy * dy + dz * dz).sqrt();
    let travel = distance / config.speed.max(0.1);
    config.pickup_overhead + travel + config.dropoff_overhead
}

fn resolve_factory_hauler_config(
    factory: &FactorySnapshot,
    modules: &Modules,
) -> ResolvedHaulerConfig {
    let base_config = factory.hauler_config.as_ref();

    let base_capacity = base_config
        .map(|c| c.capacity)
        .unwrap_or(LOGISTICS_HAULER_CAPACITY);
    let base_speed = base_config
        .map(|c| c.speed)
        .unwrap_or(LOGISTICS_HAULER_SPEED);
    let base_pickup = base_config
        .map(|c| c.pickup_overhead)
        .unwrap_or(LOGISTICS_PICKUP_OVERHEAD);
    let base_dropoff = base_config
        .map(|c| c.dropoff_overhead)
        .unwrap_or(LOGISTICS_DROPOFF_OVERHEAD);

    let capacity_bonus = HAULER_DEPOT_CAPACITY_PER_LEVEL * modules.hauler_depot as f32;
    let speed_multiplier = 1.0 + HAULER_DEPOT_SPEED_MULT_PER_LEVEL * modules.hauler_depot as f32;
    let overhead_multiplier = (1.0
        - LOGISTICS_HUB_OVERHEAD_REDUCTION_PER_LEVEL * modules.logistics_hub as f32)
        .max(0.25);
    let routing_bonus =
        ROUTING_PROTOCOL_MATCHING_BONUS_PER_LEVEL * modules.routing_protocol as f32;

    let capacity_boost_levels = factory
        .hauler_upgrades
        .as_ref()
        .and_then(|u| u.capacity_boost)
        .unwrap_or(0) as f32;
    let speed_boost_levels = factory
        .hauler_upgrades
        .as_ref()
        .and_then(|u| u.speed_boost)
        .unwrap_or(0) as f32;
    let efficiency_levels = factory
        .hauler_upgrades
        .as_ref()
        .and_then(|u| u.efficiency_boost)
        .unwrap_or(0) as f32;

    let efficiency_multiplier = (1.0 - FACTORY_HAULER_EFFICIENCY_PER_LEVEL * efficiency_levels)
        .max(0.2);

    let capacity = (base_capacity + capacity_bonus
        + capacity_boost_levels * FACTORY_HAULER_CAPACITY_PER_LEVEL)
        .max(1.0);
    let speed = (base_speed * speed_multiplier
        + speed_boost_levels * FACTORY_HAULER_SPEED_PER_LEVEL)
        .max(0.05);
    let pickup_overhead = (base_pickup * overhead_multiplier * efficiency_multiplier).max(0.0);
    let dropoff_overhead = (base_dropoff * overhead_multiplier * efficiency_multiplier).max(0.0);

    ResolvedHaulerConfig {
        capacity,
        speed,
        pickup_overhead,
        dropoff_overhead,
        resource_filters: base_config
            .map(|c| c.resource_filters.clone())
            .unwrap_or_default(),
        mode: base_config
            .map(|c| c.mode.clone())
            .unwrap_or_else(|| "auto".to_string()),
        priority: base_config.map(|c| c.priority).unwrap_or(5),
        routing_efficiency_bonus: routing_bonus,
    }
}

fn validate_transfer(factory: &FactorySnapshot, resource: &str, amount: f32) -> bool {
    if amount <= MIN_AMOUNT_EPS {
        return false;
    }

    let current = get_factory_resource(&factory.resources, resource);
    let reserved = factory
        .logistics_state
        .as_ref()
        .and_then(|ls| ls.outbound_reservations.get(resource))
        .cloned()
        .unwrap_or(0.0);
    let available = (current - reserved).max(0.0);
    if available < amount - MIN_AMOUNT_EPS {
        return false;
    }

    let min_reserve = compute_min_reserve(factory, resource);
    current - amount - reserved >= min_reserve - MIN_AMOUNT_EPS
}

fn ensure_logistics_state(factory: &mut FactorySnapshot) -> &mut FactoryLogisticsState {
    if factory.logistics_state.is_none() {
        factory.logistics_state = Some(FactoryLogisticsState::default());
    }
    factory.logistics_state.as_mut().unwrap()
}

fn reserve_outbound(factory: &mut FactorySnapshot, resource: &str, amount: f32) -> bool {
    if !validate_transfer(factory, resource, amount) {
        return false;
    }

    let logistics_state = ensure_logistics_state(factory);
    let entry = logistics_state.outbound_reservations.entry(resource.to_string()).or_default();
    *entry = (*entry + amount).max(0.0);
    true
}

fn release_reservation(factory: &mut FactorySnapshot, resource: &str, amount: f32) {
    if let Some(logistics_state) = factory.logistics_state.as_mut() {
        let entry = logistics_state.outbound_reservations.entry(resource.to_string()).or_default();
        *entry = (*entry - amount).max(0.0);
    }
}

fn add_inbound_schedule(
    factory: &mut FactorySnapshot,
    from_factory_id: &str,
    resource: &str,
    amount: f32,
    eta: f32,
) {
    let logistics_state = ensure_logistics_state(factory);
    logistics_state.inbound_schedules.push(InboundSchedule {
        from_factory_id: from_factory_id.to_string(),
        resource: resource.to_string(),
        amount,
        eta,
    });
}

fn remove_inbound_schedule(
    factory: &mut FactorySnapshot,
    from_factory_id: &str,
    resource: &str,
    eta: Option<f32>,
) {
    if let Some(logistics_state) = factory.logistics_state.as_mut() {
        logistics_state.inbound_schedules.retain(|schedule| {
            if schedule.from_factory_id != from_factory_id || schedule.resource != resource {
                return true;
            }
            if let Some(expected_eta) = eta {
                (schedule.eta - expected_eta).abs() > ETA_MATCH_EPS
            } else {
                false
            }
        });
    }
}

fn execute_arrival(
    source_factory: &mut FactorySnapshot,
    dest_factory: &mut FactorySnapshot,
    resource: &str,
    amount: f32,
) {
    release_reservation(source_factory, resource, amount);
    deduct_factory_resource(&mut source_factory.resources, resource, amount);
    if resource == "ore" {
        source_factory.current_storage = source_factory.resources.ore;
    }

    add_factory_resource(&mut dest_factory.resources, resource, amount);
    if resource == "ore" {
        dest_factory.current_storage = dest_factory.resources.ore;
    }

    remove_inbound_schedule(dest_factory, &source_factory.id, resource, None);
}

fn update_upgrade_requests_on_delivery(
    factory: &mut FactorySnapshot,
    resource: &str,
    amount: f32,
) {
    for request in &mut factory.upgrade_requests {
        if request.status == "expired" || request.status == "fulfilled" {
            continue;
        }

        let needed = get_factory_resource(&request.resource_needed, resource);
        if needed <= 0.0 {
            continue;
        }

        let fulfilled = get_factory_resource(&request.fulfilled_amount, resource);
        let additional = (needed - fulfilled).max(0.0).min(amount);
        if additional > MIN_AMOUNT_EPS {
            set_factory_resource(&mut request.fulfilled_amount, resource, fulfilled + additional);

            let all_fulfilled =
                request.fulfilled_amount.ore + MIN_AMOUNT_EPS >= request.resource_needed.ore
                    && request.fulfilled_amount.bars + MIN_AMOUNT_EPS >= request.resource_needed.bars
                    && request.fulfilled_amount.metals + MIN_AMOUNT_EPS
                        >= request.resource_needed.metals
                    && request.fulfilled_amount.crystals + MIN_AMOUNT_EPS
                        >= request.resource_needed.crystals
                    && request.fulfilled_amount.organics + MIN_AMOUNT_EPS
                        >= request.resource_needed.organics
                    && request.fulfilled_amount.ice + MIN_AMOUNT_EPS >= request.resource_needed.ice
                    && request.fulfilled_amount.credits + MIN_AMOUNT_EPS
                        >= request.resource_needed.credits;

            if all_fulfilled {
                request.status = "fulfilled".to_string();
            } else if request.status == "pending" {
                request.status = "partially_fulfilled".to_string();
            }
        }
    }
}

fn generate_transfer_id(existing: usize, game_time: f32) -> String {
    format!("transfer-{}-{}", (game_time * 1000.0) as u64, existing)
}

fn deduct_factory_resource(res: &mut FactoryResourceSnapshot, key: &str, amount: f32) {
    set_factory_resource(res, key, (get_factory_resource(res, key) - amount).max(0.0));
}

fn add_factory_resource(res: &mut FactoryResourceSnapshot, key: &str, amount: f32) {
    set_factory_resource(res, key, get_factory_resource(res, key) + amount);
}

fn set_factory_resource(res: &mut FactoryResourceSnapshot, key: &str, val: f32) {
    match key {
        "ore" => res.ore = val,
        "bars" => res.bars = val,
        "metals" => res.metals = val,
        "crystals" => res.crystals = val,
        "organics" => res.organics = val,
        "ice" => res.ice = val,
        "credits" => res.credits = val,
        _ => {}
    }
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
        _ => {}
    }
}
