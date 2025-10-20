import type { BuildableFactory } from '@/ecs/factories';
import { computeHaulerCost } from '@/ecs/logistics';

interface HaulerSectionProps {
  factory: BuildableFactory;
  onAssignHaulers: (factoryId: string, count: number) => boolean;
}

/**
 * HaulerSection: Displays hauler assignment controls and logistics status.
 */
export const HaulerSection = ({ factory, onAssignHaulers }: HaulerSectionProps) => {
  const nextCost = computeHaulerCost(factory.haulersAssigned ?? 0);
  const canAffordNext = factory.resources.bars >= nextCost;

  return (
    <section className="factory-haulers">
      <h4>Hauler Logistics</h4>
      <div className="hauler-controls">
        <div className="hauler-count">
          <span className="label">Assigned Haulers:</span>
          <span className="count">{factory.haulersAssigned ?? 0}</span>
        </div>
        <div className="hauler-buttons">
          <button
            type="button"
            onClick={() => onAssignHaulers(factory.id, 1)}
            className="hauler-btn"
            aria-label="Add hauler"
            title={`Cost: ${Math.ceil(nextCost)} bars`}
            disabled={!canAffordNext}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              const current = factory.haulersAssigned ?? 0;
              if (current > 0) {
                onAssignHaulers(factory.id, -1);
              }
            }}
            className="hauler-btn"
            aria-label="Remove hauler"
            disabled={(factory.haulersAssigned ?? 0) === 0}
          >
            -
          </button>
        </div>
      </div>
      {(() => {
        return (factory.haulersAssigned ?? 0) > 0 ? (
          <div className="hauler-info">
            <p className="desc">
              This factory has {factory.haulersAssigned} hauler
              {factory.haulersAssigned === 1 ? '' : 's'} assigned.
            </p>
            <p className="next-cost">Next: {Math.ceil(nextCost)} bars</p>
          </div>
        ) : (
          <p className="muted small">
            Next: {Math.ceil(nextCost)} bars · Assign haulers to enable automatic resource
            transfers.
          </p>
        );
      })()}
    </section>
  );
};
