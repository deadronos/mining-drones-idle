import { useMemo } from 'react';
import type { BuildableFactory } from '@/ecs/factories';
import { usePagination } from '../hooks/usePagination';
import { DOCKING_PAGE_SIZE } from '../utils/constants';

interface DockingSectionProps {
  factory: BuildableFactory;
}

/**
 * DockingSection: Displays docked drones with pagination.
 * Shows separation between docked (at capacity) and waiting drones.
 */
export const DockingSection = ({ factory }: DockingSectionProps) => {
  const { page, totalPages, currentItems, goNext, goPrev } = usePagination(
    factory.queuedDrones,
    DOCKING_PAGE_SIZE,
  );

  const dockingEntries = useMemo(
    () =>
      currentItems.map((droneId, idx) => ({
        droneId,
        status: idx < factory.dockingCapacity ? 'docked' : 'waiting',
      })),
    [currentItems, factory.dockingCapacity],
  );

  const queueCount = factory.queuedDrones.length;
  const docked = Math.min(queueCount, factory.dockingCapacity);
  const waiting = Math.max(0, queueCount - docked);

  return (
    <div>
      <h4>Docking</h4>
      <p>
        {docked}/{factory.dockingCapacity} docks
        {waiting > 0 ? ` (${waiting} waiting)` : ''}
      </p>
      <ul className="factory-queue">
        {dockingEntries.length === 0 ? (
          <li className="factory-queue-item empty">No drones docked</li>
        ) : (
          dockingEntries.map((entry) => (
            <li
              key={entry.droneId}
              className={`factory-queue-item${entry.status === 'waiting' ? ' waiting' : ''}`}
            >
              {entry.status === 'waiting' ? '⏳' : '🛬'} {entry.droneId}
            </li>
          ))
        )}
      </ul>
      {totalPages > 1 ? (
        <div className="factory-pagination">
          <button
            type="button"
            className="factory-page-btn"
            onClick={goPrev}
            disabled={page === 0}
            aria-label="Previous docking page"
          >
            ◀
          </button>
          <span className="factory-page-indicator">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="factory-page-btn"
            onClick={goNext}
            disabled={page >= totalPages - 1}
            aria-label="Next docking page"
          >
            ▶
          </button>
        </div>
      ) : null}
    </div>
  );
};
