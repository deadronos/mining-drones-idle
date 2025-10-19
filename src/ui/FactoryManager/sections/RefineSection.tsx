import type { BuildableFactory } from '@/ecs/factories';

interface RefinesectionProps {
  factory: BuildableFactory;
}

/**
 * RefineSection: Displays active refining processes if any.
 */
export const RefineSection = ({ factory }: RefinesectionProps) => {
  if (factory.activeRefines.length === 0) {
    return null;
  }

  return (
    <section className="factory-refines">
      <h4>Active Refining</h4>
      <ul>
        {factory.activeRefines.map((process) => (
          <li key={process.id}>
            {process.oreType} — {Math.round(process.progress * 100)}%
          </li>
        ))}
      </ul>
    </section>
  );
};
