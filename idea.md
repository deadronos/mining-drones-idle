# Space Factory — Idle/Incremental Game (Web)

## Quick Translation (DE → EN)

1. **Fabrik im Weltraum** → **Factory in Space**
   An automated station that mines resources from asteroids.

2. **Automatisierte Station, die Ressourcen von Asteroiden abbaut.** →
   **Automated station** that **extracts resources from asteroids**.

3. **Idle-Mechanik: Förderrate steigern, neue Module freischalten.** →
   **Idle mechanics:** increase throughput/extraction rate and **unlock new modules**.

4. **3D: Asteroidenfeld, Drohnen fliegen automatisch raus und zurück.** →
   **3D:** an **asteroid field** with **drones** that automatically **fly out and return**.

---

## Vision

A chill but crunchy 3D idle/incremental where your orbital factory deploys autonomous drones to nearby asteroids, refines ore, and expands via modules and tech. Early game focuses on stabilizing power and ore flow; mid‑game layers logistics and refining; late‑game introduces multi‑resource chains, prestige, and automation scripts.

**Stack:** React 19.2, React Three Fiber (r3f), Drei helpers/components, Miniplex (ECS), Zustand (state), Vite, Vitest (unit), Playwright (e2e).

---

## Core Gameplay Loop

1. **Spawn** an orbital factory near an asteroid belt.
2. **Deploy drones** to mine ore nodes → drones return with payload.
3. **Process ore** into bars/components → store in silos.
4. **Spend** resources to **unlock modules** (extra drones, refiners, power, scanners).
5. **Scale** throughput (faster drones, larger payloads, more bays, refinery speed).
6. **Idle/Offline progress**: simulate while away (time‑diff catch‑up).
7. Optional **prestige**: abandon station for permanent tech perks.

---

## Feature Pillars

- **Autonomous drones** with simple state machine (Idle → Navigate → Mine → Return → Unload → Charge).
- **Throughput as a resource** (mining rate × travel time × refinery speed × storage cap).
- **Modules & Tech** gates; unlock tree with soft dependencies.
- **3D readability** (orbits, beacons, path lines, glow trails).
- **Deterministic sim**: frame‑rate independent tick; reproducible seeds.

---

## 3D Scene Plan (r3f + Drei)

- **Root** `<Canvas>` with **orthographic or perspective** camera; cinematic low‑poly look.
- **Asteroid Field**: instanced mesh (Icosahedron or custom low‑poly rock) with variance shaders.
- **Factory**: modular meshes (core, drone bay, refinery, power array) with emissive trims.
- **Drones**: instanced spheres/capsules with thruster billboards; trails using `<Instances>` + custom shader or `<Trail />` helper.
- **Navigation**: curve paths (CatmullRomCurve3) sampled in `useFrame` for tweening.
- **UI overlays**: `<Html />` (Drei) for module panels, tooltips, and resource HUD.
- **Lighting**: one key directional light + ambient + baked starfield background.

---

## Data Model & State

**Zustand store (meta & save):**

- `resources`: `{ ore: number, bars: number, energy: number, credits: number }`
- `rates`: `{ mining: number, refine: number, powerGen: number }` (per‑second)
- `modules`: `{ droneBay: n, refinery: n, storage: n, solar: n, scanner: n }`
- `unlocks`: `{ techIds: Set<string> }`
- `settings`: `{ pause: boolean, autosave: boolean }`
- `save`: `{ lastSave: number, version: string }`

**ECS (Miniplex) entities:**

- **Asteroid**: `id, position, oreRemaining, richness, radius`
- **Drone**: `id, state, targetAsteroidId|null, cargo, speed, capacity, battery`
- **Factory**: `id, position`
- **Refinery**: `id, efficiency, workInProgress`
- **Storage**: `id, capacity, current`
- **Power**: `id, genRate, buffer, maxBuffer`
- **Beacon/PathFX**: visual entities only

**Systems (frame‑rate independent):**

- `TimeSystem` (accumulator → fixed `dt`, e.g., 0.1s)
- `DroneAI` (state transitions)
- `MiningSystem` (reduce asteroid ore, add cargo)
- `TravelSystem` (position lerp along curve/time)
- `UnloadSystem` (move cargo → storage, trigger refinery input)
- `RefinerySystem` (consume ore → bars at rate)
- `PowerSystem` (produce/consume energy, throttle systems on shortage)
- `CleanupSystem` (remove depleted asteroids, respawn field chunks)

---

## Progression & Economy

- **Costs**: exponential (e.g., `base * growth^level`), light use of softcaps.
- **Unlocks**: gated by milestones (e.g., first 1k bars unlocks Scanner).
- **Prestige** (Phase 2+): Convert bars→**Data Cores** for cross‑run tech.
- **Offline**: On load, compute `delta = now - lastSave`; simulate capped catch‑up (e.g., max 8 hours) to award resources.

---

## Project Structure (Vite)

```
space-factory/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ ui/ (HUD, panels)
│  ├─ r3f/
│  │  ├─ Scene.tsx
│  │  ├─ Asteroids.tsx
│  │  ├─ Factory.tsx
│  │  ├─ Drones.tsx
│  │  └─ effects/
│  ├─ ecs/
│  │  ├─ world.ts (Miniplex world + components)
│  │  ├─ systems/
│  │  │  ├─ time.ts
│  │  │  ├─ fleet.ts (spawn/remove drones from modules.droneBay)
│  │  │  ├─ asteroids.ts (respawn with scanner bonus)
│  │  │  ├─ droneAI.ts
│  │  │  ├─ mining.ts
│  │  │  ├─ travel.ts
│  │  │  ├─ unload.ts
│  │  │  ├─ refinery.ts
│  │  │  └─ power.ts
│  ├─ state/store.ts (Zustand)
│  ├─ lib/math.ts (curves, rng)
│  ├─ lib/offline.ts
│  └─ styles.css
├─ tests/
│  ├─ unit/ (Vitest)
│  └─ e2e/ (Playwright)
└─ playwright.config.ts
```

space-factory/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ src/
│ ├─ main.tsx
│ ├─ App.tsx
│ ├─ ui/ (HUD, panels)
│ ├─ r3f/
│ │ ├─ Scene.tsx
│ │ ├─ Asteroids.tsx
│ │ ├─ Factory.tsx
│ │ ├─ Drones.tsx
│ │ └─ effects/
│ ├─ ecs/
│ │ ├─ world.ts (Miniplex world + components)
│ │ ├─ systems/
│ │ │ ├─ time.ts
│ │ │ ├─ droneAI.ts
│ │ │ ├─ mining.ts
│ │ │ ├─ travel.ts
│ │ │ ├─ unload.ts
│ │ │ ├─ refinery.ts
│ │ │ └─ power.ts
│ ├─ state/store.ts (Zustand)
│ ├─ lib/math.ts (curves, rng)
│ ├─ lib/offline.ts
│ └─ styles.css
├─ tests/
│ ├─ unit/ (Vitest)
│ └─ e2e/ (Playwright)
└─ playwright.config.ts

````

---

## `package.json` (minimal)
```json
{
  "name": "space-factory-idle",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "playwright": "^1.48.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^9.111.0",
    "miniplex": "^2.0.0",
    "zustand": "^4.5.0",
    "three": "^0.160.0"
  }
}
````

> Note: Version pins are indicative; adjust to latest compatible if needed.

---

## Vite & TS Config

**`vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { open: true },
});
```

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

---

## App Shell (React + r3f + Drei)

**`src/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
```

**`src/App.tsx`**

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, StatsGl, Html } from '@react-three/drei';
import { Scene } from './r3f/Scene';
import { useStore } from './state/store';

export default function App() {
  const resources = useStore((s) => s.resources);
  return (
    <div className="app">
      <div className="hud">
        <div>Ore: {Math.floor(resources.ore)}</div>
        <div>Bars: {Math.floor(resources.bars)}</div>
        <div>Energy: {Math.floor(resources.energy)}</div>
      </div>
      <Canvas shadows camera={{ position: [8, 6, 12], fov: 50 }}>
        <color attach="background" args={['#030611']} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 12, 6]} intensity={2} castShadow />
        <Scene />
        <OrbitControls enablePan={false} />
        <StatsGl />
      </Canvas>
    </div>
  );
}
```

**`src/r3f/Scene.tsx`**

```tsx
import { Asteroids } from './Asteroids';
import { Factory } from './Factory';
import { Drones } from './Drones';

export function Scene() {
  return (
    <>
      <Asteroids />
      <Factory />
      <Drones />
    </>
  );
}
```

---

## ECS World & Systems (Miniplex)

**`src/ecs/world.ts`**

```ts
import { World } from 'miniplex';
import * as THREE from 'three';

export type Asteroid = {
  kind: 'asteroid';
  id: number;
  position: THREE.Vector3;
  oreRemaining: number;
  richness: number;
  radius: number;
};
export type Drone = {
  kind: 'drone';
  id: number;
  position: THREE.Vector3;
  state: 'idle' | 'toAst' | 'mining' | 'return' | 'unload' | 'charge';
  target?: number;
  cargo: number;
  speed: number;
  capacity: number;
};
export type Factory = { kind: 'factory'; position: THREE.Vector3 };

export type Entity = Asteroid | Drone | Factory;

export const world = new World<Entity>();

// Seed
world.add({ kind: 'factory', position: new THREE.Vector3(0, 0, 0) });

// Asteroids — initial belt (200 rocks)
for (let i = 0; i < 200; i++) {
  const pos = new THREE.Vector3()
    .randomDirection()
    .multiplyScalar(8 + Math.random() * 20);
  world.add({
    kind: 'asteroid',
    id: i,
    position: pos,
    oreRemaining: 200 + Math.random() * 800,
    richness: 0.5 + Math.random(),
    radius: 0.3 + Math.random() * 1.2,
  });
}

// Drones are now spawned by FleetSystem based on modules.droneBay
```

**Fixed‑timestep time system** — `src/ecs/systems/time.ts`

```ts
export class TimeSystem {
  accumulator = 0;
  fixedDt = 0.1; // seconds
  update(dt: number, step: (dt: number) => void) {
    this.accumulator += dt;
    while (this.accumulator >= this.fixedDt) {
      step(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }
  }
}
```

**Drone AI (sketch)** — `src/ecs/systems/droneAI.ts`

```ts
// (unchanged from earlier snippet)
```

**NEW — Fleet System (droneBay → ECS drones)** — `src/ecs/systems/fleet.ts`

```ts
import { world } from '../world';
import * as THREE from 'three';
import { useStore } from '@/state/store';

let acc = 0;
let nextId = 10000;

export function tickFleet(dt: number) {
  acc += dt;
  if (acc < 0.5) return; // check twice per second
  acc = 0;
  const desired = Math.max(1, useStore.getState().modules.droneBay);
  const drones = world.entities.filter(
    (e) => (e as any).kind === 'drone',
  ) as any[];
  const delta = desired - drones.length;
  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      world.add({
        kind: 'drone',
        id: nextId++,
        position: new THREE.Vector3(0, 0, 0),
        state: 'idle',
        cargo: 0,
        speed: 2,
        capacity: 10,
      });
    }
  } else if (delta < 0) {
    // remove excess, prefer idle drones
    let toRemove = -delta;
    for (const d of drones) {
      if (toRemove <= 0) break;
      world.remove(d);
      toRemove--;
    }
  }
}
```

**NEW — Asteroid Respawn with Scanner Bonus** — `src/ecs/systems/asteroids.ts`

```ts
import { world } from '../world';
import * as THREE from 'three';
import { useStore } from '@/state/store';

let acc = 0;
let nextAstId = 1000;
const targetCount = 200;

function scannerMult() {
  const lvl = useStore.getState().modules.scanner;
  return 1 + 0.05 * lvl;
}

export function tickAsteroidRespawn(dt: number) {
  acc += dt;
  if (acc < 1) return; // check once per second
  acc = 0;
  // Remove depleted
  for (const a of [...world.entities]) {
    if ((a as any).kind === 'asteroid' && (a as any).oreRemaining <= 0)
      world.remove(a);
  }
  // Respawn up to target with richness bias
  const current = world.entities.filter(
    (e) => (e as any).kind === 'asteroid',
  ).length;
  const mult = scannerMult();
  for (let i = current; i < targetCount; i++) {
    const pos = new THREE.Vector3()
      .randomDirection()
      .multiplyScalar(8 + Math.random() * 20);
    const richness = (0.5 + Math.random()) * mult;
    const ore = (200 + Math.random() * 800) * (0.5 + (richness - 0.5));
    const radius = 0.3 + Math.random() * 1.2;
    world.add({
      kind: 'asteroid',
      id: nextAstId++,
      position: pos,
      oreRemaining: ore,
      richness,
      radius,
    });
  }
}
```

**Scene tick hook — include Fleet & Asteroid systems** — `src/r3f/Scene.tsx`

```tsx
import { useFrame } from '@react-three/fiber';
import { TimeSystem } from '@/ecs/systems/time';
import { tickDroneAI } from '@/ecs/systems/droneAI';
import { tickFleet } from '@/ecs/systems/fleet';
import { tickAsteroidRespawn } from '@/ecs/systems/asteroids';

const time = new TimeSystem();

export function Scene() {
  useFrame((_, dt) => {
    time.update(dt, (fixed) => {
      tickFleet(fixed);
      tickAsteroidRespawn(fixed);
      tickDroneAI(fixed);
    });
  });
  return <>{/* children as before */}</>;
}
```

---

## Rendering Components

**Asteroids (instanced)** — `src/r3f/Asteroids.tsx`

```tsx
import { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '@/ecs/world';

export function Asteroids() {
  const ref = useRef<InstancedMesh>(null!);
  const dummy = useMemo(() => new Object3D(), []);
  const asteroids = useMemo(
    () => world.entities.filter((e) => (e as any).kind === 'asteroid') as any[],
    [],
  );

  useFrame((_, dt) => {
    let i = 0;
    for (const a of asteroids) {
      dummy.position.copy(a.position);
      dummy.scale.setScalar(a.radius);
      dummy.rotation.y += dt * 0.1;
      dummy.updateMatrix();
      ref.current.setMatrixAt(i++, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, asteroids.length]}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial metalness={0.1} roughness={0.9} color="#5f676f" />
    </instancedMesh>
  );
}
```

**Factory** — `src/r3f/Factory.tsx`

```tsx
export function Factory() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.8, 0.5, 8]} />
        <meshStandardMaterial
          color="#7ab7ff"
          emissive="#224466"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}
```

**Drones** — `src/r3f/Drones.tsx`

```tsx
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { world } from '@/ecs/world';

export function Drones() {
  const ref = useRef<InstancedMesh>(null!);
  const dummy = useMemo(() => new Object3D(), []);
  const drones = useMemo(
    () => world.entities.filter((e) => (e as any).kind === 'drone') as any[],
    [],
  );

  useFrame(() => {
    let i = 0;
    for (const d of drones) {
      dummy.position.copy(d.position);
      dummy.scale.setScalar(0.12);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i++, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, drones.length]}
      castShadow
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial metalness={0.3} roughness={0.4} />
    </instancedMesh>
  );
}
```

---

## Zustand Store & Offline Progress

**`src/state/store.ts`**

```ts
import { create } from 'zustand';

type R = { ore: number; bars: number; energy: number; credits: number };

type Store = {
  resources: R;
  addOre: (n: number) => void;
  lastSave: number;
  tick: (dt: number) => void;
};

export const useStore = create<Store>((set, get) => ({
  resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
  lastSave: performance.now(),
  addOre: (n) =>
    set((s) => ({ resources: { ...s.resources, ore: s.resources.ore + n } })),
  tick: (dt) => {
    // simple refinery: 1 bar per 10 ore per second
    const r = get().resources;
    const convert = Math.min(r.ore, dt * 10);
    set({
      resources: { ...r, ore: r.ore - convert, bars: r.bars + convert / 10 },
    });
  },
}));
(window as any).__store = useStore;
```

**Scene tick hook** — run ECS + store per fixed timestep in `src/r3f/Scene.tsx`

```tsx
import { useFrame } from '@react-three/fiber';
import { TimeSystem } from '@/ecs/systems/time';
import { tickDroneAI } from '@/ecs/systems/droneAI';
import { useStore } from '@/state/store';

const time = new TimeSystem();

export function Scene() {
  const tick = useStore((s) => s.tick);
  useFrame((_, dt) => {
    time.update(dt, (fixed) => {
      tickDroneAI(fixed);
      tick(fixed);
    });
  });
  return <>{/* children as before */}</>;
}
```

---

## Testing

### Unit (Vitest)

**`tests/unit/economy.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { useStore } from '@/state/store';

describe('refinery tick', () => {
  it('converts ore to bars at 10:1 per second', () => {
    const s = useStore.getState();
    s.resources.ore = 100;
    s.tick(1);
    expect(s.resources.ore).toBe(90);
    expect(s.resources.bars).toBe(1);
  });
});
```

### E2E (Playwright)

**`playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: { headless: true },
});
```

**`tests/e2e/basic.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('loads HUD and accrues resources', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await expect(page.getByText(/Ore:/)).toBeVisible();
  const ore1 = await page.getByText(/Ore:/).innerText();
  await page.waitForTimeout(1500);
  const ore2 = await page.getByText(/Ore:/).innerText();
  expect(ore2).not.toEqual(ore1);
});
```

---

## UI — Buy/Upgrade Panel (Zustand + React)

**`src/ui/UpgradePanel.tsx`**

```tsx
import { useMemo } from 'react';
import { useStore } from '@/state/store';

// Cost helpers (imported in store as well)
const growth = 1.15;
const cost = (base: number, lvl: number) =>
  Math.ceil(base * Math.pow(growth, lvl));

export function UpgradePanel() {
  const { modules, resources, buy, prestige } = useStore();
  const rows = useMemo(
    () =>
      [
        { id: 'droneBay', label: 'Drone Bay', base: 50, desc: '+1 drone' },
        {
          id: 'refinery',
          label: 'Refinery',
          base: 80,
          desc: '+10% refine speed',
        },
        { id: 'storage', label: 'Storage', base: 30, desc: '+100 storage cap' },
        { id: 'solar', label: 'Solar Array', base: 40, desc: '+5 energy/s' },
        { id: 'scanner', label: 'Scanner', base: 120, desc: 'rich nodes +5%' },
      ] as const,
    [],
  );

  return (
    <div className="panel">
      <h3>Upgrades</h3>
      {rows.map((r) => {
        const lvl = (modules as any)[r.id] ?? 0;
        const c = cost(r.base, lvl);
        const afford = resources.bars >= c;
        return (
          <div key={r.id} className="row">
            <div className="left">
              <strong>{r.label}</strong> <span className="muted">Lv {lvl}</span>
              <div className="desc">{r.desc}</div>
            </div>
            <div className="right">
              <button disabled={!afford} onClick={() => buy(r.id as any)}>
                Buy ({c} bars)
              </button>
            </div>
          </div>
        );
      })}
      <hr />
      <PrestigePanel />
    </div>
  );
}

function PrestigePanel() {
  const { resources, prestigeReady, doPrestige, prestige, preview } =
    useStore();
  return (
    <div>
      <h3>Prestige</h3>
      <p>Reset station → gain Data Cores (permanent).</p>
      <div>
        Bars: {Math.floor(resources.bars)} → Next Cores: {Math.floor(preview())}
      </div>
      <button disabled={!prestigeReady()} onClick={doPrestige}>
        Prestige
      </button>
      <div className="muted">
        Cores owned: {prestige.cores} • Bonus: +
        {Math.round((prestige.bonus() - 1) * 100)}% global
      </div>
    </div>
  );
}
```

**Wire into App HUD** — add under the HUD container in `src/App.tsx`:

```tsx
import { UpgradePanel } from '@/ui/UpgradePanel';
// ... inside return
<div className="side">
  <UpgradePanel />
</div>;
```

**Styles (excerpt)** — `src/styles.css`

```css
.panel {
  position: absolute;
  right: 1rem;
  top: 1rem;
  width: 300px;
  background: #0b1120cc;
  color: #d1d5db;
  padding: 12px;
  border-radius: 12px;
  backdrop-filter: blur(6px);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #1f2937;
}
.row:last-child {
  border-bottom: none;
}
.left .muted {
  opacity: 0.7;
  margin-left: 6px;
}
.desc {
  font-size: 12px;
  opacity: 0.8;
}
button {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #111827;
  color: #e5e7eb;
}
button:disabled {
  opacity: 0.5;
}
.hud {
  position: absolute;
  left: 1rem;
  top: 1rem;
  background: #0b1120cc;
  padding: 8px 12px;
  border-radius: 10px;
}
.side {
  position: absolute;
  right: 0;
  top: 0;
}
```

---

## Economy & Prestige Formulas

**Costs:** multiplicative growth with mild slope to encourage breadth before depth.

- Cost per level: `cost(base, lvl) = ceil(base * growth^lvl)` with `growth = 1.15` (tune 1.12–1.2)
- Example bases: DroneBay 50, Refinery 80, Storage 30, Solar 40, Scanner 120 (in **bars**)

**Effects per level (stack multiplicatively):**

- `droneBay`: +1 **drone** each
- `refinery`: `refineRate *= 1.10`
- `storage`: `storageCap += 100`
- `solar`: `powerGen += 5` (energy / s)
- `scanner`: `richnessBonus += 0.05`

**Global bonus from Prestige (Data Cores):**

- Cores earned on reset: `coresGain = floor((bars_total / 1_000) ^ 0.6)` (sublinear to avoid runaway)
- Permanent multiplier: `globalMult = 1 + 0.05 * coresOwned` (5% per core)
- Softcap (optional): After 100 cores → per‑core bonus reduces to 2%: `bonus = 1 + 0.05*min(c,100) + 0.02*max(0,c-100)`
- Unlock threshold to prestige: `bars_total ≥ 5_000`

**Offline catch‑up cap:** max 8h simulated; apply `globalMult` to all income sources.

---

## Store Additions (upgrades + prestige)

**`src/state/store.ts` (replace with extended store)**

```ts
import { create } from 'zustand';

const growth = 1.15;
const cost = (base: number, lvl: number) =>
  Math.ceil(base * Math.pow(growth, lvl));

const bases = {
  droneBay: 50,
  refinery: 80,
  storage: 30,
  solar: 40,
  scanner: 120,
};

type Modules = {
  droneBay: number;
  refinery: number;
  storage: number;
  solar: number;
  scanner: number;
};

type R = { ore: number; bars: number; energy: number; credits: number };

type Prestige = { cores: number; bonus: () => number };

type Store = {
  resources: R;
  modules: Modules;
  prestige: Prestige;
  addOre: (n: number) => void;
  buy: (id: keyof Modules) => void;
  tick: (dt: number) => void;
  prestigeReady: () => boolean;
  doPrestige: () => void;
  preview: () => number;
};

export const useStore = create<Store>((set, get) => ({
  resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
  modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
  prestige: { cores: 0, bonus: () => 1 + 0.05 * get().prestige.cores },

  addOre: (n) =>
    set((s) => ({ resources: { ...s.resources, ore: s.resources.ore + n } })),

  buy: (id) =>
    set((s) => {
      const lvl = s.modules[id];
      const c = cost(bases[id], lvl);
      if (s.resources.bars < c) return s;
      const res = { ...s.resources, bars: s.resources.bars - c };
      const mods = { ...s.modules, [id]: lvl + 1 };
      return { resources: res, modules: mods };
    }),

  tick: (dt) => {
    const s = get();
    const mult = s.prestige.bonus();
    const refineMult = Math.pow(1.1, s.modules.refinery);
    const barsPerSec = 1 * refineMult * mult;
    const convert = Math.min(s.resources.ore, dt * 10);
    set({
      resources: {
        ...s.resources,
        ore: s.resources.ore - convert,
        bars: s.resources.bars + (convert / 10) * barsPerSec,
      },
    });
  },

  prestigeReady: () => get().resources.bars >= 5000,
  preview: () => Math.floor(Math.pow(get().resources.bars / 1000, 0.6)),
  doPrestige: () =>
    set((s) => {
      if (s.resources.bars < 5000) return s;
      const gain = Math.floor(Math.pow(s.resources.bars / 1000, 0.6));
      return {
        prestige: { cores: s.prestige.cores + gain, bonus: s.prestige.bonus },
        resources: { ore: 0, bars: 0, energy: 100, credits: 0 },
        modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      };
    }),
}));
```

---

## Next Steps (Concrete)

1. Balance **droneBay scaling** (spawn interval vs. raw count) and **scanner richness curves**.
2. Hook **storage caps** and **power throttling** into tick and systems.
3. Visual feedback: show scanner effect (highlight richer nodes) & droneBay bays on the Factory mesh.
4. Persist **autosave**; add **offline catch‑up** using lastSave.
5. Expand prestige techs; add tests for cost curves and cores progression.

---

## Stretch Goals

- Sector scanning & procedural belts; hazard events; logistics ships.
- Scripting/autopilot for custom drone behaviors.
- Photo mode + replay trails.

---

## Dev Scripts

```bash
# install
npm install

# run
npm run dev

# unit tests
npm test

# e2e
npm run e2e
```

---

**This doc now includes npm workflow, an in-game Upgrade/Prestige UI, and concrete cost/prestige formulas.**
