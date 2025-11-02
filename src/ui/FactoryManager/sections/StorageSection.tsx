import { useMemo } from 'react';
import type { BuildableFactory } from '@/ecs/factories';
import { buildStorageEntries } from '../utils/storageDisplay';
import { useStore } from '@/state/store';
import { getResourceModifiers } from '@/lib/resourceModifiers';

interface StorageSectionProps {
  factory: BuildableFactory;
}

/**
 * StorageSection: Displays all resource storage with amounts and capacity.
 */
export const StorageSection = ({ factory }: StorageSectionProps) => {
  const resources = useStore((s) => s.resources);
  const prestigeCores = useStore((s) => s.prestige.cores);
  const modifiers = getResourceModifiers(resources, prestigeCores);
  const storageEntries = useMemo(() => buildStorageEntries(factory, modifiers), [factory, modifiers]);

  return (
    <div>
      <h4>Storage</h4>
      <ul className="factory-storage-list">
        {storageEntries.map((entry) => (
          <li
              key={entry.key}
              className={entry.amount > 0 ? 'storage-row' : 'storage-row muted'}
              aria-label={`${entry.label}: ${entry.display}${entry.bufferTarget ? ` (buffer: ${Math.floor(entry.bufferTarget)})` : ''}`}
              title={
                entry.key === 'ore'
                  ? `Effective capacity includes metals bonus: ${entry.display.split('/').pop()?.trim()}`
                  : undefined
              }
            >
            <span className="storage-name">{entry.label}</span>
            <span className="storage-value">
              {entry.display}
              {entry.bufferTarget ? ` (buf: ${Math.floor(entry.bufferTarget)})` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
