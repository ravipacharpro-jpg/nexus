'use strict';

var web = require('solid-js/web');
var solidJs = require('solid-js');
var dom = require('@dnd-kit/dom');
var sortable = require('@dnd-kit/dom/sortable');
var state = require('@dnd-kit/state');

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
var DragDropContext = solidJs.createContext(null);
function useRenderer() {
  const [transitionCount, setTransitionCount] = solidJs.createSignal(0);
  let rendering = null;
  let resolver = null;
  solidJs.createEffect(
    solidJs.on(transitionCount, () => {
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
      solidJs.batch(() => {
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
  const [, managerProps] = solidJs.splitProps(props, ["children"]);
  const manager = solidJs.createMemo(() => {
    var _a;
    return (_a = props.manager) != null ? _a : new dom.DragDropManager(managerProps);
  });
  solidJs.onCleanup(() => {
    if (!props.manager) {
      manager().destroy();
    }
  });
  solidJs.createEffect(() => {
    const _manager = manager();
    _manager.renderer = renderer;
    _manager.plugins = dom.resolveCustomizable(props.plugins, dom.defaultPreset.plugins);
    _manager.sensors = dom.resolveCustomizable(props.sensors, dom.defaultPreset.sensors);
    _manager.modifiers = dom.resolveCustomizable(props.modifiers, dom.defaultPreset.modifiers);
  });
  solidJs.createEffect(() => {
    const disposers = [];
    const monitor = manager().monitor;
    disposers.push(monitor.addEventListener("beforedragstart", (event, manager2) => {
      if (sortable.isSortable(event.operation.source)) {
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
        if (sortable.isSortable(event.operation.source)) {
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
      if (sortable.isSortable(event.operation.source)) {
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
    solidJs.onCleanup(() => {
      disposers.forEach((cleanup) => cleanup());
    });
  });
  return web.createComponent(DragDropContext.Provider, {
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
function useDragDropManager() {
  return solidJs.useContext(DragDropContext);
}

// src/core/hooks/useInstance.ts
function useInstance(initializer) {
  var _a;
  const manager = (_a = useDragDropManager()) != null ? _a : void 0;
  const instance = initializer(manager);
  solidJs.createEffect(() => {
    instance.manager = manager;
    const cleanup = instance.register();
    solidJs.onCleanup(() => cleanup == null ? void 0 : cleanup());
  });
  return instance;
}

// src/core/draggable/useDraggable.ts
function useDraggable(input) {
  const draggable = useInstance(
    (manager) => new dom.Draggable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        element: input.element,
        handle: input.handle
      }),
      manager
    )
  );
  const trackedDraggable = useDeepSignal(() => draggable);
  const [element, setElement] = solidJs.createSignal(
    input.element
  );
  const [handle, setHandle] = solidJs.createSignal(input.handle);
  solidJs.createEffect(() => {
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
  const [element, setElement] = solidJs.createSignal();
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
  solidJs.createEffect(() => {
    if (!source()) {
      setElement(void 0);
    }
  });
  solidJs.createEffect(() => {
    const _manager = manager;
    if (!_manager || isDisabled()) return;
    const feedback = _manager.plugins.find((plugin) => plugin instanceof dom.Feedback);
    if (!feedback) return;
    feedback.overlay = element();
    feedback.dropAnimation = props.dropAnimation;
    solidJs.onCleanup(() => {
      feedback.overlay = void 0;
      feedback.dropAnimation = void 0;
    });
  });
  return web.createComponent(DragDropContext.Provider, {
    get value() {
      return patchedManager();
    },
    get children() {
      return web.createComponent(solidJs.Show, {
        get when() {
          return web.memo(() => !!!isDisabled())() ? source() : void 0;
        },
        children: (src) => web.createComponent(web.Dynamic, {
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
            return web.memo(() => typeof props.children === "function")() ? props.children(src()) : props.children;
          }
        })
      });
    }
  });
}
function createPatchedManager(manager) {
  return solidJs.createMemo(() => {
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
    (manager) => new dom.Droppable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        element: input.element
      }),
      manager
    )
  );
  const trackedDroppable = useDeepSignal(() => droppable);
  const [element, setElement] = solidJs.createSignal(
    input.element
  );
  solidJs.createEffect(() => {
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
  solidJs.createEffect(() => {
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
    solidJs.onCleanup(() => cleanupFns.forEach((cleanup) => cleanup()));
  });
}

Object.defineProperty(exports, "KeyboardSensor", {
  enumerable: true,
  get: function () { return dom.KeyboardSensor; }
});
Object.defineProperty(exports, "PointerSensor", {
  enumerable: true,
  get: function () { return dom.PointerSensor; }
});
exports.DragDropProvider = DragDropProvider;
exports.DragOverlay = DragOverlay;
exports.useDragDropManager = useDragDropManager;
exports.useDragDropMonitor = useDragDropMonitor;
exports.useDragOperation = useDragOperation;
exports.useDraggable = useDraggable;
exports.useDroppable = useDroppable;
exports.useInstance = useInstance;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map