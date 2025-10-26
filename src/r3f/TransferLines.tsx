import { Html } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { Color, MathUtils, Quaternion, Vector3 } from 'three';
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

interface TransferVisual {
  transfer: PendingTransfer;
  start: Vector3;
  end: Vector3;
  midpoint: Vector3;
  quaternion: Quaternion;
  length: number;
  radius: number;
  color: string;
  sourceLabel: string;
  destLabel: string;
}

const computeRadius = (amount: number): number => {
  const normalized = MathUtils.clamp(amount / AMOUNT_FOR_MAX_RADIUS, 0, 1);
  return MIN_RADIUS + normalized * (MAX_RADIUS - MIN_RADIUS);
};

const lightenColor = (hex: string, factor: number): string => {
  const base = new Color(hex);
  base.lerp(new Color('#ffffff'), MathUtils.clamp(factor, 0, 1));
  return `#${base.getHexString()}`;
};

export const TransferLines = () => {
  const logisticsQueues = useStore((state) => state.logisticsQueues);
  const factories = useStore((state) => state.factories);
  const gameTime = useStore((state) => state.gameTime ?? 0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visuals = useMemo<TransferVisual[]>(() => {
    if (!logisticsQueues?.pendingTransfers?.length || factories.length === 0) {
      return [];
    }

    const factoryMap = new Map(factories.map((factory) => [factory.id, factory]));

    return logisticsQueues.pendingTransfers
      .filter((transfer) => transfer.status === 'scheduled' || transfer.status === 'in-transit')
      .map((transfer) => {
        // Resolve source position and label
        let start: Vector3;
        let sourceLabel: string;
        if (transfer.fromFactoryId === WAREHOUSE_NODE_ID) {
          start = WAREHOUSE_POSITION.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
          sourceLabel = 'Whse';
        } else {
          const sourceFactory = factoryMap.get(transfer.fromFactoryId);
          if (!sourceFactory) return null;
          start = sourceFactory.position.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
          sourceLabel = sourceFactory.id.slice(0, 6);
        }

        // Resolve destination position and label
        let end: Vector3;
        let destLabel: string;
        if (transfer.toFactoryId === WAREHOUSE_NODE_ID) {
          end = WAREHOUSE_POSITION.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
          destLabel = 'Whse';
        } else {
          const destFactory = factoryMap.get(transfer.toFactoryId);
          if (!destFactory) return null;
          end = destFactory.position.clone().add(new Vector3(0, HEIGHT_OFFSET, 0));
          destLabel = destFactory.id.slice(0, 6);
        }

        const direction = end.clone().sub(start);
        const length = direction.length();

        if (length <= 0.001) {
          return null;
        }

        const midpoint = start.clone().addScaledVector(direction, 0.5);
        const quaternion = new Quaternion().setFromUnitVectors(
          AXIS_Y,
          direction.clone().normalize(),
        );

        const radius = computeRadius(transfer.amount);
        const color = RESOURCE_COLORS[transfer.resource] ?? '#ffffff';

        return {
          transfer,
          start,
          end,
          midpoint,
          quaternion,
          length,
          radius,
          color,
          sourceLabel,
          destLabel,
        };
      })
      .filter((item): item is TransferVisual => item !== null);
  }, [factories, logisticsQueues]);

  if (visuals.length === 0) {
    return null;
  }

  const hovered = hoveredId
    ? (visuals.find((visual) => visual.transfer.id === hoveredId) ?? null)
    : null;

  return (
    <>
      {visuals.map((visual) => {
        const isHovered = visual.transfer.id === hoveredId;
        const arrowColor = isHovered ? lightenColor(visual.color, 0.4) : visual.color;
        const opacity = isHovered ? 0.95 : 0.7;

        return (
          <group
            key={visual.transfer.id}
            position={visual.midpoint.toArray()}
            // eslint-disable-next-line react/no-unknown-property
            quaternion={visual.quaternion}
            // eslint-disable-next-line react/no-unknown-property
            renderOrder={isHovered ? 1 : 0}
          >
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation();
                setHoveredId(() => visual.transfer.id);
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                setHoveredId((current) =>
                  current === visual.transfer.id ? current : visual.transfer.id,
                );
              }}
              onPointerOut={(event) => {
                event.stopPropagation();
                setHoveredId((current) => (current === visual.transfer.id ? null : current));
              }}
            >
              <cylinderGeometry args={[visual.radius, visual.radius, visual.length, 12, 1, true]} />
              <meshStandardMaterial
                color={arrowColor}
                emissive={arrowColor}
                emissiveIntensity={isHovered ? 0.6 : 0.25}
                transparent
                opacity={opacity}
              />
            </mesh>
            <mesh position={[0, visual.length / 2, 0]}>
              <coneGeometry args={[visual.radius * 1.8, visual.radius * 3.2, 12]} />
              <meshStandardMaterial
                color={arrowColor}
                emissive={arrowColor}
                emissiveIntensity={isHovered ? 0.8 : 0.35}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {hovered ? (
        <Html
          position={hovered.midpoint
            .clone()
            .add(new Vector3(0, hovered.radius * 6, 0))
            .toArray()}
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
              {hovered.sourceLabel} → {hovered.destLabel}
            </div>
            <div style={{ color: hovered.color, fontWeight: 600, marginBottom: 2 }}>
              {Math.round(hovered.transfer.amount)} {hovered.transfer.resource}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              ETA: {Math.max(0, hovered.transfer.eta - gameTime).toFixed(1)}s
            </div>
          </div>
        </Html>
      ) : null}
    </>
  );
};
