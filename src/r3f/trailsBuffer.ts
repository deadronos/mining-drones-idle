import { Color } from 'three';
import type { Vector3 } from 'three';
import type { DroneState } from '@/ecs/world';
import { colorForState } from '@/r3f/droneColors';

export interface DroneTrailSource {
  id: string;
  position: Vector3;
  state: DroneState;
}

export interface TrailBufferConfig {
  limit?: number;
  points?: number;
  background?: Color;
}

const DEFAULT_LIMIT = 128;
const DEFAULT_POINTS = 12;
const DEFAULT_BACKGROUND = new Color('#040713');

export class TrailBuffer {
  readonly limit: number;
  readonly points: number;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  vertexCount = 0;

  private readonly background: Color;
  private readonly histories: Float32Array[];
  private readonly ids: (string | null)[];
  private readonly tmpColor = new Color();
  private readonly scratch = new Color();
  private readonly verticesPerDrone: number;
  private readonly floatsPerDrone: number;

  constructor(config: TrailBufferConfig = {}) {
    this.limit = config.limit ?? DEFAULT_LIMIT;
    this.points = Math.max(2, config.points ?? DEFAULT_POINTS);
    this.background = config.background ?? DEFAULT_BACKGROUND;
    this.verticesPerDrone = (this.points - 1) * 2;
    this.floatsPerDrone = this.verticesPerDrone * 3;
    this.positions = new Float32Array(this.limit * this.floatsPerDrone);
    this.colors = new Float32Array(this.limit * this.floatsPerDrone);
    this.histories = Array.from({ length: this.limit }, () => new Float32Array(this.points * 3));
    this.ids = Array.from({ length: this.limit }, () => null);
  }

  update(drones: readonly DroneTrailSource[]) {
    const count = Math.min(drones.length, this.limit);
    let positionOffset = 0;
    let colorOffset = 0;

    for (let i = 0; i < count; i += 1) {
      const drone = drones[i];
      const history = this.histories[i];
      const { x, y, z } = drone.position;
      if (this.ids[i] !== drone.id) {
        this.ids[i] = drone.id;
        for (let h = 0; h < history.length; h += 3) {
          history[h] = x;
          history[h + 1] = y;
          history[h + 2] = z;
        }
      } else {
        for (let h = history.length - 3; h >= 3; h -= 3) {
          history[h] = history[h - 3];
          history[h + 1] = history[h - 2];
          history[h + 2] = history[h - 1];
        }
        history[0] = x;
        history[1] = y;
        history[2] = z;
      }

      const baseColor = colorForState(drone.state);
      for (let segment = 0; segment < this.points - 1; segment += 1) {
        const startIndex = segment * 3;
        const endIndex = startIndex + 3;
        // position data
        this.positions[positionOffset] = history[startIndex];
        this.positions[positionOffset + 1] = history[startIndex + 1];
        this.positions[positionOffset + 2] = history[startIndex + 2];
        this.positions[positionOffset + 3] = history[endIndex];
        this.positions[positionOffset + 4] = history[endIndex + 1];
        this.positions[positionOffset + 5] = history[endIndex + 2];

        // color data with fade toward background
        this.writeColor(baseColor, segment / (this.points - 1), colorOffset);
        this.writeColor(baseColor, (segment + 1) / (this.points - 1), colorOffset + 3);

        positionOffset += 6;
        colorOffset += 6;
      }
    }

    // zero trailing data when fewer drones are active
    this.positions.fill(0, positionOffset);
    this.colors.fill(0, colorOffset);

    // clear unused histories to avoid ghost trails next time the slot is reused
    for (let i = count; i < this.limit; i += 1) {
      this.ids[i] = null;
      this.histories[i].fill(0);
    }

    this.vertexCount = count * this.verticesPerDrone;
    return this.vertexCount;
  }

  private writeColor(base: Color, fade: number, offset: number) {
    this.tmpColor.copy(base);
    this.scratch.copy(this.background);
    const t = Math.min(Math.max(fade, 0), 1);
    this.tmpColor.lerp(this.scratch, t);
    this.colors[offset] = this.tmpColor.r;
    this.colors[offset + 1] = this.tmpColor.g;
    this.colors[offset + 2] = this.tmpColor.b;
  }
}

export const createTrailSources = (
  drones: readonly DroneTrailSource[],
  limit = DEFAULT_LIMIT,
): readonly DroneTrailSource[] => drones.slice(0, limit);
