import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { FactoryManager } from '@/ui/FactoryManager';
import { LogisticsPanel } from '@/ui/LogisticsPanel';
import { SettingsPanel } from '@/ui/Settings';
import type { PersistenceManager } from '@/state/persistence';
import './styles.css';
import { ToastProvider } from '@/ui/ToastProvider';
import { AsteroidInspector } from '@/ui/AsteroidInspector';
import { WarehousePanel } from '@/ui/WarehousePanel';
import { DebugPanel } from '@/ui/DebugPanel';
import { useStore } from '@/state/store';

interface AppProps {
  persistence: PersistenceManager;
}

export const App = ({ persistence }: AppProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showDebugPanel = useStore((s) => s.settings.showDebugPanel);

  useEffect(() => {
    // Signal to e2e tests that the app has mounted and initial persistence/load is complete.
    if (typeof window !== 'undefined') {
      window.__appReady = true;
    }
    // Do not unset `window.__appReady` on unmount — test harnesses rely on a stable flag.
  }, []);

  return (
    <ToastProvider>
      <div className="app hud">
        <Canvas shadows camera={{ position: [0, 9, 22], fov: 52 }}>
          <Scene />
        </Canvas>
        <div className="left-rail">
          <WarehousePanel onOpenSettings={() => setSettingsOpen(true)} />
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
        {showDebugPanel ? <DebugPanel /> : null}
      </div>
    </ToastProvider>
  );
};

export default App;
