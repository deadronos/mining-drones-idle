import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { Stars } from '@react-three/drei';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
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
import { TransferLines } from '@/r3f/TransferLines';
import { useFactoryAutofit } from '@/hooks/useFactoryAutofit';
import { useCameraReset } from '@/hooks/useCameraReset';
import { computeAutofitCamera, computeBoundingBox, DEFAULT_AUTOFIT_CONFIG } from '@/lib/camera';

const FOG_COLOR = '#040713';
const DEFAULT_FOG_RANGE = { near: 20, far: 90 } as const;

type SystemRunner = (dt: number) => void;

export const Scene = () => {
  const time = useMemo(() => createTimeSystem(0.1), []);
  const showTrails = useStore((state) => state.settings.showTrails);
  const factories = useStore((state) => state.factories);
  const { camera, size } = useThree();
  useFactoryAutofit();
  useCameraReset();
  const fogRange = useMemo(() => {
    if (!factories.length) {
      return DEFAULT_FOG_RANGE;
    }

    const positions = factories.map(
      (factory) => new Vector3(factory.position.x, factory.position.y, factory.position.z),
    );
    const boundingBox = computeBoundingBox(positions);
    if (!boundingBox) {
      return DEFAULT_FOG_RANGE;
    }

    const perspectiveCamera = camera as PerspectiveCamera;
    const fov = 'fov' in perspectiveCamera ? perspectiveCamera.fov : 52;
    const aspect = size.width / size.height;
    const targetState = computeAutofitCamera(positions, DEFAULT_AUTOFIT_CONFIG, fov, aspect);
    if (!targetState?.distance) {
      return DEFAULT_FOG_RANGE;
    }

    const expandedRadius = boundingBox.radius + DEFAULT_AUTOFIT_CONFIG.margin;
    const far = Math.max(DEFAULT_FOG_RANGE.far, targetState.distance + expandedRadius * 1.5);
    const nearBase = targetState.distance - expandedRadius * 1.25;
    const near = Math.max(DEFAULT_FOG_RANGE.near, Math.min(far - 30, nearBase));

    return { near, far };
  }, [factories, camera, size]);
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
      storeApi.getState().processFactories(step);
    });
  });

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, fogRange.near, fogRange.far]} />
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
        <TransferLines />
      </Suspense>
    </>
  );
};
