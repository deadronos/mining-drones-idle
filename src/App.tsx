import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { useStore } from '@/state/store';
import { SettingsPanel } from '@/ui/Settings';
import type { PersistenceManager } from '@/state/persistence';
import './styles.css';
import { ToastProvider } from '@/ui/ToastProvider';
import { AsteroidInspector } from '@/ui/AsteroidInspector';

interface AppProps {
  persistence: PersistenceManager;
}

export const App = ({ persistence }: AppProps) => {
  const resources = useStore((state) => state.resources);
  const modules = useStore((state) => state.modules);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="app">
        <Canvas shadows camera={{ position: [0, 9, 22], fov: 52 }}>
          <Scene />
        </Canvas>
        <div className="hud">
          <div>Ore: {resources.ore.toFixed(1)}</div>
          <div>Metals: {resources.metals.toFixed(1)}</div>
          <div>Crystals: {resources.crystals.toFixed(1)}</div>
          <div>Organics: {resources.organics.toFixed(1)}</div>
          <div>Ice: {resources.ice.toFixed(1)}</div>
          <div>Bars: {resources.bars.toFixed(1)}</div>
          <div>Energy: {Math.round(resources.energy)}</div>
          <div>Drones: {modules.droneBay}</div>
          <button type="button" onClick={() => setSettingsOpen(true)} className="hud-button">
            Settings
          </button>
        </div>
        <UpgradePanel />
        <AsteroidInspector />
        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} persistence={persistence} />
        ) : null}
      </div>
    </ToastProvider>
  );
};

export default App;
