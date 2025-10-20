import type { BuildableFactory } from '@/ecs/factories';
import { usePagination } from '../hooks/usePagination';
import { ROSTER_PAGE_SIZE } from '../utils/constants';

interface RosterSectionProps {
  factory: BuildableFactory;
}

/**
 * RosterSection: Displays owned drones roster with pagination.
 */
export const RosterSection = ({ factory }: RosterSectionProps) => {
  const { page, totalPages, currentItems, goNext, goPrev } = usePagination(
    factory.ownedDrones,
    ROSTER_PAGE_SIZE,
  );

  if (factory.ownedDrones.length === 0) {
    return (
      <section className="factory-roster">
        <h4>Owned Drones</h4>
        <p className="muted">No drones assigned yet.</p>
      </section>
    );
  }

  return (
    <section className="factory-roster">
      <h4>Owned Drones</h4>
      <ul className="factory-roster-list">
        {currentItems.map((droneId) => (
          <li key={droneId}>{droneId}</li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="factory-pagination roster">
          <button
            type="button"
            className="factory-page-btn"
            onClick={goPrev}
            disabled={page === 0}
            aria-label="Previous owned drones page"
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
            aria-label="Next owned drones page"
          >
            ▶
          </button>
        </div>
      ) : null}
    </section>
  );
};
