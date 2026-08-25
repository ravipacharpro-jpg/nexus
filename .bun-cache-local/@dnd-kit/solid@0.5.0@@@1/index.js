import { createComponent, Dynamic, memo } from 'solid-js/web';
import { createContext, splitProps, createMemo, onCleanup, createEffect, useContext, createSignal, Show, on, batch } from 'solid-js';
import { DragDropManager, resolveCustomizable, defaultPreset, Draggable, Feedback, Droppable } from '@dnd-kit/dom';
export { KeyboardSensor, PointerSensor } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/dom/sortable';
import { effect, untracked } from '@dnd-kit/state';

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var DragDropContext = createContext(null);
function useRenderer() {
  const [transitionCount, setTransitionCount] = createSignal(0);
  let rendering = null;
  let resolver = null;
  createEffect(
    on(transitionCount, () => {
      resolver == null ? void 0 : resolver();
      rendering = null;
    })
  );
  return {
    renderer: {
      get rendering() {
        return rendering != null ? rendering : Promise.resolve();
      }
    },
    trackRendering(callback) {
      if (!rendering) {
        rendering = new Promise((resolve) => {
          resolver = resolve;
        });
      }
      batch(() => {
        callback();
        setTransitionCount((c) => c + 1);
      });
    }
  };
}

// src/utilities/saveElementPosition.ts
function createSaveElementPosition() {
  let savedPosition = null;
  const savePosition = (source) => {
    const element = source.element;
    const id = source.id;
    const prevElement = element.previousElementSibling;
    const nextElement = element.nextElementSibling;
    const parentElement = element.parentElement;
    savedPosition = {
      id,
      element,
      prevElement: prevElement === element ? null : prevElement,
      nextElement: nextElement === element ? null : nextElement,
      parentElement
    };
  };
  const restorePosition = (element) => {
    if (!savedPosition) return;
    const { prevElement, nextElement, parentElement } = savedPosition;
    if (prevElement && element.previousElementSibling !== prevElement) {
      prevElement.insertAdjacentElement("afterend", element);
    } else if (nextElement && element.nextElementSibling !== nextElement) {
      nextElement.insertAdjacentElement("beforebegin", element);
    } else if (!prevElement && !nextElement && parentElement) {
      parentElement.appendChild(element);
    }
  };
  const clearPosition = () => {
    savedPosition = null;
  };
  return {
    savePosition,
    clearPosition,
    restorePosition
  };
}

// src/core/context/DragDropProvider.tsx
function DragDropProvider(props) {
  const {
    savePosition,
    restorePosition,
    clearPosition
  } = createSaveElementPosition();
  const {
    renderer,
    trackRendering
  } = useRenderer();
  const [, managerProps] = splitProps(props, ["children"]);
  const manager = createMemo(() => {
    var _a;
    return (_a = props.manager) != null ? _a : new DragDropManager(managerProps);
  });
  onCleanup(() => {
    if (!props.manager) {
      manager().destroy();
    }
  });
  createEffect(() => {
    const _manager = manager();
    _manager.renderer = renderer;
    _manager.plugins = resolveCustomizable(props.plugins, defaultPreset.plugins);
    _manager.sensors = resolveCustomizable(props.sensors, defaultPreset.sensors);
    _manager.modifiers = resolveCustomizable(props.modifiers, defaultPreset.modifiers);
  });
  createEffect(() => {
    const disposers = [];
    const monitor = manager().monitor;
    disposers.push(monitor.addEventListener("beforedragstart", (event, manager2) => {
      if (isSortable(event.operation.source)) {
        savePosition(event.operation.source);
      }
      const callback = props.onBeforeDragStart;
      if (callback) {
        trackRendering(() => callback(event, manager2));
      }
    }), monitor.addEventListener("dragstart", (event, manager2) => {
      var _a;
      (_a = props.onDragStart) == null ? void 0 : _a.call(props, event, manager2);
    }), monitor.addEventListener("dragover", (event, manager2) => {
      const callback = props.onDragOver;
      if (callback) {
        trackRendering(() => callback(event, manager2));
        if (isSortable(event.operation.source)) {
          const source = event.operation.source;
          queueMicrotask(() => savePosition(source));
        }
      }
    }), monitor.addEventListener("dragmove", (event, manager2) => {
      const callback = props.onDragMove;
      if (callback) {
        trackRendering(() => callback(event, manager2));
      }
    }), monitor.addEventListener("dragend", (event, manager2) => {
      if (isSortable(event.operation.source)) {
        restorePosition(event.operation.source.element);
      }
      const callback = props.onDragEnd;
      if (callback) {
        trackRendering(() => callback(event, manager2));
      }
      clearPosition();
    }), monitor.addEventListener("collision", (event, manager2) => {
      var _a;
      (_a = props.onCollision) == null ? void 0 : _a.call(props, event, manager2);
    }));
    onCleanup(() => {
      disposers.forEach((cleanup) => cleanup());
    });
  });
  return createComponent(DragDropContext.Provider, {
    get value() {
      return manager();
    },
    get children() {
      return props.children;
    }
  });
}
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
function useDragDropManager() {
  return useContext(DragDropContext);
}

// src/core/hooks/useInstance.ts
function useInstance(initializer) {
  var _a;
  const manager = (_a = useDragDropManager()) != null ? _a : void 0;
  const instance = initializer(manager);
  createEffect(() => {
    instance.manager = manager;
    const cleanup = instance.register();
    onCleanup(() => cleanup == null ? void 0 : cleanup());
  });
  return instance;
}

// src/core/draggable/useDraggable.ts
function useDraggable(input) {
  const draggable = useInstance(
    (manager) => new Draggable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        element: input.element,
        handle: input.handle
      }),
      manager
    )
  );
  const trackedDraggable = useDeepSignal(() => draggable);
  const [element, setElement] = createSignal(
    input.element
  );
  const [handle, setHandle] = createSignal(input.handle);
  createEffect(() => {
    var _a;
    const el = element();
    if (el) draggable.element = el;
    const h = handle();
    if (h) draggable.handle = h;
    draggable.id = input.id;
    draggable.disabled = (_a = input.disabled) != null ? _a : false;
    draggable.alignment = input.alignment;
    draggable.plugins = input.plugins;
    draggable.modifiers = input.modifiers;
    draggable.sensors = input.sensors;
    if (input.data) {
      draggable.data = input.data;
    }
  });
  return {
    get draggable() {
      return draggable;
    },
    isDragging: () => trackedDraggable().isDragging,
    isDropping: () => trackedDraggable().isDropping,
    isDragSource: () => trackedDraggable().isDragSource,
    ref: setElement,
    handleRef: setHandle
  };
}

// src/core/hooks/useDragOperation.ts
function useDragOperation() {
  const manager = useDragDropManager();
  const trackedDragOperation = useDeepSignal(
    () => manager == null ? void 0 : manager.dragOperation
  );
  return {
    source: () => {
      var _a;
      return (_a = trackedDragOperation()) == null ? void 0 : _a.source;
    },
    target: () => {
      var _a;
      return (_a = trackedDragOperation()) == null ? void 0 : _a.target;
    },
    status: () => {
      var _a;
      return (_a = trackedDragOperation()) == null ? void 0 : _a.status;
    }
  };
}

// src/core/draggable/DragOverlay.tsx
function DragOverlay(props) {
  const [element, setElement] = createSignal();
  const manager = useDragDropManager();
  const patchedManager = createPatchedManager(() => manager);
  const dragOperation = useDragOperation();
  const source = () => dragOperation.source();
  const isDisabled = () => {
    var _a;
    if (typeof props.disabled === "function") {
      return props.disabled(source());
    }
    return (_a = props.disabled) != null ? _a : false;
  };
  createEffect(() => {
    if (!source()) {
      setElement(void 0);
    }
  });
  createEffect(() => {
    const _manager = manager;
    if (!_manager || isDisabled()) return;
    const feedback = _manager.plugins.find((plugin) => plugin instanceof Feedback);
    if (!feedback) return;
    feedback.overlay = element();
    feedback.dropAnimation = props.dropAnimation;
    onCleanup(() => {
      feedback.overlay = void 0;
      feedback.dropAnimation = void 0;
    });
  });
  return createComponent(DragDropContext.Provider, {
    get value() {
      return patchedManager();
    },
    get children() {
      return createComponent(Show, {
        get when() {
          return memo(() => !!!isDisabled())() ? source() : void 0;
        },
        children: (src) => createComponent(Dynamic, {
          get component() {
            return props.tag || "div";
          },
          get ["class"]() {
            return props.class;
          },
          get style() {
            return props.style;
          },
          "data-dnd-overlay": true,
          ref: setElement,
          get children() {
            return memo(() => typeof props.children === "function")() ? props.children(src()) : props.children;
          }
        })
      });
    }
  });
}
function createPatchedManager(manager) {
  return createMemo(() => {
    const _manager = manager();
    if (!_manager) return null;
    const patchedRegistry = new Proxy(_manager.registry, {
      get(target, property) {
        if (property === "register" || property === "unregister") {
          return noop;
        }
        return target[property];
      }
    });
    return new Proxy(_manager, {
      get(target, property) {
        if (property === "registry") {
          return patchedRegistry;
        }
        return target[property];
      }
    });
  });
}
function noop() {
  return () => {
  };
}
function useDroppable(input) {
  const droppable = useInstance(
    (manager) => new Droppable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        element: input.element
      }),
      manager
    )
  );
  const trackedDroppable = useDeepSignal(() => droppable);
  const [element, setElement] = createSignal(
    input.element
  );
  createEffect(() => {
    var _a;
    const el = element();
    if (el) droppable.element = el;
    droppable.id = input.id;
    droppable.accept = input.accept;
    droppable.type = input.type;
    droppable.disabled = (_a = input.disabled) != null ? _a : false;
    if (input.collisionDetector) {
      droppable.collisionDetector = input.collisionDetector;
    }
    if (input.data) {
      droppable.data = input.data;
    }
  });
  return {
    get droppable() {
      return droppable;
    },
    isDropTarget: () => trackedDroppable().isDropTarget,
    ref: setElement
  };
}
function useDragDropMonitor(handlers) {
  const manager = useDragDropManager();
  createEffect(() => {
    if (!manager) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "useDragDropMonitor hook was called outside of a DragDropProvider. Make sure your app is wrapped in a DragDropProvider component."
        );
      }
      return;
    }
    const cleanupFns = Object.entries(handlers).reduce(
      (acc, [handlerName, handler]) => {
        if (handler) {
          const eventName = handlerName.replace(/^on/, "").toLowerCase();
          const unsubscribe = manager.monitor.addEventListener(
            eventName,
            handler
          );
          acc.push(unsubscribe);
        }
        return acc;
      },
      []
    );
    onCleanup(() => cleanupFns.forEach((cleanup) => cleanup()));
  });
}

export { DragDropProvider, DragOverlay, useDragDropManager, useDragDropMonitor, useDragOperation, useDraggable, useDroppable, useInstance };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map