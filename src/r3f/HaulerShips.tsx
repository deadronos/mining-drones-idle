/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react/no-unknown-property */
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { useStore, storeApi, type PendingTransfer } from '@/state/store';
import { WAREHOUSE_NODE_ID } from '@/ecs/logistics';
import { WAREHOUSE_POSITION } from '@/ecs/world';
import { RESOURCE_COLORS } from '@/r3f/resourceColors';
import type { BuildableFactory } from '@/ecs/factories';

type HaulerStatus = 'scheduled' | 'in-transit';

const MAX_HAULERS = 256;
const HEIGHT_OFFSET = 0.9;
const BASE_FORWARD = new Vector3(0, 1, 0);
const WHITE = new Color('#ffffff');
const ENGINE_SCALE = new Vector3(0.22, 0.6, 0.22);
const HULL_SCALE = new Vector3(0.24, 0.9, 0.24);
const baseMatrix = new Matrix4();
const engineMatrix = new Matrix4();
const orientation = new Quaternion();
const engineOrientation = new Quaternion();
const position = new Vector3();
const enginePosition = new Vector3();
const tangent = new Vector3();
const fallbackDirection = new Vector3(0, 1, 0);
const upVector = new Vector3(0, 1, 0);
const tempColor = new Color();
const engineColor = new Color();
const controlOffset = new Vector3();
const tempVec = new Vector3();
const engineFlip = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
const bezierSamplePoint = new Vector3();
const bezierPrevPoint = new Vector3();

const hullGeometry = new CylinderGeometry(0.16, 0.22, 1, 16);
const noseGeometry = new ConeGeometry(0.22, 0.55, 16);
noseGeometry.translate(0, 0.4, 0);
const engineGeometry = new ConeGeometry(0.28, 0.6, 12, 1, true);
engineGeometry.rotateX(Math.PI);
engineGeometry.translate(0, -0.25, 0);

interface HaulerVisual {
  id: string;
  transfer: PendingTransfer;
  color: string;
  start: Vector3;
  end: Vector3;
  control1: Vector3;
  control2: Vector3;
  duration: number;
  departedAt: number;
  sourceLabel: string;
  destLabel: string;
  status: HaulerStatus;
  sourceFactoryId: string | null;
  destFactoryId: string | null;
  averageSpeed: number;
}

const clampProgress = (departedAt: number, duration: number, time: number) => {
  if (duration <= 0.0001) {
    return time >= departedAt ? 1 : 0;
  }
  return Math.min(1, Math.max(0, (time - departedAt) / duration));
};

export const evaluateCubicBezier = (
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  t: number,
  target: Vector3,
) => {
  const clamped = Math.min(1, Math.max(0, t));
  const mt = 1 - clamped;
  target.set(0, 0, 0);
  target.addScaledVector(p0, mt * mt * mt);
  target.addScaledVector(p1, 3 * mt * mt * clamped);
  target.addScaledVector(p2, 3 * mt * clamped * clamped);
  target.addScaledVector(p3, clamped * clamped * clamped);
  return target;
};

export const evaluateCubicBezierTangent = (
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  t: number,
  target: Vector3,
) => {
  const clamped = Math.min(1, Math.max(0, t));
  const mt = 1 - clamped;
  target.set(0, 0, 0);
  target.addScaledVector(p0, -3 * mt * mt);
  target.addScaledVector(p1, 3 * mt * mt - 6 * mt * clamped);
  target.addScaledVector(p2, 6 * mt * clamped - 3 * clamped * clamped);
  target.addScaledVector(p3, 3 * clamped * clamped);
  return target;
};

export const approximateCubicBezierLength = (
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  segments: number,
) => {
  const clampedSegments = Math.max(1, Math.floor(segments));
  let length = 0;
  bezierPrevPoint.copy(p0);
  for (let i = 1; i <= clampedSegments; i += 1) {
    const t = i / clampedSegments;
    evaluateCubicBezier(p0, p1, p2, p3, t, bezierSamplePoint);
    length += bezierSamplePoint.distanceTo(bezierPrevPoint);
    bezierPrevPoint.copy(bezierSamplePoint);
  }
  return length;
};

const hashScalar = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return (hash % 2000) / 1000 - 1; // [-1, 1] range
};

const computeVisuals = (transfers: PendingTransfer[], factories: BuildableFactory[]): HaulerVisual[] => {
  if (!transfers.length || factories.length === 0) {
    return [];
  }

  const factoryMap = new Map(factories.map((factory) => [factory.id, factory]));
  const visuals: HaulerVisual[] = [];

  for (const transfer of transfers) {
    if (transfer.status !== 'scheduled' && transfer.status !== 'in-transit') {
      continue;
    }

    let start: Vector3 | null = null;
    let sourceLabel = '';
    let sourceFactoryId: string | null = null;
    if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
      start = WAREHOUSE_POSITION.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
      sourceLabel = 'Whse';
    } else {
      const sourceFactory = factoryMap.get(transfer.fromFactoryId);
      if (!sourceFactory) continue;
      start = sourceFactory.position.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
      sourceLabel = sourceFactory.id.slice(0, 6);
      sourceFactoryId = sourceFactory.id;
    }

    let end: Vector3 | null = null;
    let destLabel = '';
    let destFactoryId: string | null = null;
    if (transfer.toFactoryId === WAREHOUSE_NODE_ID) {
      end = WAREHOUSE_POSITION.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
      destLabel = 'Whse';
    } else {
      const destFactory = factoryMap.get(transfer.toFactoryId);
      if (!destFactory) continue;
      end = destFactory.position.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
      destLabel = destFactory.id.slice(0, 6);
      destFactoryId = destFactory.id;
    }

    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.05) {
      continue;
    }

    const arcHeight = Math.max(0.6, length * 0.28);
    const lateralStrength = Math.min(1.1, length * 0.05);
    const lateralSeed = hashScalar(transfer.id);
    const lateral = controlOffset.copy(direction).cross(upVector);
    if (lateral.lengthSq() < 1e-4) {
      lateral.set(direction.z, 0, -direction.x);
    }
    lateral.normalize().multiplyScalar(lateralStrength * lateralSeed);

    const control1 = start
      .clone()
      .addScaledVector(direction, 0.28)
      .add(new Vector3(0, arcHeight, 0))
      .add(lateral);
    const control2 = start
      .clone()
      .addScaledVector(direction, 0.72)
      .add(new Vector3(0, arcHeight * 0.66, 0))
      .add(lateral.clone().multiplyScalar(0.5));

    const duration = Math.max(0.1, transfer.eta - transfer.departedAt);
    const color = RESOURCE_COLORS[transfer.resource] ?? '#ffffff';
    const segments = Math.max(12, Math.min(48, Math.ceil(length * 6)));
    const pathLength = approximateCubicBezierLength(start, control1, control2, end, segments);
    const averageSpeed = pathLength / duration;

    visuals.push({
      id: transfer.id,
      transfer,
      color,
      start,
      end,
      control1,
      control2,
      duration,
      departedAt: transfer.departedAt,
      sourceLabel,
      destLabel,
      status: transfer.status as HaulerStatus,
      sourceFactoryId,
      destFactoryId,
      averageSpeed,
    });
  }

  visuals.sort((a, b) => a.transfer.eta - b.transfer.eta);
  return visuals.slice(0, MAX_HAULERS);
};

export const HaulerShips = () => {
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const factories = useStore((state) => state.factories);
  const gameTime = useStore((state) => state.gameTime ?? 0);
  const hullRef = useRef<InstancedMesh>(null);
  const noseRef = useRef<InstancedMesh>(null);
  const engineRef = useRef<InstancedMesh>(null);
  const visualsRef = useRef<HaulerVisual[]>([]);
  const baseColorsRef = useRef<Color[]>([]);
  const hoveredPositionRef = useRef(new Vector3());
  const [tooltipPosition, setTooltipPosition] = useState<[number, number, number] | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const visuals = useMemo(
    () => computeVisuals(logisticsQueues.pendingTransfers ?? [], factories),
    [logisticsQueues.pendingTransfers, factories],
  );

  useEffect(() => {
    visualsRef.current = visuals;
    baseColorsRef.current = visuals.map((visual) => new Color(visual.color));
    const count = Math.min(visuals.length, MAX_HAULERS);
    const hull = hullRef.current;
    const nose = noseRef.current;
    const engine = engineRef.current;
    for (let i = 0; i < count; i += 1) {
      const baseColor = baseColorsRef.current[i];
      if (hull) hull.setColorAt(i, baseColor);
      if (nose) nose.setColorAt(i, baseColor);
      if (engine) engine.setColorAt(i, tempColor.copy(baseColor).lerp(WHITE, 0.45));
    }
    if (hull?.instanceColor) hull.instanceColor.needsUpdate = true;
    if (nose?.instanceColor) nose.instanceColor.needsUpdate = true;
    if (engine?.instanceColor) engine.instanceColor.needsUpdate = true;
  }, [visuals]);

  const safeHoveredIndex =
    hoveredIndex !== null && hoveredIndex < visuals.length ? hoveredIndex : null;

  useEffect(() => {
    hoveredIndexRef.current = safeHoveredIndex;
  }, [safeHoveredIndex]);

  useEffect(() => {
    if (safeHoveredIndex === null) {
      storeApi.getState().setHighlightedFactories({ sourceId: null, destId: null });
      return;
    }
    const visual = visuals[safeHoveredIndex];
    if (!visual) {
      storeApi.getState().setHighlightedFactories({ sourceId: null, destId: null });
      return;
    }
    storeApi.getState().setHighlightedFactories({
      sourceId: visual.sourceFactoryId,
      destId: visual.destFactoryId,
    });
  }, [safeHoveredIndex, visuals]);

  useEffect(
    () => () => {
      storeApi.getState().setHighlightedFactories({ sourceId: null, destId: null });
    },
    [],
  );

  useFrame(() => {
    const hull = hullRef.current;
    const nose = noseRef.current;
    const engine = engineRef.current;
    if (!hull || !nose || !engine) return;

    const visualsList = visualsRef.current;
    const now = storeApi.getState().gameTime ?? 0;
    const count = Math.min(visualsList.length, MAX_HAULERS);
    let hoveredFound = false;
    for (let i = 0; i < count; i += 1) {
      const visual = visualsList[i];
      const progress = clampProgress(visual.departedAt, visual.duration, now);
      evaluateCubicBezier(visual.start, visual.control1, visual.control2, visual.end, progress, position);
      evaluateCubicBezierTangent(
        visual.start,
        visual.control1,
        visual.control2,
        visual.end,
        progress,
        tangent,
      );
      if (tangent.lengthSq() < 1e-5) {
        tangent.copy(tempVec.copy(visual.end).sub(visual.start));
        if (tangent.lengthSq() < 1e-5) {
          tangent.copy(fallbackDirection);
        }
      }
      tangent.normalize();
      orientation.setFromUnitVectors(BASE_FORWARD, tangent);
      baseMatrix.compose(position, orientation, HULL_SCALE);
      hull.setMatrixAt(i, baseMatrix);
      nose.setMatrixAt(i, baseMatrix);

      enginePosition.copy(position).addScaledVector(tangent, -0.35);
      engineOrientation.copy(orientation).multiply(engineFlip);
      engineMatrix.compose(enginePosition, engineOrientation, ENGINE_SCALE);
      engine.setMatrixAt(i, engineMatrix);

      const baseColor = baseColorsRef.current[i] ?? tempColor.set(visual.color);
      tempColor.copy(baseColor);
      if (hoveredIndexRef.current === i) {
        tempColor.lerp(WHITE, 0.35);
        hoveredPositionRef.current.copy(position).addScaledVector(upVector, 0.35);
        hoveredFound = true;
        const nextPosition: [number, number, number] = [
          hoveredPositionRef.current.x,
          hoveredPositionRef.current.y,
          hoveredPositionRef.current.z,
        ];
        setTooltipPosition((prev) => {
          if (
            !prev ||
            Math.abs(prev[0] - nextPosition[0]) > 1e-3 ||
            Math.abs(prev[1] - nextPosition[1]) > 1e-3 ||
            Math.abs(prev[2] - nextPosition[2]) > 1e-3
          ) {
            return nextPosition;
          }
          return prev;
        });
      }
      hull.setColorAt(i, tempColor);
      nose.setColorAt(i, tempColor);

      engineColor
        .copy(tempColor)
        .lerp(WHITE, hoveredIndexRef.current === i ? 0.6 : 0.45)
        .multiplyScalar(1.05);
      engine.setColorAt(i, engineColor);
    }

    hull.count = count;
    nose.count = count;
    engine.count = count;
    hull.instanceMatrix.needsUpdate = true;
    nose.instanceMatrix.needsUpdate = true;
    engine.instanceMatrix.needsUpdate = true;
    if (hull.instanceColor) hull.instanceColor.needsUpdate = true;
    if (nose.instanceColor) nose.instanceColor.needsUpdate = true;
    if (engine.instanceColor) engine.instanceColor.needsUpdate = true;

    if (!hoveredFound) {
      setTooltipPosition((prev) => (prev ? null : prev));
    }
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (typeof event.instanceId !== 'number') return;
    hoveredIndexRef.current = event.instanceId;
    setHoveredIndex(event.instanceId);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hoveredIndexRef.current = null;
    setHoveredIndex(null);
  };

  const hovered = safeHoveredIndex !== null ? visuals[safeHoveredIndex] ?? null : null;

  return (
    <>
      <instancedMesh
        ref={hullRef}
        args={[undefined as never, undefined as never, MAX_HAULERS]}
        geometry={hullGeometry}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <meshStandardMaterial
          vertexColors
          emissiveIntensity={0.4}
          roughness={0.35}
          metalness={0.25}
        />
      </instancedMesh>
      <instancedMesh
        ref={noseRef}
        args={[undefined as never, undefined as never, MAX_HAULERS]}
        geometry={noseGeometry}
      >
        <meshStandardMaterial vertexColors emissiveIntensity={0.55} roughness={0.25} metalness={0.35} />
      </instancedMesh>
      <instancedMesh
        ref={engineRef}
        args={[undefined as never, undefined as never, MAX_HAULERS]}
        geometry={engineGeometry}
      >
        {/* eslint-disable react/no-unknown-property */}
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
        {/* eslint-enable react/no-unknown-property */}
      </instancedMesh>
      {hovered && tooltipPosition ? (
        <Html
          position={tooltipPosition}
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
              background: 'rgba(11, 16, 31, 0.92)',
              color: '#f8fafc',
              border: '1px solid rgba(96, 165, 250, 0.45)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              lineHeight: 1.4,
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.55)',
              minWidth: 140,
              textAlign: 'center',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {hovered.sourceLabel} → {hovered.destLabel}
            </div>
            <div style={{ color: hovered.color, fontWeight: 600, marginBottom: 2 }}>
              {Math.round(hovered.transfer.amount)} {hovered.transfer.resource}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                opacity: 0.85,
                gap: 8,
              }}
            >
              <span>ETA: {Math.max(0, hovered.transfer.eta - gameTime).toFixed(1)}s</span>
              <span>Speed: {hovered.averageSpeed.toFixed(2)} u/s</span>
            </div>
          </div>
        </Html>
      ) : null}
    </>
  );
};

export const computeHaulerProgress = (
  transfer: Pick<PendingTransfer, 'departedAt' | 'eta'>,
  time: number,
) => clampProgress(transfer.departedAt, Math.max(0.1, transfer.eta - transfer.departedAt), time);

export const __internal = { computeVisuals };
