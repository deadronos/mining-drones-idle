import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';
import { WAREHOUSE_CONFIG } from '@/state/constants';

export const createDefaultFactories = (): BuildableFactory[] => [
  ((factory) => {
    factory.haulersAssigned = WAREHOUSE_CONFIG.starterFactoryHaulers;
    factory.resources.ore = Math.max(factory.resources.ore, WAREHOUSE_CONFIG.starterFactoryStock.ore);
    factory.resources.bars = Math.max(
      factory.resources.bars,
      WAREHOUSE_CONFIG.starterFactoryStock.bars,
    );
    factory.currentStorage = factory.resources.ore;
    return factory;
  })(createFactory('factory-0', new Vector3(0, 0, 0))),
];
