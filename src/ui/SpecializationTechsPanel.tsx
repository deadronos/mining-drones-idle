import { useMemo } from 'react';
import {
  useStore,
  specTechDefinitions,
  type SpecTechId,
  type SpecTechSpentState,
} from '@/state/store';
import {
  getSpecTechCost,
  getSpecTechUnlockProgress,
  getSpecTechMaxLevel,
} from '@/state/sinks';

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percentFormatter = (value: number) => `${(value * 100).toFixed(1)}%`;

interface TechEntry {
  id: SpecTechId;
  name: string;
  description: string;
  resource: keyof SpecTechSpentState;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  spent: number;
  required: number;
  cost: number;
  bonusPerLevel: number;
  totalBonus: number;
  canAfford: boolean;
  lockedReason?: string;
  maxed: boolean;
}

export const SpecializationTechsPanel = () => {
  const specTechs = useStore((state) => state.specTechs);
  const specTechSpent = useStore((state) => state.specTechSpent);
  const resources = useStore((state) => state.resources);
  const purchaseSpecTech = useStore((state) => state.purchaseSpecTech);

  const techs = useMemo<TechEntry[]>(() => {
    return (Object.keys(specTechDefinitions) as SpecTechId[]).map((id) => {
      const definition = specTechDefinitions[id];
      const level = specTechs[id] ?? 0;
      const maxLevel = getSpecTechMaxLevel(id);
      const { unlocked, spent, required } = getSpecTechUnlockProgress(specTechSpent, id);
      const cost = getSpecTechCost(id, level);
      const resource = definition.resource;
      const available = resources[resource] ?? 0;
      const bonusPerLevel = definition.bonusPerLevel;
      const totalBonus = level * bonusPerLevel;
      const maxed = level >= maxLevel;
      let lockedReason: string | undefined;
      if (!unlocked) {
        lockedReason = `Spend ${integerFormatter.format(required)} ${resource} to unlock`;
      }
      return {
        id,
        name: definition.label,
        description: definition.description,
        resource,
        level,
        maxLevel,
        unlocked,
        spent,
        required,
        cost,
        bonusPerLevel,
        totalBonus,
        canAfford: available >= cost && unlocked && !maxed,
        lockedReason,
        maxed,
      };
    });
  }, [resources, specTechSpent, specTechs]);

  if (techs.length === 0) {
    return null;
  }

  return (
    <section className="warehouse-panel__section warehouse-panel__techs" aria-live="polite">
      <h3 className="warehouse-panel__section-title">Specialization Techs</h3>
      <ul className="warehouse-panel__tech-list">
        {techs.map((tech) => (
          <li key={tech.id} className="warehouse-panel__tech-item">
            <header className="warehouse-panel__tech-header">
              <div className="warehouse-panel__tech-title">
                <span className="warehouse-panel__tech-name">{tech.name}</span>
                <span className="warehouse-panel__tech-level">
                  Level {tech.level} / {tech.maxLevel}
                </span>
              </div>
              <span className="warehouse-panel__tech-bonus">
                Total Bonus: {percentFormatter(tech.totalBonus)}
              </span>
            </header>
            <p className="warehouse-panel__tech-description">{tech.description}</p>
            <p className="warehouse-panel__tech-progress">
              {tech.unlocked ? (
                <>Spent {integerFormatter.format(tech.spent)} {tech.resource}</>
              ) : (
                <>
                  Locked · {tech.lockedReason} (current {integerFormatter.format(tech.spent)})
                </>
              )}
            </p>
            <div className="warehouse-panel__tech-actions">
              <button
                type="button"
                className="warehouse-panel__tech-button"
                disabled={!tech.canAfford}
                onClick={() => purchaseSpecTech(tech.id)}
              >
                {tech.maxed
                  ? 'Maxed'
                  : `Invest ${integerFormatter.format(tech.cost)} ${tech.resource}`}
              </button>
              <span className="warehouse-panel__tech-effect">
                +{percentFormatter(tech.bonusPerLevel)} per level
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
