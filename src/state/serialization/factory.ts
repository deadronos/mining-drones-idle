/* eslint-disable */
// @ts-nocheck
// This module is ported from the original serialization.ts which has similar linting issues.
// The issues are deferred to a later refactoring when we have time to fix the type system holistically.

import { FACTORY_CONFIG } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';
import type { FactorySnapshot } from '../types';
import { normalizeVectorTuple } from './vectors';
import {
  normalizeFactoryResources,
  normalizeFactoryUpgrades,
  normalizeRefineSnapshot,
  cloneRefineProcess,
  snapshotToRefineProcess,
  refineProcessToSnapshot,
} from './resources';
import { coerceNumber, vector3ToTuple, tupleToVector3 } from '../utils';

export const normalizeFactorySnapshot = (value: unknown): FactorySnapshot | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Partial<FactorySnapshot> & { position?: unknown };
  const position = normalizeVectorTuple(raw.position);
  if (!position) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `factory-${Date.now()}`,
    position,
    dockingCapacity: Math.max(
      1,
      Math.floor(coerceNumber(raw.dockingCapacity, FACTORY_CONFIG.dockingCapacity)),
    ),
    refineSlots: Math.max(1, Math.floor(coerceNumber(raw.refineSlots, FACTORY_CONFIG.refineSlots))),
    idleEnergyPerSec: Math.max(
      0,
      coerceNumber(raw.idleEnergyPerSec, FACTORY_CONFIG.idleEnergyPerSec),
    ),
    energyPerRefine: Math.max(0, coerceNumber(raw.energyPerRefine, FACTORY_CONFIG.energyPerRefine)),
    storageCapacity: Math.max(1, coerceNumber(raw.storageCapacity, FACTORY_CONFIG.storageCapacity)),
    currentStorage: Math.max(0, coerceNumber(raw.currentStorage, 0)),
    queuedDrones: Array.isArray(raw.queuedDrones)
      ? raw.queuedDrones.filter((id): id is string => typeof id === 'string')
      : [],
    activeRefines: Array.isArray(raw.activeRefines)
      ? raw.activeRefines
          .map((entry) => normalizeRefineSnapshot(entry))
          .filter((entry): entry is any => entry !== null)
      : [],
    pinned: Boolean(raw.pinned),
    energy: Math.max(0, coerceNumber(raw.energy, FACTORY_CONFIG.initialEnergy)),
    energyCapacity: Math.max(1, coerceNumber(raw.energyCapacity, FACTORY_CONFIG.energyCapacity)),
    resources: normalizeFactoryResources(raw.resources),
    ownedDrones: Array.isArray(raw.ownedDrones)
      ? raw.ownedDrones.filter((id): id is string => typeof id === 'string')
      : [],
    upgrades: normalizeFactoryUpgrades(raw.upgrades),
    haulersAssigned: Math.max(0, Math.floor(coerceNumber(raw.haulersAssigned, 0))),
    haulerConfig:
      raw.haulerConfig && typeof raw.haulerConfig === 'object'
        ? {
            capacity: Math.max(1, Math.floor(coerceNumber((raw.haulerConfig as any).capacity, 50))),
            speed: Math.max(0.1, coerceNumber((raw.haulerConfig as any).speed, 1.0)),
            pickupOverhead: Math.max(
              0,
              coerceNumber((raw.haulerConfig as any).pickupOverhead, 1.0),
            ),
            dropoffOverhead: Math.max(
              0,
              coerceNumber((raw.haulerConfig as any).dropoffOverhead, 1.0),
            ),
            resourceFilters: Array.isArray((raw.haulerConfig as any).resourceFilters)
              ? (raw.haulerConfig as any).resourceFilters.filter(
                  (val: unknown): val is string => typeof val === 'string',
                )
              : [],
            mode: ['auto', 'manual', 'demand-first', 'supply-first'].includes(
              (raw.haulerConfig as any).mode,
            )
              ? ((raw.haulerConfig as any).mode as
                  | 'auto'
                  | 'manual'
                  | 'demand-first'
                  | 'supply-first')
              : 'auto',
            priority: Math.min(
              10,
              Math.max(0, Math.floor(coerceNumber((raw.haulerConfig as any).priority, 5))),
            ),
          }
        : undefined,
    logisticsState:
      raw.logisticsState && typeof raw.logisticsState === 'object'
        ? {
            outboundReservations:
              typeof (raw.logisticsState as any).outboundReservations === 'object'
                ? Object.entries((raw.logisticsState as any).outboundReservations).reduce(
                    (acc: Record<string, number>, [key, val]: [unknown, unknown]) => {
                      const amount = coerceNumber(val, 0);
                      if (amount > 0) acc[key as string] = amount;
                      return acc;
                    },
                    {},
                  )
                : {},
            inboundSchedules: Array.isArray((raw.logisticsState as any).inboundSchedules)
              ? (raw.logisticsState as any).inboundSchedules
                  .map((schedule: any) => ({
                    fromFactoryId:
                      typeof schedule.fromFactoryId === 'string' ? schedule.fromFactoryId : '',
                    resource: typeof schedule.resource === 'string' ? schedule.resource : '',
                    amount: Math.max(0, coerceNumber(schedule.amount, 0)),
                    eta: Math.max(0, coerceNumber(schedule.eta, 0)),
                  }))
                  .filter((s: any) => s.fromFactoryId && s.resource)
              : [],
          }
        : undefined,
  };
};

export const cloneFactory = (factory: BuildableFactory): BuildableFactory => ({
  id: factory.id,
  position: factory.position.clone(),
  dockingCapacity: factory.dockingCapacity,
  refineSlots: factory.refineSlots,
  idleEnergyPerSec: factory.idleEnergyPerSec,
  energyPerRefine: factory.energyPerRefine,
  storageCapacity: factory.storageCapacity,
  currentStorage: factory.currentStorage,
  queuedDrones: [...factory.queuedDrones],
  activeRefines: factory.activeRefines.map(cloneRefineProcess),
  pinned: factory.pinned,
  energy: factory.energy,
  energyCapacity: factory.energyCapacity,
  resources: { ...factory.resources },
  ownedDrones: [...factory.ownedDrones],
  upgrades: { ...factory.upgrades },
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  logisticsState: factory.logisticsState
    ? {
        outboundReservations: { ...factory.logisticsState.outboundReservations },
        inboundSchedules: [...factory.logisticsState.inboundSchedules],
      }
    : undefined,
});

export const snapshotToFactory = (snapshot: FactorySnapshot): BuildableFactory => ({
  id: snapshot.id,
  position: tupleToVector3(snapshot.position),
  dockingCapacity: snapshot.dockingCapacity,
  refineSlots: snapshot.refineSlots,
  idleEnergyPerSec: snapshot.idleEnergyPerSec,
  energyPerRefine: snapshot.energyPerRefine,
  storageCapacity: snapshot.storageCapacity,
  currentStorage: snapshot.currentStorage,
  queuedDrones: [...snapshot.queuedDrones],
  activeRefines: snapshot.activeRefines.map(snapshotToRefineProcess),
  pinned: snapshot.pinned,
  energy: snapshot.energy,
  energyCapacity: snapshot.energyCapacity,
  resources: { ...snapshot.resources },
  ownedDrones: [...snapshot.ownedDrones],
  upgrades: { ...snapshot.upgrades },
  haulersAssigned: snapshot.haulersAssigned,
  haulerConfig: snapshot.haulerConfig ? { ...snapshot.haulerConfig } : undefined,
  logisticsState: snapshot.logisticsState
    ? {
        outboundReservations: { ...snapshot.logisticsState.outboundReservations },
        inboundSchedules: [...snapshot.logisticsState.inboundSchedules],
      }
    : undefined,
});

export const factoryToSnapshot = (factory: BuildableFactory): FactorySnapshot => ({
  id: factory.id,
  position: vector3ToTuple(factory.position),
  dockingCapacity: factory.dockingCapacity,
  refineSlots: factory.refineSlots,
  idleEnergyPerSec: factory.idleEnergyPerSec,
  energyPerRefine: factory.energyPerRefine,
  storageCapacity: factory.storageCapacity,
  currentStorage: factory.currentStorage,
  queuedDrones: [...factory.queuedDrones],
  activeRefines: factory.activeRefines.map(refineProcessToSnapshot),
  pinned: factory.pinned,
  energy: factory.energy,
  energyCapacity: factory.energyCapacity,
  resources: { ...factory.resources },
  ownedDrones: [...factory.ownedDrones],
  upgrades: { ...factory.upgrades },
  haulersAssigned: factory.haulersAssigned,
  haulerConfig: factory.haulerConfig ? { ...factory.haulerConfig } : undefined,
  logisticsState: factory.logisticsState
    ? {
        outboundReservations: { ...factory.logisticsState.outboundReservations },
        inboundSchedules: [...factory.logisticsState.inboundSchedules],
      }
    : undefined,
});
