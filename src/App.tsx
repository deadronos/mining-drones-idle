import { Canvas } from '@react-three/fiber';
import { Scene } from '@/r3f/Scene';
import { UpgradePanel } from '@/ui/UpgradePanel';
import { useStore } from '@/state/store';
import './styles.css';

export const App = () => {
  const resources = useStore((state) => state.resources);
  const modules = useStore((state) => state.modules);

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
      </div>
      <UpgradePanel />
    </div>
  );
};

export default App;
