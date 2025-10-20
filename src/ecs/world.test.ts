import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createGameWorld, WAREHOUSE_POSITION } from './world';

describe('ecs/world - warehouse entity', () => {
  it('creates a static warehouse at the configured position', () => {
    const world = createGameWorld();
    expect(world.warehouse).toBeDefined();
    expect(world.warehouse.kind).toBe('warehouse');
    expect(world.warehouse.position.equals(WAREHOUSE_POSITION)).toBe(true);
  });

  it('does not register the warehouse in drone or asteroid queries', () => {
    const world = createGameWorld();
    const warehouseVector = world.warehouse.position;
    expect(
      world.droneQuery.entities.every((drone) => !drone.position.equals(warehouseVector)),
    ).toBe(true);
    expect(
      world.asteroidQuery.entities.every((asteroid) => !asteroid.position.equals(warehouseVector)),
    ).toBe(true);
  });

  it('provides a unique position instance for the warehouse', () => {
    const firstWorld = createGameWorld();
    const secondWorld = createGameWorld();
    expect(firstWorld.warehouse.position).not.toBe(secondWorld.warehouse.position);
    expect(firstWorld.warehouse.position).toBeInstanceOf(Vector3);
  });
});
