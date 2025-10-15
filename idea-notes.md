# idea-notes.md

> Purpose: Map the **Space Factory (Idle)** scaffold to your existing repo template with minimal churn. Keep files **< 300 LOC**. Use your ESLint/Prettier/Vite setup as-is. Only add missing deps.

---

## 0) Snapshot of your current template (what we will lean on)

* **Vite** via `rolldown-vite@7.1.14` (keep)
* **React 19.2** (keep)
* **R3F/Drei** already present (`@react-three/fiber@^9.3.0`, `@react-three/drei@^10.7.6`)
* **Three** `^0.180.0` + `@types/three` (good)
* **Radix UI Themes** (optional UI shell)
* **Tailwind v4 plugins** present (optional; not strictly required if Radix covers it)
* **Vitest** & Testing Library configured

### Missing deps we need to add

* **Game state & ECS**: `zustand`, `miniplex`
* **E2E (requested)**: `@playwright/test` (dev)

> Install:

```bash
npm i zustand miniplex
npm i -D @playwright/test
```

---

## 1) Directory layout (overwrite `/src`)

```
src/
  main.tsx                 # App bootstrap
  App.tsx                  # Canvas + HUD shell
  styles.css               # light styles (keep tiny)
  ui/
    UpgradePanel.tsx       # buy/upgrade + prestige panel (Radix optional)
  r3f/
    Scene.tsx              # tick loop & composition
    Asteroids.tsx          # instanced rocks
    Drones.tsx             # instanced drones
    Factory.tsx            # central hub mesh
  ecs/
    world.ts               # Miniplex world + seed
    systems/
      time.ts              # fixed-timestep accumulator
      fleet.ts             # spawn/remove drones from store.modules.droneBay
      asteroids.ts         # respawn w/ scanner richness bias
      droneAI.ts           # simple state machine
      mining.ts            # (stub) future split (keep file <300 LOC)
      travel.ts            # (stub)
      unload.ts            # (stub)
      refinery.ts          # (stub)
      power.ts             # (stub)
  state/
    store.ts               # zustand store (resources, modules, prestige)
  lib/
    math.ts                # rng/curves helpers (keep minimal)
    offline.ts             # (stub) time-diff catch-up
```

**File size budget** (hard limit 300 LOC):

* `store.ts` ≤ 200
* each system ≤ 120
* each renderer ≤ 120
* `App.tsx` ≤ 120, `Scene.tsx` ≤ 120

> Strategy: prefer **more small files** over one big file; move helpers to `lib/`.

---

## 2) Implementation order (strict sequencing)

1. **Store** (`state/store.ts`)

   * `resources: { ore, bars, energy, credits }`
   * `modules: { droneBay, refinery, storage, solar, scanner }`
   * Cost fn: `ceil(base * 1.15^lvl)`; bases: `{50,80,30,40,120}`
   * Prestige: `cores`, `bonus() = 1 + 0.05 * cores`, `preview()` and `doPrestige()` (threshold: `bars ≥ 5000`)
   * `tick(dt)`: convert ore→bars (10:1 pipeline), mul by refinery and prestige

2. **World** (`ecs/world.ts`)

   * Miniplex world, add **Factory**; seed **Asteroids** (200) with baseline richness; **no initial drones** (Fleet manages)

3. **Systems** (`ecs/systems/*`)

   * `time.ts`: fixed step (0.1s)
   * `fleet.ts`: target drone count = `max(1, store.modules.droneBay)` → add/remove drones
   * `asteroids.ts`: once/sec prune depleted + spawn to `targetCount` with `richness *= (1+0.05*scannerLevel)`
   * `droneAI.ts`: Idle→toAst→mining→return→unload loop (use nearest asteroid)

4. **Renderers**

   * `<Asteroids />`: instanced icosahedrons (scale by `radius`), mild rotation
   * `<Drones />`: instanced spheres/capsules
   * `<Factory />`: simple cylinder with emissive trim

5. **Scene & App**

   * `Scene.tsx`: in `useFrame` → `time.update(dt, step)` → `tickFleet`, `tickAsteroidRespawn`, `tickDroneAI`, `store.tick`
   * `App.tsx`: `<Canvas>` + HUD (Ore/Bars/Energy) + right-side `<UpgradePanel />`

6. **UI**

   * `UpgradePanel.tsx`: Buy buttons for modules, Prestige block, all from store. If you prefer Radix:

     * Use `@radix-ui/themes` `Card`, `Button`, `Text`, `Separator` with default theme.

7. **Tests**

   * Vitest unit: economy conversion, cost curve, prestige gain monotonicity
   * Playwright e2e: app boots, ore increases over time, buy upgrade enabled after earning bars

---

## 3) Code stubs (concise)

### `src/main.tsx`

```tsx
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
```

### `src/App.tsx`

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, StatsGl } from '@react-three/drei'
import { Scene } from './r3f/Scene'
import { useStore } from './state/store'

export default function App(){
  const r = useStore(s => s.resources)
  return (
    <div className="app">
      <div className="hud">Ore: {r.ore|0} • Bars: {r.bars|0} • Energy: {r.energy|0}</div>
      <Canvas shadows camera={{ position:[8,6,12], fov:50 }}>
        <color attach="background" args={["#030611"]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[10,12,6]} intensity={2} castShadow />
        <Scene />
        <OrbitControls enablePan={false} />
        <StatsGl />
      </Canvas>
      <div className="side"><UpgradePanel /></div>
    </div>
  )
}

import { UpgradePanel } from './ui/UpgradePanel'
```

### `src/state/store.ts`

```ts
import { create } from 'zustand'

const growth = 1.15
const cost = (base: number, lvl: number) => Math.ceil(base * Math.pow(growth, lvl))
const bases = { droneBay:50, refinery:80, storage:30, solar:40, scanner:120 }

type Modules = { droneBay:number; refinery:number; storage:number; solar:number; scanner:number }

type R = { ore:number; bars:number; energy:number; credits:number }

type Prestige = { cores:number; bonus: () => number }

type Store = {
  resources: R
  modules: Modules
  prestige: Prestige
  addOre: (n:number)=>void
  buy: (id:keyof Modules)=>void
  tick: (dt:number)=>void
  prestigeReady: ()=>boolean
  preview: ()=>number
  doPrestige: ()=>void
}

export const useStore = create<Store>((set, get) => ({
  resources: { ore:0, bars:0, energy:100, credits:0 },
  modules: { droneBay:1, refinery:0, storage:0, solar:0, scanner:0 },
  prestige: { cores:0, bonus: () => 1 + 0.05 * get().prestige.cores },

  addOre: (n) => set(s => ({ resources: { ...s.resources, ore: s.resources.ore + n } })),

  buy: (id) => set(s => {
    const lvl = s.modules[id]
    const c = cost(bases[id], lvl)
    if (s.resources.bars < c) return s
    return {
      resources: { ...s.resources, bars: s.resources.bars - c },
      modules: { ...s.modules, [id]: lvl + 1 }
    }
  }),

  tick: (dt) => {
    const s = get()
    const mult = s.prestige.bonus()
    const refineMult = Math.pow(1.10, s.modules.refinery)
    const convert = Math.min(s.resources.ore, dt * 10)
    set({ resources: { ...s.resources, ore: s.resources.ore - convert, bars: s.resources.bars + (convert/10)*refineMult*mult } })
  },

  prestigeReady: () => get().resources.bars >= 5000,
  preview: () => Math.floor(Math.pow((get().resources.bars/1000), 0.6)),
  doPrestige: () => set(s => {
    if (s.resources.bars < 5000) return s
    const gain = Math.floor(Math.pow((s.resources.bars/1000), 0.6))
    return {
      prestige: { cores: s.prestige.cores + gain, bonus: s.prestige.bonus },
      resources: { ore:0, bars:0, energy:100, credits:0 },
      modules: { droneBay:1, refinery:0, storage:0, solar:0, scanner:0 }
    }
  })
}))
```

### `src/ecs/world.ts`

```ts
import { World } from 'miniplex'
import * as THREE from 'three'

export type Asteroid = { kind:'asteroid', id:number, position:THREE.Vector3, oreRemaining:number, richness:number, radius:number }
export type Drone = { kind:'drone', id:number, position:THREE.Vector3, state:'idle'|'toAst'|'mining'|'return'|'unload'|'charge', target?:number, cargo:number, speed:number, capacity:number }
export type Factory = { kind:'factory', position:THREE.Vector3 }
export type Entity = Asteroid | Drone | Factory

export const world = new World<Entity>()

world.add({ kind:'factory', position: new THREE.Vector3(0,0,0) })

for (let i=0;i<200;i++) {
  const pos = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random()*20)
  world.add({ kind:'asteroid', id:i, position:pos, oreRemaining: 200 + Math.random()*800, richness: 0.5 + Math.random(), radius: 0.3 + Math.random()*1.2 })
}
```

### `src/ecs/systems/time.ts`

```ts
export class TimeSystem {
  private acc = 0
  fixedDt = 0.1
  update(dt:number, step:(dt:number)=>void){
    this.acc += dt
    while(this.acc >= this.fixedDt){ step(this.fixedDt); this.acc -= this.fixedDt }
  }
}
```

### `src/ecs/systems/fleet.ts`

```ts
import { world } from '../world'
import * as THREE from 'three'
import { useStore } from '@/state/store'
let acc = 0, nextId = 10000
export function tickFleet(dt:number){
  acc += dt; if (acc < 0.5) return; acc = 0
  const desired = Math.max(1, useStore.getState().modules.droneBay)
  const drones = world.entities.filter(e => (e as any).kind === 'drone') as any[]
  const delta = desired - drones.length
  if (delta > 0) for (let i=0;i<delta;i++) world.add({ kind:'drone', id: nextId++, position: new THREE.Vector3(0,0,0), state:'idle', cargo:0, speed:2, capacity:10 })
  if (delta < 0) { let remove = -delta; for (const d of drones){ if(!remove) break; world.remove(d); remove-- } }
}
```

### `src/ecs/systems/asteroids.ts`

```ts
import { world } from '../world'
import * as THREE from 'three'
import { useStore } from '@/state/store'
let acc = 0, nextAstId = 1000
const targetCount = 200
const scannerMult = () => 1 + 0.05 * useStore.getState().modules.scanner
export function tickAsteroidRespawn(dt:number){
  acc += dt; if (acc < 1) return; acc = 0
  for (const a of [...world.entities]) if ((a as any).kind==='asteroid' && (a as any).oreRemaining<=0) world.remove(a)
  const current = world.entities.filter(e => (e as any).kind==='asteroid').length
  const m = scannerMult()
  for (let i=current; i<targetCount; i++){
    const pos = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random()*20)
    const richness = (0.5 + Math.random()) * m
    const ore = (200 + Math.random()*800) * (0.5 + (richness-0.5))
    const radius = 0.3 + Math.random()*1.2
    world.add({ kind:'asteroid', id: nextAstId++, position:pos, oreRemaining: ore, richness, radius })
  }
}
```

### `src/ecs/systems/droneAI.ts`

```ts
import { world } from '../world'
import * as THREE from 'three'
function moveTowards(a:THREE.Vector3, b:THREE.Vector3, maxDelta:number){ const d = b.clone().sub(a); const L = d.length(); if (L<=maxDelta||L===0){ a.copy(b); return } a.add(d.multiplyScalar(maxDelta/L)) }
export function tickDroneAI(dt:number){
  for (const e of world.entities as any[]){
    if (e.kind !== 'drone') continue
    if (e.state==='idle'){
      let best:any=null, bestD=Infinity
      for (const a of world.entities as any[]){ if (a.kind!=='asteroid'||a.oreRemaining<=0) continue; const d=a.position.length(); if (d<bestD){ best=a; bestD=d } }
      if (best){ e.target=best.id; e.state='toAst' }
    }
    if (e.state==='toAst' && e.target!==undefined){
      const ast = (world.entities as any[]).find(x=>x.id===e.target)
      if (ast && ast.kind==='asteroid'){ const dest = ast.position as THREE.Vector3; moveTowards(e.position, dest, e.speed*dt); if (e.position.distanceTo(dest) < ast.radius + 0.2) e.state='mining' } else e.state='idle'
    }
    if (e.state==='mining' && e.target!==undefined){
      const ast = (world.entities as any[]).find(x=>x.id===e.target)
      if (ast && ast.oreRemaining>0){ const mined = Math.min(2*dt, ast.oreRemaining, e.capacity - e.cargo); ast.oreRemaining -= mined; e.cargo += mined; if (e.cargo>=e.capacity) e.state='return' } else e.state='return'
    }
    if (e.state==='return'){ moveTowards(e.position, new THREE.Vector3(0,0,0), e.speed*dt); if (e.position.length()<0.3) e.state='unload' }
    if (e.state==='unload'){ (window as any).__store?.getState().addOre(e.cargo); e.cargo=0; e.state='idle' }
  }
}
```

### `src/r3f/Scene.tsx`

```tsx
import { useFrame } from '@react-three/fiber'
import { TimeSystem } from '@/ecs/systems/time'
import { tickDroneAI } from '@/ecs/systems/droneAI'
import { tickFleet } from '@/ecs/systems/fleet'
import { tickAsteroidRespawn } from '@/ecs/systems/asteroids'
import { Asteroids } from './Asteroids'
import { Factory } from './Factory'
import { Drones } from './Drones'
import { useStore } from '@/state/store'

const time = new TimeSystem()

export function Scene(){
  const tick = useStore(s=>s.tick)
  useFrame((_, dt) => { time.update(dt, (fx)=>{ tickFleet(fx); tickAsteroidRespawn(fx); tickDroneAI(fx); tick(fx) }) })
  return (<><Asteroids /><Factory /><Drones /></>)
}
```

### `src/r3f/Asteroids.tsx`

```tsx
import { useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { useFrame } from '@react-three/fiber'
import { world } from '@/ecs/world'
export function Asteroids(){
  const ref = useRef<InstancedMesh>(null!)
  const dummy = useMemo(()=>new Object3D(),[])
  const asteroids = useMemo(()=>world.entities.filter(e=>(e as any).kind==='asteroid') as any[],[])
  useFrame((_,dt)=>{ let i=0; for (const a of asteroids){ dummy.position.copy(a.position); dummy.scale.setScalar(a.radius); dummy.rotation.y += dt*0.1; dummy.updateMatrix(); ref.current.setMatrixAt(i++, dummy.matrix) } ref.current.instanceMatrix.needsUpdate = true })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, asteroids.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1,0]} /><meshStandardMaterial metalness={0.1} roughness={0.9} color="#5f676f" />
    </instancedMesh>
  )
}
```

### `src/r3f/Drones.tsx`

```tsx
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { world } from '@/ecs/world'
export function Drones(){
  const ref = useRef<InstancedMesh>(null!)
  const dummy = useMemo(()=>new Object3D(),[])
  const drones = useMemo(()=>world.entities.filter(e=>(e as any).kind==='drone') as any[],[])
  useFrame(()=>{ let i=0; for (const d of drones){ dummy.position.copy(d.position); dummy.scale.setScalar(0.12); dummy.updateMatrix(); ref.current.setMatrixAt(i++, dummy.matrix) } ref.current.instanceMatrix.needsUpdate = true })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, drones.length]} castShadow>
      <sphereGeometry args={[1,16,16]} /><meshStandardMaterial metalness={0.3} roughness={0.4} />
    </instancedMesh>
  )
}
```

### `src/r3f/Factory.tsx`

```tsx
export function Factory(){
  return (
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[0.6,0.8,0.5,8]} />
      <meshStandardMaterial color="#7ab7ff" emissive="#224466" emissiveIntensity={0.4} />
    </mesh>
  )
}
```

### `src/ui/UpgradePanel.tsx`

```tsx
import { useMemo } from 'react'
import { useStore } from '@/state/store'
const growth = 1.15
const cost = (base:number, lvl:number) => Math.ceil(base * Math.pow(growth, lvl))
export function UpgradePanel(){
  const { modules, resources, buy, prestige, prestigeReady, preview, doPrestige } = useStore()
  const rows = useMemo(()=>([
    { id:'droneBay', label:'Drone Bay', base:50, desc:'+1 drone' },
    { id:'refinery', label:'Refinery', base:80, desc:'+10% refine speed' },
    { id:'storage', label:'Storage', base:30, desc:'+100 storage cap' },
    { id:'solar', label:'Solar Array', base:40, desc:'+5 energy/s' },
    { id:'scanner', label:'Scanner', base:120, desc:'rich nodes +5%' }
  ] as const),[])
  return (
    <div className="panel">
      <h3>Upgrades</h3>
      {rows.map(r=>{ const lvl=(modules as any)[r.id]??0; const c=cost(r.base,lvl); const ok=resources.bars>=c; return (
        <div key={r.id} className="row">
          <div className="left"><strong>{r.label}</strong> <span className="muted">Lv {lvl}</span><div className="desc">{r.desc}</div></div>
          <div className="right"><button disabled={!ok} onClick={()=>buy(r.id as any)}>Buy ({c} bars)</button></div>
        </div>)})}
      <hr/>
      <h3>Prestige</h3>
      <div>Bars: {Math.floor(resources.bars)} → Next Cores: {Math.floor(preview())}</div>
      <button disabled={!prestigeReady()} onClick={doPrestige}>Prestige</button>
      <div className="muted">Cores: {prestige.cores} • Bonus: +{Math.round((prestige.bonus()-1)*100)}%</div>
    </div>
  )
}
```

### `src/styles.css` (tiny)

```css
.app { height: 100dvh; }
canvas { outline: none; }
.hud { position:absolute; left:1rem; top:1rem; background:#0b1120cc; padding:8px 12px; border-radius:10px; color:#d1d5db }
.panel{ position:absolute; right:1rem; top:1rem; width:300px; background:#0b1120cc; color:#d1d5db; padding:12px; border-radius:12px; backdrop-filter: blur(6px);}
.row{ display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #1f2937 }
.row:last-child{ border-bottom:none }
.left .muted{ opacity:.7; margin-left:6px }
.desc{ font-size:12px; opacity:.8 }
button{ padding:6px 10px; border-radius:8px; border:1px solid #334155; background:#111827; color:#e5e7eb }
button:disabled{ opacity:.5 }
.side{ position:absolute; right:0; top:0 }
```

---

## 4) Testing plan (fits your setup)

### Unit (Vitest)

* `economy.spec.ts`: ore→bars rate; cost curve increases; prestige preview monotonic
* `fleet.spec.ts`: drone count follows `modules.droneBay`
* `scanner.spec.ts`: higher scanner level → higher mean `oreRemaining` on spawn

### E2E (Playwright)

* Add `@playwright/test`, then create `tests/e2e/basic.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('boots and accrues ore', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.getByText(/Ore:/)).toBeVisible()
  const first = await page.getByText(/Ore:/).innerText()
  await page.waitForTimeout(1500)
  const second = await page.getByText(/Ore:/).innerText()
  expect(second).not.toEqual(first)
})
```

> Tip: keep the dev server command as-is (your Vite is already wired). If you create a Playwright config, point it to `npm run dev`.

---

## 5) ESLint/Prettier discipline

* Favor **pure functions** in systems; place helpers in `lib/` to keep files small.
* Prefer named exports; avoid default-exports except React component files.
* Keep cyclomatic complexity low; split large `switch`/state‑machines.
* No console noise beyond `debug`-guarded logs.

---

## 6) Visual polish (optional, fast wins)

* Use `@radix-ui/themes` for panel layout (Card/Separator) to avoid CSS churn.
* Add richness-based **color tint** in `Asteroids.tsx` (e.g. map richness→material.emissiveIntensity).
* Add `Trail` from Drei for drones later (post‑MVP).

---

## 7) Acceptance criteria (MVP)

* App runs (`npm run dev`), canvas renders factory + asteroids + drones.
* Ore increases over time without input; Bars increase when ore present.
* Buying Drone Bay increases visible drone count within ≤1s.
* Increasing Scanner level increases mean ore per new asteroid (verified by unit test).
* File size constraints satisfied (no file > 300 LOC).

---

## 8) Rollback plan

* If R3F/Drei mismatches arise, lock minor versions (already in your template) and scale back Drei usage to core helpers.
* If performance dips, reduce asteroid target count to 100 and raise ore per rock.

---

## 9) Next milestones

* Power & storage caps; throttling in `tick` and systems.
* Curve paths & trail FX for drones.
* Autosave + offline catch-up.
* Tech tree UI and balancing pass.
