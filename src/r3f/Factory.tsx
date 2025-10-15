import { gameWorld } from '@/ecs/world';

export const Factory = () => (
  <group position={gameWorld.factory.position}>
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[2.2, 2.8, 1.4, 32]} />
      <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.35} />
    </mesh>
    <mesh position={[0, 1, 0]}>
      <cylinderGeometry args={[1.4, 1.4, 0.8, 32]} />
      <meshStandardMaterial color="#334155" emissive="#38bdf8" emissiveIntensity={0.5} />
    </mesh>
    <mesh position={[0, 1.6, 0]}>
      <torusGeometry args={[1.8, 0.12, 12, 64]} />
      <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.7} />
    </mesh>
  </group>
);
