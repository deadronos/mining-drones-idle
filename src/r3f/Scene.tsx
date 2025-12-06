import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useState, useEffect } from 'react';
import { Stars } from '@react-three/drei';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { gameWorld, resetWorld } from '@/ecs/world';
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
import { HaulerShips } from '@/r3f/HaulerShips';
import { Warehouse } from '@/r3f/Warehouse';
import { useFactoryAutofit } from '@/hooks/useFactoryAutofit';
import { useCameraReset } from '@/hooks/useCameraReset';
import { computeAutofitCamera, computeBoundingBox, DEFAULT_AUTOFIT_CONFIG } from '@/lib/camera';
import { useRustEngine } from '@/hooks/useRustEngine';
import { checkParity } from '@/lib/parityLogger';

import { RustDrones } from '@/r3f/RustDrones';
import { RustAsteroids } from '@/r3f/RustAsteroids';

const FOG_COLOR = '#040713';
const DEFAULT_FOG_RANGE = { near: 20, far: 90 } as const;
const PARITY_CHECK_INTERVAL = 60; // Check every 60 frames

type SystemRunner = (dt: number) => void;

/**
 * Main 3D Scene component.
 * Sets up lighting, fog, and renders the game world entities.
 * Orchestrates the game loop (ECS systems, store updates) via `useFrame`.
 * Handles both TypeScript-based and Rust/WASM-based simulation modes.
 *
 * @returns The rendered 3D scene.
 */
export const Scene = () => {
  const rngSeed = useStore((state) => state.rngSeed);
  const [ready, setReady] = useState(false);
  const { bridge, isLoaded } = useRustEngine(ready);
  const time = useMemo(() => createTimeSystem(0.1), []);
  const showTrails = useStore((state) => state.settings.showTrails);
  const showHaulerShips = useStore((state) => state.settings.showHaulerShips);
  const useRustSim = useStore((state) => state.settings.useRustSim);
  const factories = useStore((state) => state.factories);
  const { camera, size } = useThree();
  useFactoryAutofit();
  useCameraReset();

  // Frame counter for parity checks
  const frameCount = useMemo(() => ({ current: 0 }), []);

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

  // Handle reset and initial population
  useEffect(() => {
    // Reset world with new seed
    resetWorld(rngSeed);

    // Force populate systems
    systems.asteroids(0);
    systems.fleet(0);

    setReady(true);
  }, [rngSeed, systems]);

  useFrame((_state, delta) => {
    const clamped = Math.min(delta, 0.25);
    time.update(clamped, (step) => {
      const settings = storeApi.getState().settings;
      const useRustSim = settings.useRustSim;
      const shadowMode = settings.shadowMode;

      // 1. Rust Simulation (Authoritative or Shadow)
      if ((useRustSim || shadowMode) && isLoaded && bridge) {
        bridge.step(step);
        if (useRustSim) {
          storeApi.setState((state) => ({ gameTime: state.gameTime + step }));
        }
      }

      // 2. TS Simulation (Authoritative or Shadow)
      if (!useRustSim || shadowMode) {
        // ECS-specific systems
        systems.fleet(step);
        systems.biomes(step);
        systems.asteroids(step);
        systems.droneAI(step);
        systems.travel(step);
        systems.mining(step);
        systems.unload(step);
        systems.power(step);
        systems.refinery(step); // Calls processRefinery + updates visual activity
        // Store orchestrator for gameTime, logistics, and factories
        storeApi.getState().processLogistics(step);
        storeApi.getState().processFactories(step);
        // Update gameTime if TS is authoritative
        if (!useRustSim) {
          storeApi.setState((state) => ({ gameTime: state.gameTime + step }));
        }
      }

      // 3. Parity Check (if Shadow Mode active)
      if (shadowMode && isLoaded && bridge) {
        frameCount.current++;
        if (frameCount.current % PARITY_CHECK_INTERVAL === 0) {
          const report = checkParity(
            storeApi.getState(),
            bridge,
            frameCount.current,
            gameWorld.droneQuery.size,
          );
          if (report) {
            console.warn(`[Parity Check] Frame ${report.frame} Divergences:`, report.divergences);
          }
        }
      }
    });
  });

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, fogRange.near, fogRange.far]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={5.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-8, 4, -6]} intensity={5.6} color="#38bdf8" />
      <Suspense fallback={null}>
        <Stars radius={120} depth={60} count={4000} factor={4} fade speed={0.2} />
        <Warehouse />
        <Factory />
        {useRustSim ? <RustAsteroids bridge={bridge} /> : <Asteroids />}
        {useRustSim ? <RustDrones bridge={bridge} /> : <Drones />}
        {showTrails ? <DroneTrails /> : null}
        {showHaulerShips ? <HaulerShips /> : <TransferLines />}
      </Suspense>
    </>
  );
};
