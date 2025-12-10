use crate::constants::{BASE_STORAGE, STORAGE_PER_LEVEL};
use crate::schema::{FactorySnapshot, LogisticsQueues, Resources, Modules, FactoryResourceSnapshot};

const WAREHOUSE_NODE_ID: &str = "warehouse";
const WAREHOUSE_STORAGE_MULTIPLIER: f32 = 8.0;

pub fn sys_logistics(
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
