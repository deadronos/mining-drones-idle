// Minimal ambient declarations for the generated Rust WASM module. These
// declarations are a safety net for environments where the generated
// `src/gen/rust_engine.d.ts` might not be included by the TypeScript
// project configuration (for example, some CI or test configs that exclude
// the `src/gen` folder).
// Prefer the concrete `src/gen/rust_engine.d.ts` (which provides full
// typings) where available.

import type { InitOutput } from '../gen/rust_engine';

declare module '@/gen/rust_engine' {
  export function set_parity_debug(enabled: boolean): void;
  export class WasmGameState {
    free(): void;
    load_snapshot(_: string): void;
    export_snapshot(): string;
    step(_: number): number;
    apply_command(_: string): void;
    layout_json(): string;
    drone_ids_json(): string;
    asteroid_ids_json(): string;
    get_logistics_queues(): string;
    data_ptr(): number;
    constructor(json: string);
  }
  export default function __wbg_init(...args: unknown[]): Promise<InitOutput>;
}

declare module '../gen/rust_engine' {
  export function set_parity_debug(enabled: boolean): void;
  export class WasmGameState {
    free(): void;
    load_snapshot(_: string): void;
    export_snapshot(): string;
    step(_: number): number;
    apply_command(_: string): void;
    layout_json(): string;
    drone_ids_json(): string;
    asteroid_ids_json(): string;
    get_logistics_queues(): string;
    data_ptr(): number;
    constructor(json: string);
  }
  export default function __wbg_init(...args: unknown[]): Promise<InitOutput>;
}
