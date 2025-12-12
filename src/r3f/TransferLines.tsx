/* eslint-disable react-hooks/immutability */
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, MathUtils, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { BuildableFactory } from '@/ecs/factories';
import type { PendingTransfer } from '@/state/store';
import { useStore } from '@/state/store';
import { WAREHOUSE_NODE_ID } from '@/ecs/logistics';
import { WAREHOUSE_POSITION } from '@/ecs/world';
import { RESOURCE_COLORS } from '@/r3f/resourceColors';

const AXIS_Y = new Vector3(0, 1, 0);
const HEIGHT_OFFSET = 0.9;
const MIN_RADIUS = 0.045;
const MAX_RADIUS = 0.16;
const AMOUNT_FOR_MAX_RADIUS = 140;
const MAX_TRANSFERS = 256;

const shaftMatrix = new Matrix4();
const shaftScale = new Vector3();
const headMatrix = new Matrix4();
const headScale = new Vector3();
const headPosition = new Vector3();
const direction = new Vector3();
const tooltipPosition = new Vector3();
const baseColor = new Color();
const hoveredColor = new Color();
const whiteColor = new Color('#ffffff');

interface TransferVisual {
  transfer: PendingTransfer;
  start: Vector3;
  end: Vector3;
  midpoint: Vector3;
  quaternion: Quaternion;
  length: number;
  radius: number;
  color: Color;
  sourceLabel: string;
  destLabel: string;
}

const computeRadius = (amount: number): number => {
  const normalized = MathUtils.clamp(amount / AMOUNT_FOR_MAX_RADIUS, 0, 1);
  return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
};

const createVisualPool = () =>
  Array.from({ length: MAX_TRANSFERS }, () => ({
    transfer: {} as PendingTransfer,
    start: new Vector3(),
    end: new Vector3(),
    midpoint: new Vector3(),
    quaternion: new Quaternion(),
    length: 0,
    radius: 0,
    color: new Color(),
    sourceLabel: '',
    destLabel: '',
  } satisfies TransferVisual));

const createColorPool = () => Array.from({ length: MAX_TRANSFERS }, () => new Color());
const transferVisualPool = createVisualPool();
const transferBaseColors = createColorPool();
const transferFactoryMap = new Map<string, BuildableFactory>();

export const TransferLines = () => {
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const factories = useStore((state) => state.factories);
  const gameTime = useStore((state) => state.gameTime ?? 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const shaftRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const visualsInfo = useMemo(() => {
    const pool = transferVisualPool;
    const baseColors = transferBaseColors;
    const factoryMap = transferFactoryMap;
    factoryMap.clear();

    for (const factory of factories) {
      factoryMap.set(factory.id, factory);
    }

    let count = 0;
    const pendingTransfers = logisticsQueues?.pendingTransfers ?? [];
    for (const transfer of pendingTransfers) {
      if (transfer.status !== 'scheduled' && transfer.status !== 'in-transit') continue;
      if (count >= MAX_TRANSFERS) break;

      const visual = pool[count];
      visual.transfer = transfer;

      if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
        visual.start.copy(WAREHOUSE_POSITION).addScaledVector(AXIS_Y, HEIGHT_OFFSET);
        visual.sourceLabel = 'Whse';
      } else {
        const sourceFactory = factoryMap.get(transfer.fromFactoryId);
        if (!sourceFactory) continue;
        visual.start.copy(sourceFactory.position).addScaledVector(AXIS_Y, HEIGHT_OFFSET);
        visual.sourceLabel = sourceFactory.id.slice(0, 6);
      }

      if (transfer.toFactoryId === WAREHOUSE_NODE_ID) {
        visual.end.copy(WAREHOUSE_POSITION).addScaledVector(AXIS_Y, HEIGHT_OFFSET);
        visual.destLabel = 'Whse';
      } else {
        const destFactory = factoryMap.get(transfer.toFactoryId);
        if (!destFactory) continue;
        visual.end.copy(destFactory.position).addScaledVector(AXIS_Y, HEIGHT_OFFSET);
        visual.destLabel = destFactory.id.slice(0, 6);
      }

      direction.copy(visual.end).sub(visual.start);
      const length = direction.length();
      if (length <= 0.001) continue;

      visual.length = length;
      visual.midpoint.copy(visual.start).addScaledVector(direction, 0.5);
      visual.quaternion.setFromUnitVectors(AXIS_Y, direction.normalize());
      visual.radius = computeRadius(transfer.amount);
      visual.color.set(RESOURCE_COLORS[transfer.resource] ?? '#ffffff');

      baseColors[count].copy(visual.color);
      count += 1;
    }

    return { count, view: pool.slice(0, count) };
  }, [factories, logisticsQueues?.pendingTransfers]);

  const visualCount = visualsInfo.count;
  const visualsView = visualsInfo.view;

  const hoveredVisual =
    hoveredIndex !== null && hoveredIndex < visualCount ? visualsView[hoveredIndex] : null;

  useEffect(() => {
    const shaft = shaftRef.current;
    const head = headRef.current;
    if (!shaft || !head) return;

    const pool = transferVisualPool;
    for (let i = 0; i < visualCount; i += 1) {
      const visual = pool[i];
      shaftScale.set(visual.radius, visual.length, visual.radius);
      shaftMatrix.compose(visual.midpoint, visual.quaternion, shaftScale);
      shaft.setMatrixAt(i, shaftMatrix);

      headScale.set(visual.radius * 1.8, visual.radius * 3.2, visual.radius * 1.8);
      headPosition.copy(visual.end);
      headMatrix.compose(headPosition, visual.quaternion, headScale);
      head.setMatrixAt(i, headMatrix);
    }

    shaft.count = visualCount;
    head.count = visualCount;
    shaft.instanceMatrix.needsUpdate = visualCount > 0;
    head.instanceMatrix.needsUpdate = visualCount > 0;
  }, [visualCount]);

  useEffect(() => {
    const shaft = shaftRef.current;
    const head = headRef.current;
    if (!shaft || !head) return;

    const baseColors = transferBaseColors;
    for (let i = 0; i < visualCount; i += 1) {
      const isHovered = hoveredIndex === i;
      baseColor.copy(baseColors[i]);
      hoveredColor.copy(baseColor).lerp(whiteColor, isHovered ? 0.4 : 0);
      shaft.setColorAt?.(i, hoveredColor);
      head.setColorAt?.(i, hoveredColor);
    }

    if (shaft.instanceColor) shaft.instanceColor.needsUpdate = visualCount > 0;
    if (head.instanceColor) head.instanceColor.needsUpdate = visualCount > 0;
  }, [hoveredIndex, visualCount]);

  if (visualCount === 0) {
    return null;
  }

  const tooltipArray = hoveredVisual
    ? tooltipPosition
        .copy(hoveredVisual.midpoint)
        .addScaledVector(AXIS_Y, hoveredVisual.radius * 6)
        .toArray()
    : null;

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (typeof event.instanceId === 'number') {
      setHoveredIndex(event.instanceId);
    }
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredIndex((current) => (current !== null ? null : current));
  };

  return (
    <>
      <instancedMesh
        ref={shaftRef}
        args={[undefined as never, undefined as never, MAX_TRANSFERS]}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerMove}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 1, 12, 1, true]} />
        <meshStandardMaterial
          vertexColors
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
          roughness={0.5}
          metalness={0.3}
        />
      </instancedMesh>

      <instancedMesh
        ref={headRef}
        args={[undefined as never, undefined as never, MAX_TRANSFERS]}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerMove}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1, 1, 12]} />
        <meshStandardMaterial
          vertexColors
          emissiveIntensity={0.75}
          transparent
          opacity={0.8}
          roughness={0.45}
          metalness={0.35}
        />
      </instancedMesh>

      {hoveredVisual && tooltipArray ? (
        <Html
          position={tooltipArray}
          center
          style={{
            padding: 0,
            border: 'none',
            background: 'transparent',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(10, 13, 24, 0.92)',
              color: '#f8fafc',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              lineHeight: 1.4,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.45)',
              minWidth: 120,
              textAlign: 'center',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {hoveredVisual.sourceLabel} → {hoveredVisual.destLabel}
            </div>
            <div style={{ color: hoveredVisual.color.getStyle(), fontWeight: 600, marginBottom: 2 }}>
              {Math.round(hoveredVisual.transfer.amount)} {hoveredVisual.transfer.resource}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              ETA: {Math.max(0, hoveredVisual.transfer.eta - gameTime).toFixed(1)}s
            </div>
          </div>
        </Html>
      ) : null}
    </>
  );
};
