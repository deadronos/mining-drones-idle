import { describe, expect, it } from 'vitest';
import { createAsteroid } from '@/ecs/world';
import { createRng } from '@/lib/rng';

describe('ecs/systems/asteroids', () => {
  it('spawns richer asteroids with higher scanner level', () => {
    const samples = (level: number) => {
      const rng = createRng(12345);
      let total = 0;
      for (let index = 0; index < 20; index += 1) {
        total += createAsteroid(level, rng).richness;
      }
      return total / 20;
    };
    const base = samples(0);
    const boosted = samples(5);
    expect(boosted).toBeGreaterThan(base);
  });
});
