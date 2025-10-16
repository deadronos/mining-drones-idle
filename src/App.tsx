import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { useStore } from '@/state/store';
import { SettingsPanel } from '@/ui/Settings';
import type { PersistenceManager } from '@/state/persistence';
import './styles.css';

interface AppProps {
  persistence: PersistenceManager;
}

export const App = ({ persistence }: AppProps) => {
  const resources = useStore((state) => state.resources);
  const modules = useStore((state) => state.modules);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <Canvas shadows camera={{ position: [0, 9, 22], fov: 52 }}>
        <Scene />
      </Canvas>
      <div className="hud">
        <div>Ore: {resources.ore.toFixed(1)}</div>
        <div>Bars: {resources.bars.toFixed(1)}</div>
        <div>Energy: {Math.round(resources.energy)}</div>
        <div>Drones: {modules.droneBay}</div>
        <button type="button" onClick={() => setSettingsOpen(true)} className="hud-button">
          Settings
        </button>
      </div>
      <UpgradePanel />
      {settingsOpen ? (
        <SettingsPanel onClose={() => setSettingsOpen(false)} persistence={persistence} />
      ) : null}
    </div>
  );
};

export default App;
