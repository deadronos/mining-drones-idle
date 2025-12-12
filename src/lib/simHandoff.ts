import { syncEcsWorldFromRust } from '@/ecs/rustSync';
import { buildRustSnapshotFromTs } from '@/lib/rustSnapshot';
import type { RustSimBridge } from '@/lib/wasmSimBridge';
import type { StoreSettings, StoreSnapshot } from '@/state/types';

export const handoffTsToRust = (bridge: RustSimBridge) => {
  const snapshot = buildRustSnapshotFromTs();
  bridge.loadSnapshot(snapshot as StoreSnapshot);
};

export const handoffRustToTs = (
  bridge: RustSimBridge,
  applySnapshot: (snapshot: StoreSnapshot) => void,
  currentSettings: StoreSettings,
) => {
  const exported = bridge.exportSnapshot() as StoreSnapshot & Record<string, unknown>;
  const merged = {
    ...exported,
    settings: {
      ...currentSettings,
      useRustSim: false,
    },
  } as StoreSnapshot & Record<string, unknown>;

  applySnapshot(merged as StoreSnapshot);
  syncEcsWorldFromRust(bridge, merged);
};
