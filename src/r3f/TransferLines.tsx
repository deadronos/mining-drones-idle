import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { BufferGeometry } from 'three';
import { BufferAttribute, Color } from 'three';
import { useStore } from '@/state/store';

const RESOURCE_COLORS: Record<string, number> = {
  ore: 0xb8860b,      // dark goldenrod
  bars: 0xff8c00,     // dark orange
  metals: 0xc0c0c0,   // silver
  crystals: 0x9370db, // medium purple
  organics: 0x228b22, // forest green
  ice: 0x00bfff,      // deep sky blue
};

export const TransferLines = () => {
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const factories = useStore((state) => state.factories);
  const geometryRef = useRef<BufferGeometry>(null);

  // Build line geometry from active transfers
  const geometryData = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    if (!logisticsQueues?.pendingTransfers) return { positions, colors };

    // Create a map of factory id -> position for quick lookup
    const factoryPositions = new Map(
      factories.map((f) => [f.id, [f.position.x, f.position.y, f.position.z] as const]),
    );

    // For each transfer, create a line from source to destination
    logisticsQueues.pendingTransfers.forEach((transfer: any) => {
      const sourcePos = factoryPositions.get(transfer.source_factory_id);
      const destPos = factoryPositions.get(transfer.dest_factory_id);

      if (!sourcePos || !destPos) return;

      // Add line start and end positions
      positions.push(...sourcePos, ...destPos);

      // Get color based on resource type
      const resourceColor = RESOURCE_COLORS[transfer.resource] || 0xffffff;
      const color = new Color(resourceColor);

      // Add color for start and end of line (same color for both ends)
      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
    });

    return { positions, colors };
  }, [logisticsQueues, factories]);

  // Update geometry
  useFrame(() => {
    if (!geometryRef.current) return;

    const positions = geometryData.positions;
    const colors = geometryData.colors;

    if (positions.length === 0) {
      geometryRef.current.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([]), 3),
      );
      geometryRef.current.setAttribute('color', new BufferAttribute(new Float32Array([]), 3));
      return;
    }

    geometryRef.current.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3),
    );
    geometryRef.current.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  });

  // No transfers = nothing to render
  if (!logisticsQueues?.pendingTransfers || logisticsQueues.pendingTransfers.length === 0) {
    return null;
  }

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial vertexColors linewidth={2} />
    </lineSegments>
  );
};
