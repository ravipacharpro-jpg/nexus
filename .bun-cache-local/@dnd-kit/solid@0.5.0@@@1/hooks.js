import { effect, untracked } from '@dnd-kit/state';
import { createSignal, createEffect, onCleanup } from 'solid-js';

// src/hooks/useDeepSignal.ts
function useDeepSignal(target) {
  const tracked = /* @__PURE__ */ new Map();
  const [dirty, setDirty] = createSignal(0);
  createEffect(() => {
    const _target = target();
    if (!_target) {
      tracked.clear();
      return;
    }
    const dispose = effect(() => {
      let stale = false;
      for (const entry of tracked) {
        const [key] = entry;
        const value = untracked(() => entry[1]);
        const latestValue = _target[key];
        if (value !== latestValue) {
          stale = true;
          tracked.set(key, latestValue);
        }
      }
      if (stale) {
        setDirty((v) => v + 1);
      }
    });
    onCleanup(dispose);
  });
  return () => {
    const _target = target();
    void dirty();
    return _target ? new Proxy(_target, {
      get(target2, key) {
        const value = target2[key];
        tracked.set(key, value);
        return value;
      }
    }) : _target;
  };
}

export { useDeepSignal };
//# sourceMappingURL=hooks.js.map
//# sourceMappingURL=hooks.js.map