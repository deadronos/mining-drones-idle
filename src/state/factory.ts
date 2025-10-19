import { Vector3 } from 'three';
import { createFactory } from '@/ecs/factories';
import type { BuildableFactory } from '@/ecs/factories';

export const createDefaultFactories = (): BuildableFactory[] => [
  createFactory('factory-0', new Vector3(0, 0, 0)),
];
