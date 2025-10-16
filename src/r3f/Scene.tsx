import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { Stars } from '@react-three/drei';
import { gameWorld } from '@/ecs/world';
import { storeApi, useStore } from '@/state/store';
import { createTimeSystem } from '@/ecs/systems/time';
import { createFleetSystem } from '@/ecs/systems/fleet';
import { createAsteroidSystem } from '@/ecs/systems/asteroids';
import { createDroneAISystem } from '@/ecs/systems/droneAI';
import { createTravelSystem } from '@/ecs/systems/travel';
import { createMiningSystem } from '@/ecs/systems/mining';
import { createUnloadSystem } from '@/ecs/systems/unload';
import { createPowerSystem } from '@/ecs/systems/power';
import { createRefinerySystem } from '@/ecs/systems/refinery';
import { createBiomeSystem } from '@/ecs/systems/biomes';
import { Factory } from '@/r3f/Factory';
import { Asteroids } from '@/r3f/Asteroids';
import { Drones } from '@/r3f/Drones';
import { DroneTrails } from '@/r3f/DroneTrails';

type SystemRunner = (dt: number) => void;

export const Scene = () => {
  const time = useMemo(() => createTimeSystem(0.1), []);
  const showTrails = useStore((state) => state.settings.showTrails);
  const systems = useMemo(() => {
    const store = storeApi;
    return {
      biomes: createBiomeSystem(gameWorld),
      fleet: createFleetSystem(gameWorld, store),
      asteroids: createAsteroidSystem(gameWorld, store),
      droneAI: createDroneAISystem(gameWorld, store),
      travel: createTravelSystem(gameWorld, store),
      mining: createMiningSystem(gameWorld, store),
      unload: createUnloadSystem(gameWorld, store),
      power: createPowerSystem(gameWorld, store),
      refinery: createRefinerySystem(gameWorld, store),
    } satisfies Record<string, SystemRunner>;
  }, []);

  useFrame((_state, delta) => {
    const clamped = Math.min(delta, 0.25);
    time.update(clamped, (step) => {
      systems.fleet(step);
      systems.biomes(step);
      systems.asteroids(step);
      systems.droneAI(step);
      systems.travel(step);
      systems.mining(step);
      systems.unload(step);
      systems.power(step);
      systems.refinery(step);
    });
  });

  return (
    <>
      <color attach="background" args={['#040713']} />
      <fog attach="fog" args={['#040713', 20, 90]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-8, 4, -6]} intensity={0.6} color="#38bdf8" />
      <Suspense fallback={null}>
        <Stars radius={120} depth={60} count={4000} factor={4} fade speed={0.2} />
        <Factory />
        <Asteroids />
        <Drones />
        {showTrails ? <DroneTrails /> : null}
      </Suspense>
    </>
  );
};
