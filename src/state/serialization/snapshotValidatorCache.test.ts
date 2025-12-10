import { describe, it, expect } from 'vitest';
import { getSnapshotValidator } from './store';

describe('snapshot validator cache', () => {
  it('returns the same compiled validator instance on repeated access', () => {
    const v1 = getSnapshotValidator();
    const v2 = getSnapshotValidator();
    expect(v1).toBeDefined();
    expect(v1).toBe(v2);
  });
});
