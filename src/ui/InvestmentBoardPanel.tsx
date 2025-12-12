import { useMemo } from 'react';
import {
  useStore,
  prestigeInvestmentDefinitions,
  type PrestigeInvestmentId,
  type SpecTechSpentState,
} from '@/state/store';
import {
  getPrestigeInvestmentCost,
  getSinkBonuses,
} from '@/state/sinks';
import { formatInteger, formatPercent } from '@/lib/formatters';

interface InvestmentEntry {
  id: PrestigeInvestmentId;
  name: string;
  description: string;
  resource: keyof SpecTechSpentState;
  level: number;
  cost: number;
  bonusPerTier: number;
  totalBonus: number;
  canAfford: boolean;
}

export const InvestmentBoardPanel = () => {
  const resources = useStore((state) => state.resources);
  const prestigeInvestments = useStore((state) => state.prestigeInvestments);
  const investPrestige = useStore((state) => state.investPrestige);
  const specTechs = useStore((state) => state.specTechs);
  const sinkBonuses = useMemo(
    () => getSinkBonuses({ specTechs, prestigeInvestments }),
    [specTechs, prestigeInvestments],
  );

  const investments = useMemo<InvestmentEntry[]>(() => {
    return (Object.keys(prestigeInvestmentDefinitions) as PrestigeInvestmentId[]).map((id) => {
      const definition = prestigeInvestmentDefinitions[id];
      const level = prestigeInvestments[id] ?? 0;
      const cost = getPrestigeInvestmentCost(id, level);
      const resource = definition.resource;
      const available = resources[resource] ?? 0;
      const totalBonus = level * definition.bonusPerTier;
      return {
        id,
        name: definition.label,
        description: definition.description,
        resource,
        level,
        cost,
        bonusPerTier: definition.bonusPerTier,
        totalBonus,
        canAfford: available >= cost,
      };
    });
  }, [prestigeInvestments, resources]);

  if (investments.length === 0) {
    return null;
  }

  return (
    <section className="warehouse-panel__section warehouse-panel__investments" aria-live="polite">
      <h3 className="warehouse-panel__section-title">Prestige Investment Board</h3>
      <p className="warehouse-panel__investments-summary">
        Global bonuses stack with specialization techs. Current multipliers:
        {' '}
        <span title="Drone Velocity">Speed {formatPercent(sinkBonuses.droneSpeedMultiplier - 1)}</span>,
        {' '}
        <span title="Asteroid Abundance">Spawn {formatPercent(sinkBonuses.asteroidSpawnMultiplier - 1)}</span>,
        {' '}
        <span title="Refinery Mastery">Refinery {formatPercent(sinkBonuses.refineryYieldMultiplier - 1)}</span>,
        {' '}
        <span title="Offline Efficiency">Offline {formatPercent(sinkBonuses.offlineProgressMultiplier - 1)}</span>
      </p>
      <ul className="warehouse-panel__investment-list">
        {investments.map((investment) => (
          <li key={investment.id} className="warehouse-panel__investment-item">
            <header className="warehouse-panel__investment-header">
              <div className="warehouse-panel__investment-title">
                <span className="warehouse-panel__investment-name">{investment.name}</span>
                <span className="warehouse-panel__investment-level">
                  Tier {investment.level}
                </span>
              </div>
              <span className="warehouse-panel__investment-bonus">
                Total Bonus: {formatPercent(investment.totalBonus)}
              </span>
            </header>
            <p className="warehouse-panel__investment-description">{investment.description}</p>
            <div className="warehouse-panel__investment-actions">
              <button
                type="button"
                className="warehouse-panel__investment-button"
                disabled={!investment.canAfford}
                onClick={() => investPrestige(investment.id)}
              >
                Invest {formatInteger(investment.cost)} {investment.resource}
              </button>
              <span className="warehouse-panel__investment-effect">
                +{formatPercent(investment.bonusPerTier)} per tier
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
