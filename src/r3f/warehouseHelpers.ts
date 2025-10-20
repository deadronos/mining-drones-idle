import type { Group } from 'three';

export const DOCKING_RING_ROTATION_SPEED = 0.5;

export const updateDockingRingRotation = (object: Group, delta: number) => {
  object.rotation.y += delta * DOCKING_RING_ROTATION_SPEED;
};

export const createArmOffsets = () =>
  Array.from({ length: 3 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 3;
    const radius = 3.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rotation = [-Math.PI / 2, 0, angle] as const;
    return { position: [x, 0.4, z] as const, rotation };
  });

export const createSolarOffsets = () => [
  { position: [0, 2.2, 2.6] as const, rotation: [-Math.PI / 4, 0, 0] as const },
  { position: [0, 2.2, -2.6] as const, rotation: [Math.PI / 4, Math.PI, 0] as const },
];
