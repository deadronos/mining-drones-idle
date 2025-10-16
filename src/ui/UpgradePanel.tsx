import { useMemo } from 'react';
import {
  moduleDefinitions,
  costForLevel,
  computePrestigeBonus,
  type ModuleId,
  useStore,
} from '@/state/store';

const moduleRows = Object.entries(moduleDefinitions) as [
  ModuleId,
  (typeof moduleDefinitions)[ModuleId],
][];

export const UpgradePanel = () => {
  const modules = useStore((state) => state.modules);
  const resources = useStore((state) => state.resources);
  const prestige = useStore((state) => state.prestige);
  const buy = useStore((state) => state.buy);
  const prestigeReady = useStore((state) => state.prestigeReady);
  const preview = useStore((state) => state.preview);
  const doPrestige = useStore((state) => state.doPrestige);

  const rows = useMemo(() => moduleRows, []);
  const nextCores = Math.floor(preview());
  const prestigeDisabled = !prestigeReady();
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
                Buy ({cost.toLocaleString()} bars)
              </button>
            </div>
          </div>
        );
      })}
      <hr />
      <h3>Prestige</h3>
      <div className="prestige-info">
        Bars: {Math.floor(resources.bars).toLocaleString()} → Next Cores:{' '}
        {nextCores.toLocaleString()}
      </div>
      <button type="button" disabled={prestigeDisabled} onClick={doPrestige}>
        Prestige Run
      </button>
      <div className="muted">
        Cores: {prestige.cores.toLocaleString()} • Bonus: +{bonusPercent}%
      </div>
    </aside>
  );
};
