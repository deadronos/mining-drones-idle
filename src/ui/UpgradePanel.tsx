import { useMemo } from 'react';
import {
  moduleDefinitions,
  costForLevel,
  computePrestigeBonus,
  PRESTIGE_THRESHOLD,
  type ModuleId,
  useStore,
} from '@/state/store';
import { formatInteger } from '@/lib/formatters';

const moduleRows = Object.entries(moduleDefinitions) as [
  ModuleId,
  (typeof moduleDefinitions)[ModuleId],
][];

/**
 * UI Component for purchasing factory upgrades and managing prestige.
 * Displays a list of available modules (docking, refinery, etc.) with their current levels and costs.
 * Also provides the Prestige interface for resetting the game to gain Cores.
 *
 * @returns The rendered UpgradePanel component.
 */
export const UpgradePanel = () => {
  const modules = useStore((state) => state.modules);
  const resources = useStore((state) => state.resources);
  const prestige = useStore((state) => state.prestige);
  const buy = useStore((state) => state.buy);
  const bars = useStore((state) => state.resources.bars);
  const preview = useStore((state) => state.preview);
  const doPrestige = useStore((state) => state.doPrestige);

  const rows = useMemo(() => moduleRows, []);
  const nextCores = Math.floor(preview());
  // derive readiness directly from bars so the button updates reactively
  const prestigeDisabled = !(bars >= PRESTIGE_THRESHOLD);
  const bonusPercent = Math.round((computePrestigeBonus(prestige.cores) - 1) * 100);

  return (
    <aside className="panel">
      <h3>Upgrades</h3>
      {rows.map(([id, def]) => {
        const level = modules[id];
        const cost = costForLevel(def.baseCost, level);
        const affordable = resources.bars >= cost;
        return (
          <div key={id} className="row">
            <div className="left">
              <strong>{def.label}</strong> <span className="muted">Lv {level}</span>
              <div className="desc">{def.description}</div>
            </div>
            <div className="right">
              <button type="button" disabled={!affordable} onClick={() => buy(id)}>
                Buy ({formatInteger(cost)} warehouse bars)
              </button>
            </div>
          </div>
        );
      })}
      <hr />
      <h3>Prestige</h3>
      <div className="prestige-info">
        Warehouse Bars: {formatInteger(Math.floor(resources.bars))} → Next Cores:{' '}
        {formatInteger(nextCores)}
      </div>
      <button type="button" disabled={prestigeDisabled} onClick={doPrestige}>
        Prestige Run
      </button>
      <div className="muted">
        Cores: {formatInteger(prestige.cores)} • Bonus: +{bonusPercent}%
      </div>
    </aside>
  );
};
