import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { FactoryManager } from '@/ui/FactoryManager';
import { LogisticsPanel } from '@/ui/LogisticsPanel';
import { useStore } from '@/state/store';
import { SettingsPanel } from '@/ui/Settings';
import type { PersistenceManager } from '@/state/persistence';
import './styles.css';
import { ToastProvider } from '@/ui/ToastProvider';
import { AsteroidInspector } from '@/ui/AsteroidInspector';
import { ResourceModifiersDebug } from '@/ui/ResourceModifiersDebug';

interface AppProps {
  persistence: PersistenceManager;
}

export const App = ({ persistence }: AppProps) => {
  // Select only the specific resource fields needed for HUD display to minimize re-renders
  const ore = useStore((state) => state.resources.ore);
  const metals = useStore((state) => state.resources.metals);
  const crystals = useStore((state) => state.resources.crystals);
  const organics = useStore((state) => state.resources.organics);
  const ice = useStore((state) => state.resources.ice);
  const bars = useStore((state) => state.resources.bars);
  const energy = useStore((state) => state.resources.energy);
  const droneBay = useStore((state) => state.modules.droneBay);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Signal to e2e tests that the app has mounted and initial persistence/load is complete.
    if (typeof window !== 'undefined') {
      window.__appReady = true;
    }
    // Do not unset `window.__appReady` on unmount — test harnesses rely on a stable flag.
  }, []);

  return (
    <ToastProvider>
      <div className="app">
        <Canvas shadows camera={{ position: [0, 9, 22], fov: 52 }}>
          <Scene />
        </Canvas>
        <div className="hud">
          <div>Ore: {ore.toFixed(1)}</div>
          <div>Metals: {metals.toFixed(1)}</div>
          <div>Crystals: {crystals.toFixed(1)}</div>
          <div>Organics: {organics.toFixed(1)}</div>
          <div>Ice: {ice.toFixed(1)}</div>
          <div>Bars: {bars.toFixed(1)}</div>
          <div>Energy: {Math.round(energy)}</div>
          <div>Drones: {droneBay}</div>
          <ResourceModifiersDebug />
          <button type="button" onClick={() => setSettingsOpen(true)} className="hud-button">
            Settings
          </button>
        </div>
        <div className="sidebar">
          <UpgradePanel />
          <LogisticsPanel />
          <FactoryManager />
        </div>
        <AsteroidInspector />
        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} persistence={persistence} />
        ) : null}
      </div>
    </ToastProvider>
  );
};

export default App;
