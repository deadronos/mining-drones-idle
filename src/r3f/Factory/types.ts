import type { Vector3 } from 'three';

export type TransferState = {
  active: boolean;
  elapsed: number;
  duration: number;
  from: Vector3;
  to: Vector3;
  arcHeight: number;
  amount: number;
};

export type ItemState = {
  pathIndex: number;
  progress: number;
  speed: number;
  jitter: number;
};
