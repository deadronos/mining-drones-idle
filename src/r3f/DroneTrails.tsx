import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute } from 'three';
import type { LineSegments } from 'three';
import { gameWorld } from '@/ecs/world';
import { TrailBuffer } from '@/r3f/trailsBuffer';

export const DroneTrails = () => {
  const lineRef = useRef<LineSegments>(null);
  const buffer = useMemo(() => new TrailBuffer(), []);
  const { droneQuery } = gameWorld;

  useEffect(() => {
    droneQuery.connect();
    return () => {
      droneQuery.disconnect();
    };
  }, [droneQuery]);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    line.frustumCulled = false;
    const geometry = line.geometry;
    // Ensure attributes exist immediately on mount to avoid race conditions
    const existingPos = geometry.getAttribute('position') as BufferAttribute | undefined;
    const existingColor = geometry.getAttribute('color') as BufferAttribute | undefined;
    if (!existingPos) geometry.setAttribute('position', new BufferAttribute(buffer.positions, 3));
    else if (existingPos.array !== buffer.positions) existingPos.array = buffer.positions;
    if (!existingColor) geometry.setAttribute('color', new BufferAttribute(buffer.colors, 3));
    else if (existingColor.array !== buffer.colors) existingColor.array = buffer.colors;
  }, [buffer]);

  useFrame(() => {
    const line = lineRef.current;
    if (!line) return;
    const geometry = line.geometry;
    buffer.update(droneQuery.entities);
    let positionAttr = geometry.getAttribute('position') as BufferAttribute | undefined;
    let colorAttr = geometry.getAttribute('color') as BufferAttribute | undefined;

    // If attributes are missing (race/HMR/edge case), recreate them so we can update safely
    if (!positionAttr) {
      geometry.setAttribute('position', new BufferAttribute(buffer.positions, 3));
      positionAttr = geometry.getAttribute('position') as BufferAttribute;
    }
    if (!colorAttr) {
      geometry.setAttribute('color', new BufferAttribute(buffer.colors, 3));
      colorAttr = geometry.getAttribute('color') as BufferAttribute;
    }

    // Only set needsUpdate when the attribute exists
    if (positionAttr) positionAttr.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
    geometry.setDrawRange(0, buffer.vertexCount);
    if (buffer.vertexCount > 0 && !geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }
  });

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  );
};
