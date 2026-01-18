import { describe, it, expect } from 'vitest';
import { generateUniqueId } from './utils';

describe('generateUniqueId', () => {
  it('generates a unique ID without prefix', () => {
    const id1 = generateUniqueId();
    const id2 = generateUniqueId();
    
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1).toContain('-');
  });

  it('generates a unique ID with prefix', () => {
    const id1 = generateUniqueId('factory-');
    const id2 = generateUniqueId('factory-');
    
    expect(id1).toMatch(/^factory-/);
    expect(id2).toMatch(/^factory-/);
    expect(id1).not.toBe(id2);
  });

  it('generates different IDs with different prefixes', () => {
    const factoryId = generateUniqueId('factory-');
    const toastId = generateUniqueId('toast-');
    
    expect(factoryId).toMatch(/^factory-/);
    expect(toastId).toMatch(/^toast-/);
    expect(factoryId).not.toBe(toastId);
  });

  it('generates IDs with timestamp and random component', () => {
    const id = generateUniqueId();
    const parts = id.split('-');
    
    // Should have at least 2 parts: timestamp and random
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('generates many unique IDs', () => {
    const ids = new Set<string>();
    const count = 100;
    
    for (let i = 0; i < count; i++) {
      ids.add(generateUniqueId());
    }
    
    // All IDs should be unique
    expect(ids.size).toBe(count);
  });
});
