import { describe, expect, it } from 'vitest';
import { normalizeSnapshot, validateSnapshotForWasm } from '@/state/serialization/store';
import { createStoreInstance, SCHEMA_VERSION, serializeStore } from '@/state/store';

describe('schema version handling', () => {
  it('normalizes schemaVersion to the current constant', () => {
    const normalized = normalizeSnapshot({ schemaVersion: '0.0.1' } as never);
    expect(normalized.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('flags mismatched schemaVersion during validation', () => {
    const base = serializeStore(createStoreInstance().getState());
    const issues = validateSnapshotForWasm({ ...base, schemaVersion: '0.0.1' } as never);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain(SCHEMA_VERSION);
  });
});
