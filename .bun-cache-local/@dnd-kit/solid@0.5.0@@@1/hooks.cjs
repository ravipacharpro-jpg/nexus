'use strict';

var state = require('@dnd-kit/state');
var solidJs = require('solid-js');

// src/hooks/useDeepSignal.ts
function useDeepSignal(target) {
  const tracked = /* @__PURE__ */ new Map();
  const [dirty, setDirty] = solidJs.createSignal(0);
  solidJs.createEffect(() => {
    const _target = target();
    if (!_target) {
      tracked.clear();
      return;
    }
    const dispose = state.effect(() => {
      let stale = false;
      for (const entry of tracked) {
        const [key] = entry;
        const value = state.untracked(() => entry[1]);
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
    solidJs.onCleanup(dispose);
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

exports.useDeepSignal = useDeepSignal;
//# sourceMappingURL=hooks.cjs.map
//# sourceMappingURL=hooks.cjs.map