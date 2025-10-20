import type { BuildableFactory } from '@/ecs/factories';
import { getFactorySolarRegen, getFactorySolarLocalRegen } from '@/state/store';

interface EnergySectionProps {
  factory: BuildableFactory;
}

/**
 * EnergySection: Displays energy bar and solar regeneration status.
 */
export const EnergySection = ({ factory }: EnergySectionProps) => {
  const energyPercent = factory.energyCapacity > 0 ? factory.energy / factory.energyCapacity : 0;
  const solarLevel = factory.upgrades?.solar ?? 0;
  const globalRegen = getFactorySolarRegen(solarLevel);
  const localRegen = getFactorySolarLocalRegen(solarLevel);
  const totalRegen = globalRegen + localRegen;

  return (
    <div>
      <h4>Energy</h4>
      <p>
        {Math.round(factory.energy).toLocaleString()} / {factory.energyCapacity.toLocaleString()}
      </p>
      <div className="factory-bar">
        <div
          className="factory-bar-fill"
          style={{ width: `${Math.min(1, energyPercent) * 100}%` }}
        />
      </div>
      {totalRegen > 0 ? (
        <p className="muted" aria-label={`Solar regeneration ${totalRegen.toFixed(2)} per second`}>
          Solar regen: {localRegen.toFixed(2)}/s (local) {globalRegen.toFixed(2)}/s (global)
        </p>
      ) : null}
    </div>
  );
};
