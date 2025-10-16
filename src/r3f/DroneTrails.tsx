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
    geometry.setAttribute('position', new BufferAttribute(buffer.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(buffer.colors, 3));
  }, [buffer]);

  useFrame(() => {
    const line = lineRef.current;
    if (!line) return;
    const geometry = line.geometry;
    buffer.update(droneQuery.entities);
    const positionAttr = geometry.getAttribute('position') as BufferAttribute;
    const colorAttr = geometry.getAttribute('color') as BufferAttribute;
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
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
