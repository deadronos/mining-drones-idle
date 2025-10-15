import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAsteroid } from '@/ecs/world';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ecs/systems/asteroids', () => {
  it('spawns richer asteroids with higher scanner level', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const samples = (level: number) =>
      Array.from({ length: 20 }, () => createAsteroid(level)).reduce(
        (sum, asteroid) => sum + asteroid.richness,
        0,
      ) / 20;
    const base = samples(0);
    const boosted = samples(5);
    expect(boosted).toBeGreaterThan(base);
  });
});
