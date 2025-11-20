import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Matrix4, Quaternion, Vector3, Color } from 'three';
import { colorForState } from '@/r3f/droneColors';
import type { RustSimBridge } from '@/lib/wasmSimBridge';

const DRONE_LIMIT = 5000;
const baseMatrix = new Matrix4();
const orientation = new Quaternion();
const scale = new Vector3(0.25, 0.6, 0.25);
const forward = new Vector3(0, 1, 0);
const direction = new Vector3();
const color = new Color();
const position = new Vector3();

// Map Rust float states to string states expected by colorForState
// 0: Idle, 1: ToAsteroid, 2: Mining, 3: Returning, 4: Unloading
const STATE_MAP: Record<number, string> = {
  0: 'idle',
  1: 'to-asteroid',
  2: 'mining',
  3: 'returning',
  4: 'unloading',
};

interface RustDronesProps {
  bridge: RustSimBridge | null;
}

export const RustDrones = ({ bridge }: RustDronesProps) => {
  const ref = useRef<InstancedMesh>(null);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !bridge) return;

    const positions = bridge.getDronePositions();
    const velocities = bridge.getDroneVelocities();
    const states = bridge.getDroneStates();

    const count = Math.min(states.length, DRONE_LIMIT);

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];

      position.set(x, y, z);
      direction.set(vx, vy, vz);

      if (direction.lengthSq() < 1e-4) {
        orientation.identity();
      } else {
        orientation.setFromUnitVectors(forward, direction.normalize());
      }

      baseMatrix.compose(position, orientation, scale);
      mesh.setMatrixAt(i, baseMatrix);

      const stateVal = Math.round(states[i]);
      const stateStr = STATE_MAP[stateVal] || 'idle';
      // @ts-expect-error - colorForState expects specific string union
      color.copy(colorForState(stateStr));
      mesh.setColorAt(i, color);
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined as never, undefined as never, DRONE_LIMIT]}>
      <capsuleGeometry args={[0.3, 0.6, 4, 8]} />
      <meshStandardMaterial
        vertexColors
        emissiveIntensity={0.6}
        emissive={'#0ea5e9'}
        roughness={0.4}
        metalness={0.2}
      />
    </instancedMesh>
  );
};
