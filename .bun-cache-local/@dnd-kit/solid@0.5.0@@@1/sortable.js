import { defaultSortableTransition, Sortable } from '@dnd-kit/dom/sortable';
export { isSortable, isSortableOperation } from '@dnd-kit/dom/sortable';
import { batch } from '@dnd-kit/state';
import { createSignal, createEffect, on } from 'solid-js';
import { useDeepSignal } from '@dnd-kit/solid/hooks';
import { useInstance } from '@dnd-kit/solid';

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
function useSortable(input) {
  const transition = __spreadValues(__spreadValues({}, defaultSortableTransition), input.transition);
  const sortable = useInstance((manager) => {
    return new Sortable(
      __spreadProps(__spreadValues({}, input), {
        register: false,
        transition,
        element: input.element,
        handle: input.handle,
        target: input.target
      }),
      manager
    );
  });
  const trackedSortable = useDeepSignal(() => sortable);
  const [element, setElement] = createSignal(
    input.element
  );
  const [handle, setHandle] = createSignal(input.handle);
  const [source, setSource] = createSignal(input.source);
  const [target, setTarget] = createSignal(input.target);
  createEffect(() => {
    var _a;
    const el = element();
    if (el) sortable.element = el;
    const h = handle();
    if (h) sortable.handle = h;
    const s = source();
    if (s) sortable.source = s;
    const t = target();
    if (t) sortable.target = t;
    sortable.id = input.id;
    sortable.disabled = (_a = input.disabled) != null ? _a : false;
    sortable.alignment = input.alignment;
    sortable.plugins = input.plugins;
    sortable.modifiers = input.modifiers;
    sortable.sensors = input.sensors;
    sortable.accept = input.accept;
    sortable.type = input.type;
    sortable.collisionPriority = input.collisionPriority;
    sortable.transition = input.transition ? __spreadValues(__spreadValues({}, defaultSortableTransition), input.transition) : defaultSortableTransition;
    if (input.collisionDetector) {
      sortable.collisionDetector = input.collisionDetector;
    }
    if (input.data) {
      sortable.data = input.data;
    }
  });
  createEffect(
    on(
      () => [input.group, input.index],
      () => {
        batch(() => {
          sortable.group = input.group;
          sortable.index = input.index;
        });
      }
    )
  );
  createEffect(
    on(
      () => input.index,
      () => {
        var _a, _b;
        if (((_a = sortable.manager) == null ? void 0 : _a.dragOperation.status.idle) && ((_b = sortable.transition) == null ? void 0 : _b.idle)) {
          sortable.refreshShape();
        }
      }
    )
  );
  return {
    get sortable() {
      return sortable;
    },
    isDragging: () => trackedSortable().isDragging,
    isDropping: () => trackedSortable().isDropping,
    isDragSource: () => trackedSortable().isDragSource,
    isDropTarget: () => trackedSortable().isDropTarget,
    ref: setElement,
    handleRef: setHandle,
    sourceRef: setSource,
    targetRef: setTarget
  };
}

export { useSortable };
//# sourceMappingURL=sortable.js.map
//# sourceMappingURL=sortable.js.map